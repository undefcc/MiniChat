import { useState, useCallback, useRef } from 'react'
import { useWebRTC } from './useWebRTC'
import { useDataChannel } from './useDataChannel'
import { useSocketSignaling } from './useSocketSignaling'

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
    cleanup: webrtcCleanup,
    ...webrtcRest
  } = useWebRTC()

  const { setupDataChannel, ...dataChannelRest } = useDataChannel()
  const signaling = useSocketSignaling()
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

  // 创建房间
  const createRoom = useCallback(async () => {
    try {
      const stream = localStream || await startLocalStream()
      
      await signaling.connect()
      const newRoomId = await signaling.createRoom()

      // 注册信令事件监听
      signaling.onPeerJoined(async (peerId: string) => {
        console.log('[VideoChat] Peer joined:', peerId)
        setRemotePeerId(peerId)
        
        // 创建 PeerConnection
        const pc = createPeerConnection(handleRemoteTrack, (candidate) => {
          signaling.sendIce(peerId, candidate.toJSON())
        })
        peerConnectionRef.current = pc

        // 创建数据通道
        const channel = pc.createDataChannel('chat', { ordered: true })
        setupDataChannel(channel)

        // 添加本地媒体流
        addLocalStream(pc, stream || new MediaStream())

        // 创建并发送 offer
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        signaling.sendOffer(peerId, offer)
      })

      signaling.onAnswer(async (from: string, answer: RTCSessionDescriptionInit) => {
        console.log('[VideoChat] Received answer from:', from)
        const pc = peerConnectionRef.current
        if (pc && pc.remoteDescription === null) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
          setCallStatus('connected')
        }
      })

      signaling.onIce(async (from: string, candidate: RTCIceCandidateInit) => {
        console.log('[VideoChat] Received ICE from:', from)
        const pc = peerConnectionRef.current
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
          } catch (err) {
            console.error('Failed to add ICE candidate', err)
          }
        }
      })

      signaling.onPeerDisconnected((peerId: string) => {
        console.log('[VideoChat] Peer disconnected:', peerId)
        setCallStatus('idle')
      })

      setRoomId(newRoomId)
      setCallStatus('calling')
    } catch (error) {
      console.error('Error creating room:', error)
      alert('创建房间失败，请重试')
    }
  }, [localStream, startLocalStream, createPeerConnection, handleRemoteTrack, addLocalStream, setupDataChannel, signaling])

  // 加入房间
  const joinRoom = useCallback(async (id: string) => {
    try {
      const stream = localStream || await startLocalStream()
      
      await signaling.connect()
      const { peers } = await signaling.joinRoom(id)

      console.log('[VideoChat] Joined room, existing peers:', peers)

      // 为每个已存在的 peer 创建连接（通常只有创建者）
      if (peers.length > 0) {
        const peerId = peers[0] // 暂时只支持 1v1
        setRemotePeerId(peerId)
      }

      // 注册信令事件监听
      signaling.onOffer(async (from: string, offer: RTCSessionDescriptionInit) => {
        console.log('[VideoChat] Received offer from:', from)
        setRemotePeerId(from)

        const pc = createPeerConnection(handleRemoteTrack, (candidate) => {
          signaling.sendIce(from, candidate.toJSON())
        })
        peerConnectionRef.current = pc

        // 监听数据通道
        pc.ondatachannel = (event) => {
          setupDataChannel(event.channel)
        }

        // 添加本地媒体流
        addLocalStream(pc, stream || new MediaStream())

        // 设置远程描述并创建 answer
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        signaling.sendAnswer(from, answer)
        setCallStatus('connected')
      })

      signaling.onIce(async (from: string, candidate: RTCIceCandidateInit) => {
        console.log('[VideoChat] Received ICE from:', from)
        const pc = peerConnectionRef.current
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate))
          } catch (err) {
            console.error('Failed to add ICE candidate', err)
          }
        }
      })

      signaling.onPeerDisconnected((peerId: string) => {
        console.log('[VideoChat] Peer disconnected:', peerId)
        setCallStatus('idle')
      })

      setRoomId(id)
      setCallStatus('calling')
    } catch (error) {
      console.error('Error joining room:', error)
      alert('加入房间失败，请检查房间ID是否正确')
      setCallStatus('idle')
    }
  }, [localStream, startLocalStream, signaling, createPeerConnection, handleRemoteTrack, setupDataChannel, addLocalStream])

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
    console.log('Hanging up...')
    dataChannelRest.cleanup()
    webrtcCleanup()
    setCallStatus('idle')
    setRoomId('')
  }, [dataChannelRest, webrtcCleanup])

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
    localStream,
    ...webrtcRest,
    ...dataChannelRest
  }
}
