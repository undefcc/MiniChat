import { useState, useRef, useCallback } from 'react'
import { MEDIA_CONSTRAINTS, RTC_CONFIGURATION, getIceServers } from '../config/webrtc.config'
import { createLogger } from '../utils/logger'

const log = createLogger('WebRTC')

export function useWebRTC() {
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  // 初始化本地媒体流（带内存优化配置）
  const startLocalStream = useCallback(async () => {
    try {
      // 先尝试获取视频和音频
      log.debug('📹 Requesting video + audio...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: MEDIA_CONSTRAINTS.video,
        audio: MEDIA_CONSTRAINTS.audio,
      })
      log.info('✅ Got video + audio')
      setLocalStream(stream)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      return stream
    } catch (error) {
      log.error('Error accessing video/audio:', error)
      
      // 如果失败，尝试只获取音频
      try {
        log.info('🎤 Trying audio only...')
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        })
        log.info('✅ Got audio only, no video')
        setLocalStream(audioStream)
        return audioStream
      } catch (audioError) {
        log.error('Error accessing audio:', audioError)
        // 即使没有媒体设备，也返回一个空流，允许纯数据通道连接
        log.warn('⚠️ No media devices available, proceeding with receive-only mode')
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
    const iceServers = getIceServers()
    
    // 安全地显示 TURN 配置状态（不暴露完整密码）
    const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME
    const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL
    
    // 使用 warn 级别确保生产环境可见（用于诊断 NAT 穿透问题）
    log.warn('🔍 TURN Configuration Status:')
    log.warn(`  Username: ${turnUsername ? `✅ ${turnUsername.substring(0, 8)}...` : '❌ MISSING'}`)
    log.warn(`  Credential: ${turnCredential ? `✅ ${turnCredential.substring(0, 4)}****` : '❌ MISSING'}`)
    log.warn(`  Total ICE Servers: ${iceServers.length}`)
    
    // 显示所有 ICE 服务器（隐藏凭据）
    iceServers.forEach((server, idx) => {
      const urls = typeof server.urls === 'string' ? [server.urls] : server.urls
      log.warn(`  Server ${idx + 1}: ${urls.join(', ')}${server.username ? ' (with auth)' : ''}`)
    })
    
    log.debug('🔧 Creating PeerConnection with', iceServers.length, 'ICE servers')
    const pc = new RTCPeerConnection({ 
      iceServers,
      ...RTC_CONFIGURATION,
    })

    pc.ontrack = (event) => {
      log.debug('📡 ontrack event:', event.track.kind, event.streams)
      onTrack(event)
    }
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const type = event.candidate.type
        const protocol = event.candidate.protocol
        const address = event.candidate.address
        const relatedAddress = event.candidate.relatedAddress
        
        // 详细日志，帮助诊断 TURN 是否工作
        if (type === 'relay') {
          log.warn(`🎯 ✨ Generated RELAY candidate (${protocol}): TURN is working!`)
        } else if (type === 'srflx') {
          log.debug(`🧊 Generated SRFLX candidate (${protocol}): ${address}`)
        } else {
          log.debug(`🧊 Generated ${type} candidate (${protocol}): ${address || 'N/A'}`)
        }
        
        onIceCandidate(event.candidate)
      } else {
        log.debug('✅ Gathering complete')
      }
    }
    
    // ICE 收集状态变化
    pc.onicegatheringstatechange = () => {
      log.debug('🔄 Gathering state:', pc.iceGatheringState)
    }

    pc.oniceconnectionstatechange = () => {
      log.warn('🔌 ICE Connection state:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setIsConnected(true)
      }
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        setIsConnected(false)
      }
    }

    pc.onconnectionstatechange = () => {
      log.debug('🔗 Connection state:', pc.connectionState)
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

  // 清理资源（内存优化版）
  const cleanup = useCallback(() => {
    log.info('🧹 Cleaning up resources...')
    
    // 关闭 PeerConnection
    setPeerConnection(prev => {
      if (prev) {
        prev.close()
        log.debug('✅ PeerConnection closed')
      }
      return null
    })
    
    // 停止并释放本地流
    setLocalStream(prev => {
      if (prev) {
        prev.getTracks().forEach(track => {
          track.stop()
          log.debug(`🛑 Stopped local track: ${track.kind}`)
        })
      }
      return null
    })
    
    // 停止并释放远程流
    setRemoteStream(prev => {
      if (prev) {
        prev.getTracks().forEach(track => {
          track.stop()
          log.debug(`🛑 Stopped remote track: ${track.kind}`)
        })
      }
      return null
    })
    
    // 清除 video 元素的 srcObject 以释放内存
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
    
    remoteStreamRef.current = null
    setIsConnected(false)
    
    log.info('✅ All resources cleaned up')
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
