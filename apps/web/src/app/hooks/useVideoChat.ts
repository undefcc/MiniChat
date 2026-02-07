import { useState, useCallback, useRef } from 'react'
import { useWebRTC } from './useWebRTC'
import { useDataChannel } from './useDataChannel'
import { request } from '../utils/request'
import * as wsBus from '../services/wsBus'
import type { WsEventHandler } from '../services/wsBus'
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
  const isHangingUpRef = useRef(false) // 防止挂断时触发重连
  const hasCleanedUpRef = useRef(false) // 防止重复清理
  const wsHandlersRef = useRef<{
    peerJoined?: WsEventHandler
    offer?: WsEventHandler
    answer?: WsEventHandler
    iceCandidate?: WsEventHandler
    peerDisconnected?: WsEventHandler
  } | null>(null)

  const clearRoomHandlers = useCallback(() => {
    const current = wsHandlersRef.current
    if (!current) return
    if (current.peerJoined) wsBus.off(WS_EVENTS.ROOM.PEER_JOINED, current.peerJoined)
    if (current.offer) wsBus.off(WS_EVENTS.ROOM.OFFER, current.offer)
    if (current.answer) wsBus.off(WS_EVENTS.ROOM.ANSWER, current.answer)
    if (current.iceCandidate) wsBus.off(WS_EVENTS.ROOM.ICE_CANDIDATE, current.iceCandidate)
    if (current.peerDisconnected) wsBus.off(WS_EVENTS.ROOM.PEER_DISCONNECTED, current.peerDisconnected)
    wsHandlersRef.current = null
  }, [])

  // 创建房间
  const createRoom = useCallback(async () => {
    try {
      clearRoomHandlers()
      const stream = localStream || await startLocalStream()

      await wsBus.connect()
      const data = await request.post<{ roomId: string }>('/rooms', {})
      const newRoomId = data.roomId
      if (!newRoomId) return null

      const response = await wsBus.emitWithAckChecked<{ peers?: string[] }>(
        WS_EVENTS.ROOM.JOIN_ROOM,
        { roomId: newRoomId },
        'Join room failed'
      )
      if (!response) return null

      // 注册信令事件监听
      const onPeerJoined: WsEventHandler = async (payload: { peerId: string }) => {
        const peerId = payload.peerId
        console.log('[VideoChat] Peer joined:', peerId)
        setRemotePeerId(peerId)
        
        // 创建 PeerConnection
        const pc = createPeerConnection(handleRemoteTrack, (candidate) => {
          wsBus.emit(WS_EVENTS.ROOM.ICE_CANDIDATE, { to: peerId, candidate: candidate.toJSON() })
        })
        peerConnectionRef.current = pc

        // 监听连接状态变化
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

        // 创建数据通道
        const channel = pc.createDataChannel('chat', { ordered: true })
        setupDataChannel(channel)

        // 添加本地媒体流
        addLocalStream(pc, stream || new MediaStream())

        // 创建并发送 offer
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        wsBus.emit(WS_EVENTS.ROOM.OFFER, { to: peerId, offer })
      }

      const onAnswer: WsEventHandler = async (payload: { from: string; answer: RTCSessionDescriptionInit }) => {
        const { from, answer } = payload
        console.log('[VideoChat] Received answer from:', from)
        const pc = peerConnectionRef.current
        if (pc && pc.remoteDescription === null && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
          console.log('✅ [VideoChat] Remote description set, processing buffered ICE candidates:', iceCandidateBufferRef.current.length)
          
          // 处理缓冲的 ICE 候选
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
      }

      const onIceCandidate: WsEventHandler = async (payload: { from: string; candidate: RTCIceCandidateInit }) => {
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
      }

      const onPeerDisconnected: WsEventHandler = (payload: { peerId: string }) => {
        const { peerId } = payload
        console.log('👋 [VideoChat] Peer disconnected:', peerId)
        if (hasCleanedUpRef.current) {
          console.log('⏭️ [VideoChat] Already cleaned up, skipping')
          return
        }
        // 清理连接资源
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close()
          peerConnectionRef.current = null
        }
        iceCandidateBufferRef.current = []
        setRemotePeerId(null)
        setCallStatus('idle')
      }

      wsHandlersRef.current = {
        peerJoined: onPeerJoined,
        answer: onAnswer,
        iceCandidate: onIceCandidate,
        peerDisconnected: onPeerDisconnected,
      }

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
  }, [localStream, startLocalStream, createPeerConnection, handleRemoteTrack, addLocalStream, setupDataChannel, clearRoomHandlers])

  // 加入房间
  const joinRoom = useCallback(async (id: string, options?: { silent?: boolean }) => {
    const { silent = false } = options || {}
    try {
      clearRoomHandlers()
      const stream = localStream || await startLocalStream()
      
      await wsBus.connect()
      const response = await wsBus.emitWithAckChecked<{ peers?: string[] }>(
        WS_EVENTS.ROOM.JOIN_ROOM,
        { roomId: id },
        'Join room failed'
      )
      if (!response) return null
      const peers = response.peers || []

      console.log('[VideoChat] Joined room, existing peers:', peers)

      // 为每个已存在的 peer 创建连接（通常只有创建者）
      if (peers.length > 0) {
        const peerId = peers[0] // 暂时只支持 1v1
        setRemotePeerId(peerId)
      }

      // 注册 onPeerJoined：当新用户加入时，我作为"先到者"需要发送 offer
      const onPeerJoined: WsEventHandler = async (payload: { peerId: string }) => {
        const peerId = payload.peerId
        console.log('[VideoChat] Peer joined:', peerId)
        setRemotePeerId(peerId)
        
        // 创建 PeerConnection
        const pc = createPeerConnection(handleRemoteTrack, (candidate) => {
          wsBus.emit(WS_EVENTS.ROOM.ICE_CANDIDATE, { to: peerId, candidate: candidate.toJSON() })
        })
        peerConnectionRef.current = pc

        // 监听连接状态变化
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

        // 创建数据通道（作为 offer 方）
        const channel = pc.createDataChannel('chat', { ordered: true })
        setupDataChannel(channel)

        // 添加本地媒体流
        addLocalStream(pc, stream || new MediaStream())

        // 创建并发送 offer
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        wsBus.emit(WS_EVENTS.ROOM.OFFER, { to: peerId, offer })
      }

      // 注册 onOffer：当房间里已有人时，接收他们发来的 offer
      const onOffer: WsEventHandler = async (payload: { from: string, offer: RTCSessionDescriptionInit }) => {
        const { from, offer } = payload
        console.log('[VideoChat] Received offer from:', from)
        setRemotePeerId(from)

        const pc = createPeerConnection(handleRemoteTrack, (candidate) => {
          wsBus.emit(WS_EVENTS.ROOM.ICE_CANDIDATE, { to: from, candidate: candidate.toJSON() })
        })
        peerConnectionRef.current = pc

        // 监听连接状态变化
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

        // 监听数据通道（作为 answer 方）
        pc.ondatachannel = (event) => {
          setupDataChannel(event.channel)
        }

        // 添加本地媒体流
        addLocalStream(pc, stream || new MediaStream())

        // 设置远程描述并创建 answer
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        console.log('✅ [VideoChat] Remote description set, processing buffered ICE candidates:', iceCandidateBufferRef.current.length)
        
        // 处理缓冲的 ICE 候选
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
      }

      // 注册 onAnswer：处理对方返回的 answer
      const onAnswer: WsEventHandler = async (payload: { from: string; answer: RTCSessionDescriptionInit }) => {
        const { from, answer } = payload
        console.log('[VideoChat] Received answer from:', from)
        const pc = peerConnectionRef.current
        if (pc && pc.remoteDescription === null && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
          console.log('✅ [VideoChat] Remote description set, processing buffered ICE candidates:', iceCandidateBufferRef.current.length)
          
          // 处理缓冲的 ICE 候选
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
      }

      const onIceCandidate: WsEventHandler = async (payload: { from: string; candidate: RTCIceCandidateInit }) => {
        const { from, candidate } = payload
        console.log('🧊 [ICE] Received candidate from:', from)
        const pc = peerConnectionRef.current
        
        if (!pc || !pc.remoteDescription) {
          // 缓冲 ICE 候选，等待 remoteDescription 设置后再添加
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
      }

      const onPeerDisconnected: WsEventHandler = (payload: { peerId: string }) => {
        const { peerId } = payload
        console.log('👋 [VideoChat] Peer disconnected:', peerId)
        if (hasCleanedUpRef.current) {
          console.log('⏭️ [VideoChat] Already cleaned up, skipping')
          return
        }
        // 清理连接资源
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close()
          peerConnectionRef.current = null
        }
        iceCandidateBufferRef.current = []
        setRemotePeerId(null)
        setCallStatus('idle')
      }

      wsHandlersRef.current = {
        peerJoined: onPeerJoined,
        offer: onOffer,
        answer: onAnswer,
        iceCandidate: onIceCandidate,
        peerDisconnected: onPeerDisconnected,
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
  }, [localStream, startLocalStream, createPeerConnection, handleRemoteTrack, setupDataChannel, addLocalStream, clearRoomHandlers])

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
