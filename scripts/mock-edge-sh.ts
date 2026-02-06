import { io } from 'socket.io-client'

const SIGNALING_URL = 'http://localhost:3101'
const STATION_ID = process.argv[2] || 'sh_01'

console.log(`[Edge] Starting Mock Edge Agent for station: ${STATION_ID}`)
console.log(`[Edge] Connecting to signaling server: ${SIGNALING_URL}`)

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

const deviceTemplates: DeviceStatusPayload[] = [
  { deviceId: 'cam_1', name: 'Gate Camera', type: 'camera', status: 'online', metrics: {} },
  { deviceId: 'cam_2', name: 'Lot Camera', type: 'camera', status: 'online', metrics: {} },
  { deviceId: 'sensor_1', name: 'Temp Sensor', type: 'sensor', status: 'online', metrics: {} },
  { deviceId: 'door_1', name: 'Access Controller', type: 'controller', status: 'online', metrics: {} },
]

const randomInRange = (min: number, max: number) => Math.round(min + Math.random() * (max - min))

const buildStatusPayload = (): StationStatusPayload => {
  const devices = deviceTemplates.map(device => {
    const battery = randomInRange(10, 100)
    const signal = randomInRange(20, 100)
    const temp = randomInRange(22, 70)
    const load = randomInRange(5, 95)
    const offline = Math.random() < 0.04

    let status: DeviceStatus = 'online'
    if (offline) {
      status = 'offline'
    } else if (battery < 15 || signal < 25 || temp > 62 || load > 90) {
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
    stationId: STATION_ID,
    updatedAt: Date.now(),
    devices,
    summary,
  }
}

const socket = io(SIGNALING_URL, {
  transports: ['websocket'],
  reconnection: true
})

let statusInterval: NodeJS.Timeout | null = null

const emitStatus = () => {
  socket.emit('station-status-update', buildStatusPayload())
}

const startStatusLoop = () => {
  emitStatus()
  if (statusInterval) clearInterval(statusInterval)
  statusInterval = setInterval(emitStatus, 5000)
}

socket.on('connect', () => {
  console.log(`[Edge] Connected to cloud! Socket ID: ${socket.id}`)
  
  // Register station
  socket.emit('register-station', { stationId: STATION_ID }, (res: any) => {
    console.log('[Edge] Registration response:', res)
  })

  startStatusLoop()
})

socket.on('disconnect', () => {
  console.log('[Edge] Disconnected from cloud')
  if (statusInterval) clearInterval(statusInterval)
})

socket.on('cmd-station-status', () => {
  emitStatus()
})

// Handle stream request (Signaling only for now)
socket.on('cmd-start-stream', (data: any) => {
  console.log(`[Edge] 📹 Received stream request for camera: ${data.cameraId}`)
  console.log(`[Edge] Request came from user: ${data.requesterId}`)
  
  // For Phase C (Status) & A (Reverse Call Prep), we just log this.
  // We can add WebRTC accept logic here later for Phase B.
})

// Handle Intercom Invite (Phase A)
socket.on('cmd-station-join-room', (data: any) => {
  console.log(`[Edge] 📞 Received intercom invite to Room: ${data.roomId} from ${data.inviterId}`)
  
  // Simulate joining the room (Signaling interaction)
  socket.emit('join-room', { roomId: data.roomId }, (res: any) => {
    if (res.error) {
        console.error('[Edge] Failed to join room:', res.error)
    } else {
        console.log(`[Edge] ✅ Successfully joined room! Peers in room: ${JSON.stringify(res.peers)}`)
        // In a real scenario, we would now start RTCPeerConnection here
    }
  })
})

socket.on('error', (err: any) => {
  console.error('[Edge] Socket Error:', err)
})
