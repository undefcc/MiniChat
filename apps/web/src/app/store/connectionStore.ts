import { create } from 'zustand'

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'connecting'

interface ConnectionState {
  // Signaling (Redis/Socket) status
  signalingStatus: ConnectionStatus
  signalingError: string | null

  // MQTT status
  mqttStatus: ConnectionStatus
  mqttError: string | null

  // Computed/Helper
  getHighestPriorityError: () => string | null
  
  // Actions
  setSignalingStatus: (status: ConnectionStatus, error?: string | null) => void
  setMqttStatus: (status: ConnectionStatus, error?: string | null) => void
  retryAll: () => void
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  signalingStatus: 'disconnected',
  signalingError: null,
  mqttStatus: 'disconnected',
  mqttError: null,

  getHighestPriorityError: () => {
      const state = get()
      if (state.signalingError) return `Signaling: ${state.signalingError}`
      if (state.mqttError) return `MQTT: ${state.mqttError}`
      return null
  },

  setSignalingStatus: (status, error = null) => set({ 
      signalingStatus: status, 
      signalingError: error 
  }),

  setMqttStatus: (status, error = null) => set({ 
      mqttStatus: status, 
      mqttError: error 
  }),

  retryAll: () => {
      // Logic to trigger retries. This might just reset errors or can be hooked up to reloading.
      // For now we just reload as it's the safest "retry everything"
      if (typeof window !== 'undefined') {
          window.location.reload()
      }
  }
}))
