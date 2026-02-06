import { useState, useRef, useCallback, useEffect } from 'react'
import { useSocketSignaling } from './useSocketSignaling'

export type StreamStatus = 'idle' | 'requesting' | 'playing' | 'error'

export type DeviceStatus = 'online' | 'offline' | 'warning' | 'error'

export interface StationDeviceMetrics {
  temp?: number
  battery?: number
  signal?: number
  load?: number
  memory?: number
}

export interface StationDeviceInfo {
  deviceId: string
  name: string
  type: string
  status: DeviceStatus
  metrics?: StationDeviceMetrics
  lastSeen?: number
}

export interface StationStatusPayload {
  stationId: string
  updatedAt: number
  devices: StationDeviceInfo[]
  summary?: {
    online: number
    offline: number
    warning: number
    error: number
  }
}

export interface MonitorStream {
  stationId: string
  cameraId: string
  status: StreamStatus
  stream?: MediaStream
  url?: string
  error?: string
  pc?: RTCPeerConnection
}

/**
 * 站点监控核心 Hook
 * 负责管理多个并发的视频流连接
 */
export function useStationMonitor() {
  const signaling = useSocketSignaling()
  const [streams, setStreams] = useState<Map<string, MonitorStream>>(new Map())
  const [logs, setLogs] = useState<string[]>([])
  const [onlineStations, setOnlineStations] = useState<string[]>([])
  const [incomingCalls, setIncomingCalls] = useState<Set<string>>(new Set())
  const [stationStatusMap, setStationStatusMap] = useState<Map<string, StationStatusPayload>>(new Map())

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
        await signaling.connect()
        // 只有当连接成功后获取列表
        if (signaling.getSocket()?.connected) {
          const stations = await signaling.getOnlineStations()
          if (mounted) {
            setOnlineStations(stations)
            addLog(`初始在线站点: ${stations.join(', ') || '无'}`)
          }
        }
      } catch (e) {
        console.error('Failed to get online stations', e)
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
      setStationStatusMap(prev => {
        const next = new Map(prev)
        next.delete(stationId)
        return next
      })
    }

    signaling.onStationConnected(handleStationConnected)
    signaling.onStationDisconnected(handleStationDisconnected)

    return () => {
      mounted = false
    }
  }, [signaling.getSocket()?.connected]) // 只在连接状态改变时触发

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
      await signaling.connect()
      
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
      // 注意：这里我们绕过了 try/catch，假设 signaling 已经被修改为支持 emit 'cmd-request-stream'
      // 由于 useSocketSignaling 类型定义可能还没更新，这里用 any 或扩展
      const socket = (signaling as any).getSocket?.() 
      if (socket) {
        socket.emit('cmd-request-stream', {
          stationId,
          cameraId,
          offer: completeOffer // 携带完整的 Offer (包含 ICE Candidates)
        })
      } else {
         throw new Error('Socket not connected')
      }

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
  }, [signaling])

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
      await signaling.connect()
      const socket = (signaling as any).getSocket?.()
      if (!socket) throw new Error('Socket not connected')
      socket.emit('request-station-status', { stationId })
      addLog(`请求设备状态: ${stationId}`)
    } catch (err: any) {
      addLog(`请求设备状态失败: ${err.message || 'unknown error'}`)
    }
  }, [signaling])

  // 3. 全局信令监听
  useEffect(() => {
    const socket = (signaling as any).getSocket?.()
    if (!socket) return

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
      setStationStatusMap(prev => {
        const next = new Map(prev)
        const summary = data.summary || computeSummary(data.devices || [])
        next.set(data.stationId, { ...data, summary })
        return next
      })
    }

    socket.on('stream-ready', handleStreamReady)
    socket.on('incoming-call', handleIncomingCall)
    socket.on('station-status-update', handleStationStatusUpdate)

    return () => {
      socket.off('stream-ready', handleStreamReady)
      socket.off('incoming-call', handleIncomingCall)
      socket.off('station-status-update', handleStationStatusUpdate)
    }
  }, [signaling, streams])

  return {
    streams,
    logs,
    onlineStations,
    stationStatusMap,
    incomingCalls,
    requestStream,
    closeStream,
    requestStationStatus,
    createRoom: signaling.createRoom,
    inviteStation: signaling.inviteStation,
    clearCall: (stationId: string) => {
        setIncomingCalls(prev => {
            const next = new Set(prev)
            next.delete(stationId)
            return next
        })
    }
  }
}
