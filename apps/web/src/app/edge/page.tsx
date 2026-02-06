"use client"

import React, { useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'
import { useSocketSignaling } from '../hooks/useSocketSignaling'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Video, Globe, Activity, ShieldCheck, MonitorPlay, Phone, VideoOff } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { HUDVideoModal } from '@/components/HUDVideoModal'

type DeviceStatus = 'online' | 'offline' | 'warning' | 'error'

interface DeviceStatusPayload {
  deviceId: string
  name: string
  type: string
  status: DeviceStatus
  metrics: {
    temp?: number
    battery?: number
    signal?: number
    load?: number
  }
}

interface StationStatusPayload {
  stationId: string
  updatedAt: number
  devices: DeviceStatusPayload[]
  summary: {
    online: number
    offline: number
    warning: number
    error: number
  }
}

import { SystemAlertBanner } from '@/components/SystemAlertBanner'
import { GlobalStatusIndicator } from '@/components/GlobalStatusIndicator'
import { useConnectionStore } from '@/app/store/connectionStore'

export default function EdgePage() {
  const searchParams = useSearchParams()
  const initialStationId = searchParams.get('id') || `web_edge_${Math.floor(Math.random() * 1000)}`

  const [stationId, setStationId] = useState(initialStationId)
  const [isRegistered, setIsRegistered] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const setMqttStatus = useConnectionStore(s => s.setMqttStatus)
  const setSignalingStatus = useConnectionStore(s => s.setSignalingStatus)
  
  // Room State
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const mqttLoggedErrorRef = useRef(false)
  const signaling = useSocketSignaling()
  const baseDevicesRef = useRef<DeviceStatusPayload[]>([
    { deviceId: 'cam_1', name: 'Entrance Camera', type: 'camera', status: 'online', metrics: {} },
    { deviceId: 'cam_2', name: 'Yard Camera', type: 'camera', status: 'online', metrics: {} },
    { deviceId: 'sensor_1', name: 'Temp Sensor', type: 'sensor', status: 'online', metrics: {} },
    { deviceId: 'door_1', name: 'Access Gate', type: 'controller', status: 'online', metrics: {} },
  ])

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50))
  }

  const randomInRange = (min: number, max: number) => Math.round(min + Math.random() * (max - min))

  const buildStatusPayload = (): StationStatusPayload => {
    const devices = baseDevicesRef.current.map(device => {
      const battery = randomInRange(12, 100)
      const signal = randomInRange(20, 100)
      const temp = randomInRange(24, 72)
      const load = randomInRange(5, 95)
      const offline = Math.random() < 0.03
      let status: DeviceStatus = 'online'

      if (offline) {
        status = 'offline'
      } else if (battery < 15 || signal < 25 || temp > 65 || load > 90) {
        status = 'error'
      } else if (battery < 30 || signal < 40 || temp > 55 || load > 80) {
        status = 'warning'
      }

      return {
        ...device,
        status,
        metrics: { temp, battery, signal, load },
      }
    })

    const summary = devices.reduce<Record<DeviceStatus, number>>(
      (acc, device) => {
        acc[device.status] += 1
        return acc
      },
      { online: 0, offline: 0, warning: 0, error: 0 }
    )

    return {
      stationId,
      updatedAt: Date.now(),
      devices,
      summary,
    }
  }

  // 1. 初始化摄像头
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 }, 
            audio: true 
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        addLog('系统：摄像头初始化完成')
      } catch (e: any) {
        addLog(`⚠警告：无法访问摄像头 - ${e.message}`)
      }
    }
    initCamera()
  }, [])

  // 2. 注册站点
  const handleRegister = async () => {
    if (!stationId) return
    try {
      setSignalingStatus('connecting')
      await signaling.connect()
      setSignalingStatus('connected')
      
      // 等待注册确认
      await signaling.registerStation(stationId)
      
      setIsRegistered(true)
      addLog(`系统：设备注册成功 - ${stationId}`)
      
      const socket = signaling.getSocket()
      if (socket) {
        // 监听指令
        socket.on('cmd-station-join-room', handleInvite)
        socket.on('disconnect', () => {
            setSignalingStatus('disconnected')
            addLog('警告：信令服务断开')
        })
      }
    } catch (e: any) {
      setSignalingStatus('error', e.message)
      addLog(`错误：注册失败 - ${e.message}`)
      console.error(e)
    }
  }

  // 3. 处理邀请
  const handleInvite = async (data: { roomId: string, inviterId: string }) => {
      addLog(`事件：收到呼叫 - ${data.inviterId}`)
      joinRoom(data.roomId)
  }

  // 5. 呼叫总控
  const handleCallCenter = () => {
      const socket = signaling.getSocket()
      if (socket) {
          socket.emit('station-call-center', { stationId })
          addLog('操作：正在呼叫总控中心...')
      }
  }
  
  // 4. 加入房间逻辑
  const joinRoom = (roomId: string) => {
      addLog(`系统：正在加入加密通道 ${roomId}...`)
      setActiveRoomId(roomId)
  }

  // 6. 周期性上报设备状态 (MQTT)
  useEffect(() => {
    if (!isRegistered) return

    // MQTT Configuration
    // Note: Browser requires MQTT over WebSockets. Ensure your broker supports it (e.g. port 8083).
    const MQTT_BROKER_URL = 'ws://localhost:8083/mqtt'
    
    addLog(`系统：正在连接 MQTT 服务 ${MQTT_BROKER_URL}...`)
    
    let client: mqtt.MqttClient | null = null;
    
    try {
        setMqttStatus('connecting')
        client = mqtt.connect(MQTT_BROKER_URL)

        client.on('connect', () => {
             mqttLoggedErrorRef.current = false
             addLog('系统：MQTT 服务已连接')
             setMqttStatus('connected')
        })
        
        client.on('error', (err) => {
             if (!mqttLoggedErrorRef.current) {
                 addLog(`错误：MQTT 异常 - ${err.message}`)
                 console.error('MQTT Error:', err)
                 setMqttStatus('error', err.message)
                 mqttLoggedErrorRef.current = true
             }
        })

        client.on('offline', () => {
             if (!mqttLoggedErrorRef.current) {
                 addLog(`警告：MQTT 服务断开`)
                 setMqttStatus('disconnected')
             }
        })
    } catch (err: any) {
        addLog(`错误：MQTT 连接失败 - ${err.message}`)
        setMqttStatus('error', err.message)
    }

    const emitStatus = () => {
      if (client && client.connected) {
          const payload = buildStatusPayload()
          client.publish(`stations/${stationId}/status`, JSON.stringify(payload))
      }
    }

    // Initial emit
    emitStatus()
    const interval = setInterval(emitStatus, 5000)

    return () => {
      clearInterval(interval)
      if (client) {
          client.end()
      }
    }
  }, [isRegistered, stationId])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <SystemAlertBanner />
      <HUDVideoModal
         isOpen={!!activeRoomId}
         onClose={() => setActiveRoomId(null)}
         roomId={activeRoomId} 
         iframeExtraParams="?autoJoin=true"
         stationLabel={`${stationId.toUpperCase()}`}
         subLabel="SECURE CONNECTION ACTIVE"
      />

       {/* 顶部导航栏 */}
       <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center px-8 z-50 shadow-sm">
          <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-800">
              <div className="bg-emerald-600 rounded-lg p-1.5 shadow-lg shadow-emerald-500/20">
                <MonitorPlay className="w-5 h-5 text-white" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-teal-600">
                边缘终端
              </span>
              <span className="text-xs align-top bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-1 font-medium">DEVICE</span>
          </div>
          
          <div className="ml-auto flex items-center space-x-6 text-sm font-medium text-slate-500">
             <GlobalStatusIndicator />
             <div className="h-4 w-[1px] bg-slate-200"></div>
             <div>v1.0.2</div>
          </div>
       </header>

      <div className="pt-24 max-w-[1600px] mx-auto grid grid-cols-12 gap-6 px-6 pb-6">
        
        {/* 左侧控制栏 */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <Card className="bg-white border-slate-200 shadow-sm ring-1 ring-slate-100">
             <CardHeader className="pb-3 border-b border-slate-50">
              <CardTitle className="text-sm font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                设备状态
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                {!isRegistered ? (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-slate-500 uppercase">站点编号</Label>
                            <Input 
                                value={stationId} 
                                onChange={e => setStationId(e.target.value)} 
                                className="font-mono bg-slate-50 border-slate-200 focus-visible:ring-emerald-500"
                            />
                        </div>
                        <Button 
                            onClick={handleRegister} 
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100"
                        >
                            <Globe className="w-4 h-4 mr-2" />
                            连接网络
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg text-center space-y-1">
                            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">运行状态</div>
                            <div className="text-lg font-bold text-emerald-900">在线就绪</div>
                            <div className="text-xs font-mono text-emerald-600/70">{stationId}</div>
                        </div>
                        <Button 
                            variant="destructive" 
                            size="lg" 
                            className="w-full h-14 text-base font-bold shadow-lg shadow-rose-100 hover:bg-rose-600 border border-rose-200" 
                            onClick={handleCallCenter}
                        >
                            <Phone className="w-5 h-5 mr-3 animate-pulse" />
                            呼叫总控中心
                        </Button>
                    </div>
                )}
            </CardContent>
          </Card>
        </div>

        {/* 中间监控墙 */}
        <div className="col-span-12 lg:col-span-6 flex flex-col">
            <div className="relative bg-black aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-md ring-1 ring-slate-100 group">
                <video 
                    ref={videoRef} 
                    className="w-full h-full object-cover" 
                    autoPlay 
                    muted 
                    playsInline 
                />
                
                {/* 叠加层 */}
                <div className="absolute top-4 left-4 flex gap-2">
                     <span className="bg-black/60 backdrop-blur-md text-white/90 px-3 py-1.5 rounded-md text-xs font-mono font-medium border border-white/10 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        LIVE
                     </span>
                     {isRegistered && (
                        <span className="bg-emerald-500/90 backdrop-blur-md text-white px-3 py-1.5 rounded-md text-xs font-mono font-medium shadow-sm">
                            {stationId}
                        </span>
                     )}
                </div>

                {!videoRef.current && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-400">
                        <VideoOff className="w-12 h-12 opacity-50" />
                    </div>
                )}
            </div>
            
            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-900/80 text-sm flex gap-3 items-start">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-semibold text-blue-900">边缘终端模拟模式</h4>
                    <p className="opacity-80 mt-1">此页面模拟物理设备或自助终端。它将流式传输本地摄像头画面，并定期向监控仪表板报告设备遥测数据。</p>
                </div>
            </div>
        </div>

        {/* 右侧日志 */}
        <div className="col-span-12 lg:col-span-3">
          <Card className="h-[calc(100vh-140px)] bg-white border-slate-200 shadow-sm flex flex-col font-mono text-xs ring-1 ring-slate-100">
            <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between items-center">
                运行日志
                <Activity className="w-3.5 h-3.5 text-slate-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 relative bg-white">
              <div className="absolute inset-0 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {logs.length === 0 && (
                    <div className="text-slate-300 italic text-center py-10">系统就绪...</div>
                )}
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3 text-[11px] leading-relaxed border-b border-slate-50 pb-2 last:border-0 hover:bg-slate-50 transition-colors rounded px-1 -mx-1">
                     <span className="text-slate-400 shrink-0 font-medium select-none">{log.match(/\[(.*?)\]/)?.[1] || '00:00:00'}</span>
                     <span className={log.toLowerCase().includes('error') ? 'text-rose-600 font-medium' : 'text-slate-600'}>
                        {log.replace(/\[.*?\] /, '')}
                     </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
