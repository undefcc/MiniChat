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
