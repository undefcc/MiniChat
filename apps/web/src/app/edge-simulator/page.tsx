"use client"

import React, { useEffect, useRef, useState } from 'react'
import { useSocketSignaling } from '../hooks/useSocketSignaling'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Video, Globe, Activity, ShieldCheck, MonitorPlay, Phone, VideoOff } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { HUDVideoModal } from '../../components/HUDVideoModal'

export default function EdgeSimulatorPage() {
  const searchParams = useSearchParams()
  const initialStationId = searchParams.get('id') || `web_cam_${Math.floor(Math.random() * 1000)}`

  const [stationId, setStationId] = useState(initialStationId)
  const [isRegistered, setIsRegistered] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  
  // Room State
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const signaling = useSocketSignaling()

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50))
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
        addLog('System: Camera initialized')
      } catch (e: any) {
        addLog(`Error: Camera access denied - ${e.message}`)
      }
    }
    initCamera()
  }, [])

  // 2. 注册站点
  const handleRegister = async () => {
    if (!stationId) return
    try {
      await signaling.connect()
      const socket = signaling.getSocket()
      if (socket) {
        socket.emit('register-station', { stationId })
        setIsRegistered(true)
        addLog(`System: Device registered as ${stationId}`)
        
        // 监听指令
        socket.on('cmd-station-join-room', handleInvite)
      }
    } catch (e: any) {
      addLog(`Error: Connection failed - ${e.message}`)
    }
  }

  // 3. 处理邀请
  const handleInvite = async (data: { roomId: string, inviterId: string }) => {
      addLog(`Event: Incoming Call from ${data.inviterId}`)
      joinRoom(data.roomId)
  }

  // 5. 呼叫总控
  const handleCallCenter = () => {
      const socket = signaling.getSocket()
      if (socket) {
          socket.emit('station-call-center', { stationId })
          addLog('Action: Calling Control Center...')
      }
  }
  
  // 4. 加入房间逻辑
  const joinRoom = (roomId: string) => {
      addLog(`System: Joining secure channel ${roomId}...`)
      setActiveRoomId(roomId)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
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
                EdgeSimulator
              </span>
              <span className="text-xs align-top bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-1 font-medium">DEVICE</span>
          </div>
          
          <div className="ml-auto flex items-center gap-6 text-sm font-medium text-slate-500">
             <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isRegistered ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                <span className="text-slate-700">{isRegistered ? 'Online' : 'Offline'}</span>
             </div>
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
                Device Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                {!isRegistered ? (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-slate-500 uppercase">Station ID</Label>
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
                            Connect to Network
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg text-center space-y-1">
                            <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Status</div>
                            <div className="text-lg font-bold text-emerald-900">ONLINE & READY</div>
                            <div className="text-xs font-mono text-emerald-600/70">{stationId}</div>
                        </div>
                        <Button 
                            variant="destructive" 
                            size="lg" 
                            className="w-full h-14 text-base font-bold shadow-lg shadow-rose-100 hover:bg-rose-600 border border-rose-200" 
                            onClick={handleCallCenter}
                        >
                            <Phone className="w-5 h-5 mr-3 animate-pulse" />
                            Call Center
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
                    <h4 className="font-semibold text-blue-900">Edge Simulation Mode</h4>
                    <p className="opacity-80 mt-1">This page simulates a physical device or kiosk. It streams the local camera and can initiate or receive calls from the central monitoring dashboard.</p>
                </div>
            </div>
        </div>

        {/* 右侧日志 */}
        <div className="col-span-12 lg:col-span-3">
          <Card className="h-[calc(100vh-140px)] bg-white border-slate-200 shadow-sm flex flex-col font-mono text-xs ring-1 ring-slate-100">
            <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between items-center">
                Device Logs
                <Activity className="w-3.5 h-3.5 text-slate-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 relative bg-white">
              <div className="absolute inset-0 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {logs.length === 0 && (
                    <div className="text-slate-300 italic text-center py-10">System ready...</div>
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
