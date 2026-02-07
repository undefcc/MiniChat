import { useState, useRef, useCallback, useEffect } from 'react'
import { request } from '../utils/request'
import * as wsBus from '../services/wsBus'
import { WS_EVENTS } from '../services/wsConstants'
import { useStationStore } from '../store/stationStore'
import { useConnectionStore } from '../store/connectionStore'
import { 
  MonitorStream, 
  StationStatusPayload, 
  DeviceStatus, 
  StationDeviceInfo 
} from '../types/station'

export * from '../types/station'

/**
 * 站点监控核心 Hook
 * 负责管理多个并发的视频流连接
 */
export function useStationMonitor() {
  const updateStationStatus = useStationStore(s => s.updateStationStatus)
  const removeStation = useStationStore(s => s.removeStation)
  const setSignalingStatus = useConnectionStore(s => s.setSignalingStatus)

  const [streams, setStreams] = useState<Map<string, MonitorStream>>(new Map())
  const [logs, setLogs] = useState<string[]>([])
  const [onlineStations, setOnlineStations] = useState<string[]>([])
  const [incomingCalls, setIncomingCalls] = useState<Set<string>>(new Set())
  
  // Removed internal stationStatusMap state in favor of global store
  const [stationLatencyMap, setStationLatencyMap] = useState<Map<string, number>>(new Map())

  const stationLatencyTimestampRef = useRef<Map<string, number>>(new Map())

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50))
  }

  const computeSummary = (devices: StationDeviceInfo[]) => {
    const initial: Record<DeviceStatus, number> = { online: 0, offline: 0, warning: 0, error: 0 }
    return devices.reduce<Record<DeviceStatus, number>>((acc, device) => {
      acc[device.status] += 1
      return acc
    }, { ...initial })
  }

  // 初始化加载在线站点
  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        setSignalingStatus('connecting')
        await wsBus.connect()
        // 只有当连接成功后获取列表
        if (wsBus.getSocket()?.connected) {
          const data = await request.get<{ stations: string[] }>('/stations/online')
          const stations = data.stations || []
          if (mounted) {
            setOnlineStations(stations)
            setSignalingStatus('connected')
            addLog(`初始在线站点: ${stations.join(', ') || '无'}`)
          }
        }
      } catch (e: any) {
        console.error('Failed to get online stations', e)
        if (mounted) {
            setSignalingStatus('error', e.message || 'Connection failed')
            addLog(`Error: ${e.message}`)
        }
      }
    }
    
    // 如果已连接则直接调用，否则 connect 会触发
    init()

    // 监听上下线变化
    const handleStationConnected = (stationId: string) => {
      if (!mounted) return
      addLog(`站点上线: ${stationId}`)
      setOnlineStations(prev => {
        if (!prev.includes(stationId)) return [...prev, stationId]
        return prev
      })
    }

    const handleStationDisconnected = (stationId: string) => {
        if (!mounted) return
      addLog(`站点下线: ${stationId}`)
      setOnlineStations(prev => prev.filter(id => id !== stationId))
      removeStation(stationId)
    }

    const handleConnectedEvent = (payload: { stationId: string }) => handleStationConnected(payload.stationId)
    const handleDisconnectedEvent = (payload: { stationId: string }) => handleStationDisconnected(payload.stationId)

    wsBus.on(WS_EVENTS.STATION.CONNECTED, handleConnectedEvent)
    wsBus.on(WS_EVENTS.STATION.DISCONNECTED, handleDisconnectedEvent)

    return () => {
      mounted = false
      wsBus.off(WS_EVENTS.STATION.CONNECTED, handleConnectedEvent)
      wsBus.off(WS_EVENTS.STATION.DISCONNECTED, handleDisconnectedEvent)
    }
  }, [wsBus.getSocket()?.connected]) // 只在连接状态改变时触发

  // 1. 发起视频请求
  const requestStream = useCallback(async (stationId: string, cameraId: string) => {
    const streamId = `${stationId}:${cameraId}`
    
    // 更新状态为 requesting
    setStreams(prev => {
      const next = new Map(prev)
      next.set(streamId, { stationId, cameraId, status: 'requesting' })
      return next
    })
    
    addLog(`正在请求视频: ${stationId} - ${cameraId}`)

    // 尝试建立连接 (Socket)
    try {
      await wsBus.connect()
      
      // 创建 Offer (WebRTC P2P 模式)
      // 注意：这里我们创建一个只接收的 PC，不需要麦克风/摄像头权限
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      })
      
      // 添加收发器，告诉对方"我想收视频"
      pc.addTransceiver('video', { direction: 'recvonly' })
      pc.addTransceiver('audio', { direction: 'recvonly' })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Wait for ICE gathering to complete (Vanilla ICE)
      // This ensures the Offer contains all candidates, avoiding the need for Trickle ICE signaling
      if (pc.iceGatheringState !== 'complete') {
         await new Promise<void>(resolve => {
            const check = () => {
                if (pc.iceGatheringState === 'complete') {
                    pc.removeEventListener('icegatheringstatechange', check)
                    resolve()
                }
            }
            pc.addEventListener('icegatheringstatechange', check)
            // Fallback timeout in case 'complete' never fires (e.g. only host candidates)
            setTimeout(resolve, 2000) 
         })
      }
      
      const completeOffer = pc.localDescription

      // 发送指令
      wsBus.emit(WS_EVENTS.STATION.CMD_REQUEST_STREAM, {
        stationId,
        cameraId,
        offer: completeOffer, // 携带完整的 Offer (包含 ICE Candidates)
      })

      // 保存 PC 实例以便后续处理 Answer 和 ICE
      setStreams(prev => {
        const next = new Map(prev)
        const current = next.get(streamId)!
        next.set(streamId, { ...current, pc })
        return next
      })

      // 监听 PC 事件
      pc.ontrack = (event) => {
        addLog(`收到视频流: ${stationId} - ${cameraId}`)
        setStreams(prev => {
          const next = new Map(prev)
          const current = next.get(streamId)
          if (current) {
            next.set(streamId, { 
              ...current, 
              status: 'playing',
              stream: event.streams[0] 
            })
          }
          return next
        })
      }

    } catch (err: any) {
      addLog(`请求失败: ${err.message}`)
      setStreams(prev => {
        const next = new Map(prev)
        next.set(streamId, { stationId, cameraId, status: 'error', error: err.message })
        return next
      })
    }
  }, [])

  // 2. 停止视频
  const closeStream = useCallback((stationId: string, cameraId: string) => {
    const streamId = `${stationId}:${cameraId}`
    setStreams(prev => {
      const next = new Map(prev)
      const current = next.get(streamId)
      if (current && current.pc) {
        current.pc.close()
      }
      next.delete(streamId)
      return next
    })
    addLog(`关闭视频: ${stationId} - ${cameraId}`)
  }, [])

  // 2.5 请求设备状态
  const requestStationStatus = useCallback(async (stationId: string) => {
    if (!stationId) return
    try {
      // 记录请求时间
      stationLatencyTimestampRef.current.set(stationId, Date.now())
      
      await wsBus.connect()
      wsBus.emit(WS_EVENTS.STATION.REQUEST_STATUS, { stationId })
      addLog(`请求设备状态: ${stationId}`)
    } catch (err: any) {
      addLog(`请求设备状态失败: ${err.message || 'unknown error'}`)
    }
  }, [])

  // 3. 全局信令监听
  useEffect(() => {
    // 监听总控回复: stream-ready
    const handleStreamReady = async (data: any) => {
      // data: { stationId, requesterId, status, answer, url }
      // 我们需要想办法匹配回具体的 cameraId... 
      // 简化起见，假设目前只有一个流在请求，或者后端透传了 cameraId
      // 真实场景下，backend 应该在 stream-ready 里透传 cameraId
      // 这里做一个简单的遍历匹配
      
      addLog(`收到总控回复: ${data.status} from ${data.stationId}`)

      if (data.answer) {
        // 找到对应的 PC (这里是个 Hack，应该用 cameraId 匹配)
        // 遍历所有正在 requesting 的流
        streams.forEach(async (s, key) => {
          if (s.stationId === data.stationId && s.status === 'requesting' && s.pc) {
            try {
              await s.pc.setRemoteDescription(new RTCSessionDescription(data.answer))
              addLog(`已设置 Remote Description for ${key}`)
            } catch (e: any) {
              addLog(`设置 Answer 失败: ${e.message}`)
            }
          }
        })
      }
    }

    const handleIncomingCall = (data: { stationId: string, timestamp: number }) => {
      addLog(`🚨 接到站点呼叫: ${data.stationId}`)
      setIncomingCalls(prev => {
        const next = new Set(prev)
        next.add(data.stationId)
        return next
      })
    }

    const handleStationStatusUpdate = (data: StationStatusPayload) => {
      if (!data?.stationId) return
      
      // 计算设备延迟（从请求发出到收到响应的时间）
      const requestTime = stationLatencyTimestampRef.current.get(data.stationId)
      if (requestTime) {
        const deviceLatency = Date.now() - requestTime
        setStationLatencyMap(prev => new Map(prev).set(data.stationId, deviceLatency))
        stationLatencyTimestampRef.current.delete(data.stationId)
      }
      
      const summary = data.summary || computeSummary(data.devices || [])
      updateStationStatus({ ...data, summary })
    }

    const handleBatchStationStatusUpdate = (updates: StationStatusPayload[]) => {
      // 1. 处理延迟统计 (如果有需要，这里目前简单跳过或取第一个)
      // 2. 批量更新 Store
      
      // 预处理 summary
      const processedUpdates = updates.map(data => ({
         ...data,
         summary: data.summary || computeSummary(data.devices || [])
      }))
      
      // 调用 Store 的批量更新 Action
      useStationStore.getState().batchUpdateStations(processedUpdates)
    }

    wsBus.on(WS_EVENTS.STATION.STREAM_READY, handleStreamReady)
    wsBus.on(WS_EVENTS.STATION.INCOMING_CALL, handleIncomingCall)
    // 兼容旧事件
    wsBus.on(WS_EVENTS.STATION.STATUS_UPDATE, handleStationStatusUpdate)
    // 监听新的批量事件
    wsBus.on(WS_EVENTS.STATION.BATCH_STATUS_UPDATE, handleBatchStationStatusUpdate)

    return () => {
      wsBus.off(WS_EVENTS.STATION.STREAM_READY, handleStreamReady)
      wsBus.off(WS_EVENTS.STATION.INCOMING_CALL, handleIncomingCall)
      wsBus.off(WS_EVENTS.STATION.STATUS_UPDATE, handleStationStatusUpdate)
      wsBus.off(WS_EVENTS.STATION.BATCH_STATUS_UPDATE, handleBatchStationStatusUpdate)
    }
  }, [streams])

  return {
    streams,
    logs,
    onlineStations,
    stationLatencyMap,
    incomingCalls,
    requestStream,
    closeStream,
    requestStationStatus,
    clearCall: (stationId: string) => {
        setIncomingCalls(prev => {
            const next = new Set(prev)
            next.delete(stationId)
            return next
        })
    }
  }
}
