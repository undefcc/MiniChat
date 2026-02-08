import { useState, useCallback, useRef } from 'react'
import { useWebRTC } from './useWebRTC'
import { useDataChannel } from './useDataChannel'
import { request } from '../utils/request'
import * as wsBus from '../services/wsBus'
import { WS_EVENTS } from '../services/wsConstants'
import { VideoQualityProfile } from '../config/webrtc.config'

export function useVideoChat() {
  const [roomId, setRoomId] = useState('')
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected'>('idle')
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [remotePeerId, setRemotePeerId] = useState<string | null>(null)
  
  const {
    localStream,
    startLocalStream,
    createPeerConnection,
    addLocalStream,
    handleRemoteTrack,
    setLocalVideoQuality,
    cleanup: webrtcCleanup,
    ...webrtcRest
  } = useWebRTC()

  // 处理控制消息
  const handleControlMessage = useCallback((type: string, payload: any) => {
    console.log('[VideoChat] Control message:', type, payload)
    if (type === 'quality') {
        const quality = payload as VideoQualityProfile
        setLocalVideoQuality(quality)
    }
  }, [setLocalVideoQuality])

  const { setupDataChannel, sendControlMessage, ...dataChannelRest } = useDataChannel({
    onControlMessage: handleControlMessage
  })

  // 请求更改远程视频质量
  const requestRemoteVideoQuality = useCallback((quality: VideoQualityProfile) => {
    sendControlMessage('quality', quality)
  }, [sendControlMessage])
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const iceCandidateBufferRef = useRef<{ from: string; candidate: RTCIceCandidateInit }[]>([])
  const activeStreamRef = useRef<MediaStream | null>(null)
  const isHangingUpRef = useRef(false) // 防止挂断时触发重连
  const hasCleanedUpRef = useRef(false) // 防止重复清理

  const onPeerJoined = useCallback(async (payload: { peerId: string }) => {
    const peerId = payload.peerId
    console.log('[VideoChat] Peer joined:', peerId)
    setRemotePeerId(peerId)

    const stream = activeStreamRef.current || new MediaStream()
    const pc = createPeerConnection(handleRemoteTrack, (candidate) => {
      wsBus.emit(WS_EVENTS.ROOM.ICE_CANDIDATE, { to: peerId, candidate: candidate.toJSON() })
    })
    peerConnectionRef.current = pc

    pc.oniceconnectionstatechange = () => {
      console.log('🔌 [ICE] Connection state:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallStatus('connected')
      } else if (pc.iceConnectionState === 'failed' && !isHangingUpRef.current) {
        console.error('❌ [ICE] Connection failed, attempting ICE restart...')
        pc.restartIce()
      } else if (pc.iceConnectionState === 'failed' && isHangingUpRef.current) {
        console.log('🚫 [ICE] Connection failed but user is hanging up, skip restart')
      }
    }

    const channel = pc.createDataChannel('chat', { ordered: true })
    setupDataChannel(channel)
    addLocalStream(pc, stream)

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    wsBus.emit(WS_EVENTS.ROOM.OFFER, { to: peerId, offer })
  }, [addLocalStream, createPeerConnection, handleRemoteTrack, setCallStatus, setRemotePeerId, setupDataChannel])

  const onOffer = useCallback(async (payload: { from: string, offer: RTCSessionDescriptionInit }) => {
    const { from, offer } = payload
    console.log('[VideoChat] Received offer from:', from)
    setRemotePeerId(from)

    const stream = activeStreamRef.current || new MediaStream()
    const pc = createPeerConnection(handleRemoteTrack, (candidate) => {
      wsBus.emit(WS_EVENTS.ROOM.ICE_CANDIDATE, { to: from, candidate: candidate.toJSON() })
    })
    peerConnectionRef.current = pc

    pc.oniceconnectionstatechange = () => {
      console.log('🔌 [ICE] Connection state:', pc.iceConnectionState)
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallStatus('connected')
      } else if (pc.iceConnectionState === 'failed' && !isHangingUpRef.current) {
        console.error('❌ [ICE] Connection failed, attempting ICE restart...')
        pc.restartIce()
      } else if (pc.iceConnectionState === 'failed' && isHangingUpRef.current) {
        console.log('🚫 [ICE] Connection failed but user is hanging up, skip restart')
      } else if (pc.iceConnectionState === 'disconnected') {
        console.warn('⚠️ [ICE] Connection disconnected')
      }
    }

    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel)
    }

    addLocalStream(pc, stream)

    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    console.log('✅ [VideoChat] Remote description set, processing buffered ICE candidates:', iceCandidateBufferRef.current.length)

    for (const buffered of iceCandidateBufferRef.current) {
      if (buffered.from === from) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(buffered.candidate))
          console.log('✅ [ICE] Added buffered candidate')
        } catch (err) {
          console.error('❌ [ICE] Failed to add buffered candidate:', err)
        }
      }
    }
    iceCandidateBufferRef.current = []

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    wsBus.emit(WS_EVENTS.ROOM.ANSWER, { to: from, answer })
    setCallStatus('calling')
  }, [addLocalStream, createPeerConnection, handleRemoteTrack, setCallStatus, setRemotePeerId, setupDataChannel])

  const onAnswer = useCallback(async (payload: { from: string; answer: RTCSessionDescriptionInit }) => {
    const { from, answer } = payload
    console.log('[VideoChat] Received answer from:', from)
    const pc = peerConnectionRef.current
    if (pc && pc.remoteDescription === null && pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
      console.log('✅ [VideoChat] Remote description set, processing buffered ICE candidates:', iceCandidateBufferRef.current.length)

      for (const buffered of iceCandidateBufferRef.current) {
        if (buffered.from === from) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(buffered.candidate))
            console.log('✅ [ICE] Added buffered candidate')
          } catch (err) {
            console.error('❌ [ICE] Failed to add buffered candidate:', err)
          }
        }
      }
      iceCandidateBufferRef.current = []
      setCallStatus('calling')
    } else if (pc) {
      console.warn('⚠️ [VideoChat] Ignoring answer: invalid signaling state', pc.signalingState)
    }
  }, [setCallStatus])

  const onIceCandidate = useCallback(async (payload: { from: string; candidate: RTCIceCandidateInit }) => {
    const { from, candidate } = payload
    console.log('🧊 [ICE] Received candidate from:', from)
    const pc = peerConnectionRef.current

    if (!pc || !pc.remoteDescription) {
      console.log('📦 [ICE] Buffering candidate (no remote description yet)')
      iceCandidateBufferRef.current.push({ from, candidate })
      return
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
      console.log('✅ [ICE] Candidate added successfully')
    } catch (err) {
      console.error('❌ [ICE] Failed to add candidate:', err)
    }
  }, [])

  const onPeerDisconnected = useCallback((payload: { peerId: string }) => {
    const { peerId } = payload
    console.log('👋 [VideoChat] Peer disconnected:', peerId)
    if (hasCleanedUpRef.current) {
      console.log('⏭️ [VideoChat] Already cleaned up, skipping')
      return
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    iceCandidateBufferRef.current = []
    setRemotePeerId(null)
    setCallStatus('idle')
  }, [setCallStatus, setRemotePeerId])

  const clearRoomHandlers = useCallback(() => {
    wsBus.off(WS_EVENTS.ROOM.PEER_JOINED, onPeerJoined)
    wsBus.off(WS_EVENTS.ROOM.OFFER, onOffer)
    wsBus.off(WS_EVENTS.ROOM.ANSWER, onAnswer)
    wsBus.off(WS_EVENTS.ROOM.ICE_CANDIDATE, onIceCandidate)
    wsBus.off(WS_EVENTS.ROOM.PEER_DISCONNECTED, onPeerDisconnected)
  }, [onAnswer, onIceCandidate, onOffer, onPeerDisconnected, onPeerJoined])

  // 创建房间
  const createRoom = useCallback(async () => {
    try {
      clearRoomHandlers()
      const stream = localStream || await startLocalStream()
      activeStreamRef.current = stream

      await wsBus.connect()
      const data = await request.post<{ roomId: string }>('/rooms', {})
      const newRoomId = data.roomId
      if (!newRoomId) return null

      const response = await wsBus.emitWithAck<{ roomId?: string; peers?: string[] }>(
        WS_EVENTS.ROOM.JOIN_ROOM,
        { roomId: newRoomId }
      )
      if (!response) return null

      wsBus.on(WS_EVENTS.ROOM.PEER_JOINED, onPeerJoined)
      wsBus.on(WS_EVENTS.ROOM.ANSWER, onAnswer)
      wsBus.on(WS_EVENTS.ROOM.ICE_CANDIDATE, onIceCandidate)
      wsBus.on(WS_EVENTS.ROOM.PEER_DISCONNECTED, onPeerDisconnected)

      setRoomId(newRoomId)
      setCallStatus('calling')
      
      // 返回房间ID供调用方使用
      return newRoomId
    } catch (error) {
      console.error('Error creating room:', error)
      throw error
    }
  }, [addLocalStream, clearRoomHandlers, createPeerConnection, handleRemoteTrack, localStream, onAnswer, onIceCandidate, onPeerDisconnected, onPeerJoined, setupDataChannel, startLocalStream])

  // 加入房间
  const joinRoom = useCallback(async (id: string, options?: { silent?: boolean }) => {
    const { silent = false } = options || {}
    try {
      clearRoomHandlers()
      const stream = localStream || await startLocalStream()
      activeStreamRef.current = stream
      
      await wsBus.connect()
      const response = await wsBus.emitWithAck<{ peers?: string[] }>(
        WS_EVENTS.ROOM.JOIN_ROOM,
        { roomId: id }
      )
      if (!response) return null
      const peers = response.peers || []

      console.log('[VideoChat] Joined room, existing peers:', peers)

      // 为每个已存在的 peer 创建连接（通常只有创建者）
      if (peers.length > 0) {
        const peerId = peers[0] // 暂时只支持 1v1
        setRemotePeerId(peerId)
      }

      wsBus.on(WS_EVENTS.ROOM.PEER_JOINED, onPeerJoined)
      wsBus.on(WS_EVENTS.ROOM.OFFER, onOffer)
      wsBus.on(WS_EVENTS.ROOM.ANSWER, onAnswer)
      wsBus.on(WS_EVENTS.ROOM.ICE_CANDIDATE, onIceCandidate)
      wsBus.on(WS_EVENTS.ROOM.PEER_DISCONNECTED, onPeerDisconnected)

      setRoomId(id)
      setCallStatus('calling')
    } catch (error) {
      console.error('Error joining room:', error)
      // 如果不是静默模式，显示错误提示
      if (!silent) {
        alert('加入房间失败，请检查房间号是否正确')
      }
      setCallStatus('idle')
    }
  }, [addLocalStream, clearRoomHandlers, createPeerConnection, handleRemoteTrack, localStream, onAnswer, onIceCandidate, onOffer, onPeerDisconnected, onPeerJoined, setupDataChannel, startLocalStream])

  // 切换视频
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoEnabled(videoTrack.enabled)
      }
    }
  }, [localStream])

  // 切换音频
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioEnabled(audioTrack.enabled)
      }
    }
  }, [localStream])

  // 挂断
  const hangUp = useCallback(() => {
    console.log('🔴 [VideoChat] Hanging up...')
    
    // 设置标记，防止触发重连和重复清理
    isHangingUpRef.current = true
    hasCleanedUpRef.current = true
    
    // 关闭 PeerConnection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    
    // 清理缓冲区
    iceCandidateBufferRef.current = []
    
    // 清理资源
    dataChannelRest.cleanup()
    webrtcCleanup()
    clearRoomHandlers()
    
    // 断开 Socket 连接
    wsBus.disconnect()
    
    // 重置状态
    setRemotePeerId(null)
    setCallStatus('idle')
    setRoomId('')
    
    // 重置标记（延迟以确保所有状态变化处理完成）
    setTimeout(() => {
      isHangingUpRef.current = false
      hasCleanedUpRef.current = false
    }, 1000)
  }, [dataChannelRest, webrtcCleanup, clearRoomHandlers])

  return {
    roomId,
    setRoomId,
    callStatus,
    isVideoEnabled,
    isAudioEnabled,
    createRoom,
    joinRoom,
    toggleVideo,
    toggleAudio,
    hangUp,
    requestRemoteVideoQuality,
    localStream,
    ...webrtcRest,
    ...dataChannelRest
  }
}
