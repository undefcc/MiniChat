import { useState, useRef, useCallback, useEffect } from 'react'

// ICE 服务器配置（从环境变量读取）
const getIceServers = () => {
  const servers: RTCIceServer[] = [
    // STUN 服务器（免费公共服务）
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]

  // TURN 服务器配置（从环境变量读取，避免硬编码凭证）
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL

  if (turnUsername && turnCredential) {
    console.log('🔧 [WebRTC] TURN server configured:', 'global.relay.metered.ca')
    servers.push(
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: turnUsername,
        credential: turnCredential,
      }
    )
  } else {
    console.warn('⚠️ [WebRTC] TURN server credentials not configured. Only STUN will be available.')
  }

  console.log('🔧 [WebRTC] ICE servers configured:', servers.length, 'servers')
  return servers
}

const ICE_SERVERS = getIceServers()

export function useWebRTC() {
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  // 初始化本地媒体流
  const startLocalStream = useCallback(async () => {
    try {
      // 先尝试获取视频和音频
      console.log('📹 [WebRTC] Requesting video + audio...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
      console.log('✅ [WebRTC] Got video + audio')
      setLocalStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      return stream
    } catch (error) {
      console.error('❌ [WebRTC] Error accessing video/audio:', error)
      
      // 如果失败，尝试只获取音频
      try {
        console.log('🎤 [WebRTC] Trying audio only...')
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        })
        console.log('✅ [WebRTC] Got audio only, no video')
        setLocalStream(audioStream)
        return audioStream
      } catch (audioError) {
        console.error('❌ [WebRTC] Error accessing audio:', audioError)
        // 即使没有媒体设备，也返回一个空流，允许纯数据通道连接
        console.log('⚠️ [WebRTC] No media devices available, proceeding with receive-only mode')
        const emptyStream = new MediaStream()
        setLocalStream(emptyStream)
        return emptyStream
      }
    }
  }, [])

  // 创建 PeerConnection
  const createPeerConnection = useCallback((
    onTrack: (event: RTCTrackEvent) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void
  ) => {
    console.log('🔧 [WebRTC] Creating PeerConnection with', ICE_SERVERS.length, 'ICE servers')
    const pc = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10, // 预收集候选
    })

    pc.ontrack = (event) => {
      console.log('📡 [WebRTC] ontrack event:', event.track.kind, event.streams)
      onTrack(event)
    }
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const type = event.candidate.type
        const protocol = event.candidate.protocol
        const address = event.candidate.address
        console.log(`🧊 [ICE] Generated ${type} candidate (${protocol}):`, address || 'relay')
        onIceCandidate(event.candidate)
      } else {
        console.log('✅ [ICE] Gathering complete')
      }
    }
    
    // ICE 收集状态变化
    pc.onicegatheringstatechange = () => {
      console.log('🔄 [ICE] Gathering state:', pc.iceGatheringState)
    }

    pc.oniceconnectionstatechange = () => {
      console.log('🔌 [ICE] Connection state:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setIsConnected(true)
      }
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        setIsConnected(false)
      }
    }

    pc.onconnectionstatechange = () => {
      console.log('🔗 [WebRTC] Connection state:', pc.connectionState)
    }

    // 不再预先添加 transceiver，改为在 addLocalStream 中统一处理
    setPeerConnection(pc)
    return pc
  }, [])

  // 添加本地流到 PeerConnection
  // hasLocalMedia: 是否有本地媒体（摄像头/麦克风）
  const addLocalStream = useCallback((pc: RTCPeerConnection, stream: MediaStream) => {
    const hasVideo = stream.getVideoTracks().length > 0
    const hasAudio = stream.getAudioTracks().length > 0
    
    console.log('addLocalStream:', { hasVideo, hasAudio, tracks: stream.getTracks().map(t => t.kind) })

    // 如果有本地轨道，直接添加（会自动创建 sendrecv transceiver）
    if (stream.getTracks().length > 0) {
      stream.getTracks().forEach(track => {
        console.log('Adding track:', track.kind)
        pc.addTrack(track, stream)
      })
    }

    // 如果没有视频轨道，添加 recvonly transceiver 以接收对方视频
    if (!hasVideo) {
      console.log('No local video, adding recvonly video transceiver')
      pc.addTransceiver('video', { direction: 'recvonly' })
    }

    // 如果没有音频轨道，添加 recvonly transceiver 以接收对方音频
    if (!hasAudio) {
      console.log('No local audio, adding recvonly audio transceiver')
      pc.addTransceiver('audio', { direction: 'recvonly' })
    }
  }, [])

  // 用于累积远程轨道的 ref
  const remoteStreamRef = useRef<MediaStream | null>(null)

  // 处理远程流
  const handleRemoteTrack = useCallback((event: RTCTrackEvent) => {
    console.log('📥 [WebRTC] handleRemoteTrack:', event.track.kind, 'readyState:', event.track.readyState, 'streams:', event.streams.length)
    
    // 使用 event.streams[0] 或创建/复用一个 MediaStream
    if (!remoteStreamRef.current) {
      remoteStreamRef.current = event.streams[0] || new MediaStream()
      console.log('📥 [WebRTC] Created new remote stream')
    }
    
    const stream = remoteStreamRef.current
    
    // 如果 track 不在 stream 中，添加它
    if (!stream.getTracks().includes(event.track)) {
      // 移除相同类型的旧 track（如果有）
      stream.getTracks()
        .filter(t => t.kind === event.track.kind)
        .forEach(t => {
          console.log('📥 [WebRTC] Removing old track:', t.kind)
          stream.removeTrack(t)
        })
      stream.addTrack(event.track)
      console.log('📥 [WebRTC] Added track:', event.track.kind, 'total tracks:', stream.getTracks().length)
    }
    
    // 强制触发 React 状态更新（创建新引用）
    const newStream = new MediaStream(stream.getTracks())
    console.log('📥 [WebRTC] Updating remote stream state with tracks:', newStream.getTracks().map(t => t.kind).join(', '))
    setRemoteStream(newStream)
    
    // 同时直接设置到 video 元素，确保显示
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = newStream
      console.log('📥 [WebRTC] Set remote stream to video element')
    }
  }, [])

  // 清理资源
  const cleanup = useCallback(() => {
    setPeerConnection(prev => {
      if (prev) {
        prev.close()
      }
      return null
    })
    setLocalStream(prev => {
      if (prev) {
        prev.getTracks().forEach(track => track.stop())
      }
      return null
    })
    setRemoteStream(prev => {
      if (prev) {
        prev.getTracks().forEach(track => track.stop())
      }
      return null
    })
    remoteStreamRef.current = null
    setIsConnected(false)
  }, [])

  return {
    peerConnection,
    localStream,
    remoteStream,
    isConnected,
    localVideoRef,
    remoteVideoRef,
    startLocalStream,
    createPeerConnection,
    addLocalStream,
    handleRemoteTrack,
    cleanup
  }
}
