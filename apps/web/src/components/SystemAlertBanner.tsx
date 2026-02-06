"use client"

import React from 'react'
import { AlertTriangle, Wifi, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import { useConnectionStore } from '../app/store/connectionStore'

export function SystemAlertBanner() {
  const { signalingError, mqttError, retryAll } = useConnectionStore()
  
  const error = signalingError || mqttError
  const type = signalingError ? 'Signaling' : 'MQTT'

  if (!error) return null

  return (
    <div className="fixed top-0 left-0 right-0 h-10 bg-rose-500 text-white px-8 flex items-center justify-between z-[60] shadow-md animate-in slide-in-from-top duration-300">
        <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4" />
        <span>System Connectivity Issue ({type}): {error}</span>
        </div>
        <Button 
            variant="outline" 
            size="sm" 
            onClick={retryAll} 
            className="h-7 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20 border-transparent gap-2"
        >
        <RefreshCw className="w-3 h-3" />
        Retry Connection
        </Button>
    </div>
  )
}
