"use client"

import React from 'react'
import { useConnectionStore } from '../app/store/connectionStore'

export function GlobalStatusIndicator() {
  const { signalingStatus, mqttStatus, signalingError, mqttError } = useConnectionStore()

  const hasError = signalingStatus === 'error' || mqttStatus === 'error'
  const isWarning = signalingStatus === 'connecting' || mqttStatus === 'connecting'
  const isHealthy = !hasError && !isWarning && signalingStatus === 'connected' && mqttStatus === 'connected'
  
  // Decide what to show. Signaling is critical, MQTT is secondary (usually)
  let statusText = '已连接'
  let colorClass = 'bg-emerald-500'
  let textColorClass = 'text-slate-700'
  
  if (signalingStatus === 'error') {
      statusText = '信令服务异常(websocket/redis)'
      colorClass = 'bg-rose-500'
      textColorClass = 'text-rose-600'
  } else if (mqttStatus === 'error') {
      statusText = '遥测服务中断(mqtt)'
      colorClass = 'bg-amber-500'
      textColorClass = 'text-amber-600'
  } else if (isWarning || signalingStatus === 'disconnected') {
      statusText = '未连接'
      colorClass = 'bg-slate-400'
      textColorClass = 'text-slate-500'
  }

  // Allow passing custom logic for "connecting" if needed, but basic mapping is here
  
  return (
    <div className="flex items-center gap-2" title={`信令: ${signalingStatus}, MQTT: ${mqttStatus}`}>
        <span className={`w-2 h-2 rounded-full ${colorClass} ${hasError ? 'animate-pulse' : ''}`}></span>
        <span className={`font-semibold ${textColorClass}`}>
            {statusText}
        </span>
    </div>
  )
}
