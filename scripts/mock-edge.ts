import { io } from 'socket.io-client'

const SIGNALING_URL = 'http://localhost:3101'
const STATION_ID = process.argv[2] || 'bj_01'

console.log(`[Edge] Starting Mock Edge Agent for station: ${STATION_ID}`)
console.log(`[Edge] Connecting to signaling server: ${SIGNALING_URL}`)

const socket = io(SIGNALING_URL, {
  transports: ['websocket'],
  reconnection: true
})

socket.on('connect', () => {
  console.log(`[Edge] Connected to cloud! Socket ID: ${socket.id}`)
  
  // Register station
  socket.emit('register-station', { stationId: STATION_ID }, (res: any) => {
    console.log('[Edge] Registration response:', res)
  })
})

socket.on('disconnect', () => {
  console.log('[Edge] Disconnected from cloud')
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
