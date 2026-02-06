"use client"
import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { useStationMonitor, MonitorStream, StationDeviceInfo, StationStatusPayload } from '../hooks/useStationMonitor'
import { VideoOff, Video, X, Phone, Activity, ShieldCheck, Cpu, Battery, Thermometer, Wifi, AlertTriangle, RefreshCw, Server } from 'lucide-react'
import { HUDVideoModal } from '../../components/HUDVideoModal'

// 简单的视频流播放组件
function MonitorPlayer({ stream }: { stream: MonitorStream }) {
  const videoRef = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    if (videoRef.current && stream.stream) {
      videoRef.current.srcObject = stream.stream
    }
  }, [stream.stream])

  return (
    <div className="relative bg-black aspect-video rounded-lg overflow-hidden border border-slate-200 shadow-md">
      {stream.status === 'playing' ? (
        <video 
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay 
          playsInline 
          controls={false}
          muted // 默认静音自动播放
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50 flex-col gap-2">
          {stream.status === 'requesting' && (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400"></div>
              <span className="text-xs font-medium">CONNECTING...</span>
            </>
          )}
          {stream.status === 'error' && (
            <>
              <VideoOff className="h-8 w-8 text-rose-500" />
              <span className="text-rose-500 font-medium">{stream.error || 'Connection Failed'}</span>
            </>
          )}
        </div>
      )}
      
      {/* 状态覆盖层 */}
      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs text-slate-700 shadow-sm font-medium border border-white/20">
        {stream.stationId} • {stream.cameraId}
      </div>
    </div>
  )
}

export default function IoTPage() {
  const { streams, logs, requestStream, closeStream, onlineStations, createRoom, inviteStation, incomingCalls, clearCall, stationStatusMap, requestStationStatus } = useStationMonitor()
  const [stationId, setStationId] = useState('')
  const [cameraId, setCameraId] = useState('cam_1')
  const [activeCallRoom, setActiveCallRoom] = useState<string | null>(null)
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)

  const selectedStationStatus: StationStatusPayload | undefined = useMemo(() => {
    if (!selectedStationId) return undefined
    return stationStatusMap.get(selectedStationId)
  }, [selectedStationId, stationStatusMap])
  
  const handleRequest = (sId: string = stationId) => {
    if (!sId || !cameraId) return
    requestStream(sId, cameraId)
    setStationId(sId)
  }

  const handleSelectStation = (sId: string) => {
    setSelectedStationId(sId)
    setStationId(sId)
    requestStationStatus(sId)
  }

  const statusMeta = (status: StationDeviceInfo['status']) => {
    switch (status) {
      case 'online':
        return { label: 'ONLINE', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
      case 'warning':
        return { label: 'WARN', badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
      case 'error':
        return { label: 'ERROR', badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' }
      default:
        return { label: 'OFFLINE', badge: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400' }
    }
  }

  const formatMetric = (value?: number, suffix: string = '') => {
    if (value === undefined || value === null) return '--'
    return `${value}${suffix}`
  }

  const handleCall = async (sId: string) => {
      try {
          const roomId = await createRoom()
          // 呼叫中状态清除可以后置，或者保留以显示"通话中"
          // clearCall(sId) 
          await inviteStation(sId, roomId)
          clearCall(sId)
          setActiveCallRoom(roomId)
      } catch (err) {
          console.error("Call failed", err)
      }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
       {/* 顶部导航栏 */}
       <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center px-8 z-50 shadow-sm">
          <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-800">
              <div className="bg-blue-600 rounded-lg p-1.5 shadow-lg shadow-blue-500/20">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
                总控平台
              </span>
              <span className="text-xs align-top bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-1 font-medium">PRO</span>
          </div>
          
          <div className="ml-auto flex items-center gap-6 text-sm font-medium text-slate-500">
             <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-slate-700">系统在线</span>
             </div>
             <div className="h-4 w-[1px] bg-slate-200"></div>
             <div>延迟: <span className="text-emerald-600 font-mono">24ms</span></div>
          </div>
       </header>

      <HUDVideoModal 
        isOpen={!!activeCallRoom} 
        onClose={() => setActiveCallRoom(null)}
        roomId={activeCallRoom}
        stationLabel="Live Intercom Session"
        subLabel="Secure Channel Established"
      />

      <div className="pt-24 max-w-[1600px] mx-auto h-[calc(100vh-1rem)] grid grid-cols-12 gap-6 px-6 pb-6">
        
        {/* 左侧控制栏 */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6 h-full overflow-hidden">
          
          {/* 在线设备树 */}
          <Card className="flex-1 overflow-hidden flex flex-col bg-white border-slate-200 shadow-sm ring-1 ring-slate-100">
             <CardHeader className="flex-shrink-0 pb-3 border-b border-slate-50">
              <CardTitle className="text-sm font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                在线设备
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4 flex-1 overflow-y-auto">
               {onlineStations.length === 0 ? (
                 <div className="text-slate-400 text-sm py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    未找到活动设备
                 </div>
               ) : (
                 onlineStations.map(station => {
                   const isCalling = incomingCalls.has(station)
                   return (
                   <div key={station} 
                        className={`group flex items-center justify-between p-3 rounded-lg border transition-all duration-200 cursor-pointer 
                        ${isCalling 
                            ? 'bg-rose-50 border-rose-200 shadow-sm' 
                            : 'bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-200'}`}
                        onClick={() => handleSelectStation(station)}
                   >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                            <span className={`absolute -inset-1 rounded-full animate-ping ${isCalling ? 'bg-rose-400/50' : 'bg-emerald-400/30'}`}></span>
                            <span className={`relative w-2.5 h-2.5 rounded-full block shadow-sm border border-white ${isCalling ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                        </div>
                        <div className="flex flex-col">
                            <span className={`text-sm font-bold ${isCalling ? 'text-rose-700' : 'text-slate-700'}`}>
                                {station}
                                {isCalling && <span className="ml-2 text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full animate-pulse border border-rose-200 font-semibold">CALLING</span>}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                              {stationStatusMap.get(station)?.summary
                                ? `在线 ${stationStatusMap.get(station)?.summary?.online || 0} · 预警 ${stationStatusMap.get(station)?.summary?.warning || 0} · 异常 ${stationStatusMap.get(station)?.summary?.error || 0}`
                                : 'IP: 192.168.1.X'}
                            </span>
                        </div>
                      </div>
                      <div className={`flex gap-1 transition-opacity ${isCalling ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <Button size="icon" variant="ghost" className="h-8 w-8 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-full shadow-sm" onClick={(e) => { e.stopPropagation(); handleRequest(station) }} title="Monitor">
                            <Video className="h-4 w-4" />
                        </Button>
                        <Button 
                            size={isCalling ? "sm" : "icon"} 
                            className={`h-8 rounded-full shadow-none transition-all duration-300
                                ${isCalling 
                                    ? 'w-auto px-4 bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-200 border-0' 
                                    : 'w-8 bg-transparent hover:bg-emerald-50 text-emerald-600 border border-transparent hover:border-emerald-100'
                                }`} 
                            onClick={(e) => { e.stopPropagation(); handleCall(station) }} 
                            title="Call"
                        >
                            {isCalling ? (
                                <span className="flex items-center gap-1.5 font-bold text-xs"><Phone className="h-3.5 w-3.5 fill-current" /> Answer</span>
                            ) : (
                                <Phone className="h-4 w-4" />
                            )}
                        </Button>
                      </div>
                   </div>
                 )
                 })
               )}
            </CardContent>
          </Card>

          {/* 活跃会话 */}
          <Card className="bg-white border-slate-200 shadow-sm ring-1 ring-slate-100">
            <CardHeader className="pb-3 border-b border-slate-50">
              <CardTitle className="text-sm font-semibold text-slate-800 uppercase tracking-wide">活跃会话</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {streams.size === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2 italic">暂无活跃流</p>
              ) : (
                <ul className="space-y-2">
                  {Array.from(streams.values()).map(s => (
                    <li key={`${s.stationId}:${s.cameraId}`} className="flex items-center justify-between p-2 pl-3 bg-amber-50 rounded-md border border-amber-100 text-xs font-medium">
                      <span className="text-amber-700 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        {s.stationId} <span className="text-amber-400">/</span> {s.cameraId}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-full" 
                        onClick={() => closeStream(s.stationId, s.cameraId)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 中间监控墙 */}
        <div className="col-span-12 lg:col-span-6 h-full flex flex-col overflow-hidden gap-4">
          <Card className="bg-white border-slate-200 shadow-sm ring-1 ring-slate-100">
            <CardHeader className="pb-3 border-b border-slate-50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-500" />
                站点设备状态
              </CardTitle>
              <div className="flex items-center gap-2">
                {selectedStationId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-slate-500 hover:text-indigo-600"
                    onClick={() => requestStationStatus(selectedStationId)}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> 刷新
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {!selectedStationId && (
                <div className="text-slate-400 text-sm py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  请选择一个站点以查看设备状态
                </div>
              )}
              {selectedStationId && !selectedStationStatus && (
                <div className="text-slate-400 text-sm py-8 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  正在加载设备状态...
                </div>
              )}
              {selectedStationId && selectedStationStatus && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{selectedStationStatus.stationId}</span>
                    <span>更新时间: {new Date(selectedStationStatus.updatedAt).toLocaleTimeString()}</span>
                    {selectedStationStatus.summary && (
                      <span className="flex items-center gap-2">
                        <span className="text-emerald-600">在线 {selectedStationStatus.summary.online}</span>
                        <span className="text-amber-600">预警 {selectedStationStatus.summary.warning}</span>
                        <span className="text-rose-600">异常 {selectedStationStatus.summary.error}</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedStationStatus.devices.map(device => {
                      const meta = statusMeta(device.status)
                      return (
                        <div key={device.deviceId} className="p-3 rounded-lg border border-slate-100 bg-slate-50/40">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${meta.dot}`}></span>
                              <div>
                                <div className="text-sm font-semibold text-slate-800">{device.name}</div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-wide">{device.type} · {device.deviceId}</div>
                              </div>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${meta.badge}`}>{meta.label}</span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                            <div className="flex items-center gap-1.5"><Thermometer className="w-3.5 h-3.5 text-slate-400" /> {formatMetric(device.metrics?.temp, '°C')}</div>
                            <div className="flex items-center gap-1.5"><Battery className="w-3.5 h-3.5 text-slate-400" /> {formatMetric(device.metrics?.battery, '%')}</div>
                            <div className="flex items-center gap-1.5"><Wifi className="w-3.5 h-3.5 text-slate-400" /> {formatMetric(device.metrics?.signal, '%')}</div>
                            <div className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-slate-400" /> {formatMetric(device.metrics?.load, '%')}</div>
                          </div>
                          {device.status === 'warning' || device.status === 'error' ? (
                            <div className="mt-2 text-[11px] text-amber-700 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> 检查设备健康
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 content-start overflow-y-auto pr-2">
            {Array.from(streams.values()).map(stream => (
              <MonitorPlayer 
                key={`${stream.stationId}:${stream.cameraId}`} 
                stream={stream} 
              />
            ))}
            {streams.size === 0 && (
              <div className="col-span-1 lg:col-span-2 h-full min-h-[320px] bg-white border border-slate-200 rounded-2xl flex items-center justify-center relative overflow-hidden shadow-sm group">
                 <div className="absolute inset-0 bg-slate-50/50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]" />
                 <div className="relative text-center space-y-4">
                     <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-lg shadow-slate-200/50 text-slate-300 mb-2">
                        <VideoOff className="w-8 h-8" />
                     </div>
                     <div className="space-y-1">
                        <p className="text-slate-900 font-semibold text-lg">暂无活跃流</p>
                        <p className="text-slate-500 text-sm max-w-xs mx-auto">请选择设备网络列表中的站点以开始监控</p>
                     </div>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧日志 */}
        <div className="col-span-12 lg:col-span-3 h-full overflow-hidden">
          <Card className="h-full bg-white border-slate-200 shadow-sm flex flex-col font-mono text-xs ring-1 ring-slate-100">
            <CardHeader className="flex-shrink-0 py-3 px-4 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between items-center">
                系统事件日志
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 relative bg-white">
              <div className="absolute inset-0 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-3 text-[11px] leading-relaxed border-b border-slate-50 pb-2 last:border-0">
                     <span className="text-slate-400 shrink-0 font-medium select-none">{log.match(/\[(.*?)\]/)?.[1] || '00:00:00'}</span>
                     <span className={log.includes('失败') || log.includes('error') ? 'text-rose-600 font-medium' : 'text-slate-600'}>
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
