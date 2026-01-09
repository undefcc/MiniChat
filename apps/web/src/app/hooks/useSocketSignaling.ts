"use client"
import { useCallback } from 'react'
import type { Socket } from 'socket.io-client'

// 模块级单例，防止 React 重渲染时重复创建
let globalSocket: Socket | null = null
let connecting = false

// 事件处理器存储
const handlers = {
  offer: null as ((from: string, offer: RTCSessionDescriptionInit) => void) | null,
  answer: null as ((from: string, answer: RTCSessionDescriptionInit) => void) | null,
  ice: null as ((from: string, candidate: RTCIceCandidateInit) => void) | null,
  peerJoined: null as ((peerId: string) => void) | null,
  peerDisconnected: null as ((peerId: string) => void) | null,
}

export type SocketSignaling = {
  connect: () => Promise<void>
  disconnect: () => void
  createRoom: () => Promise<string>
  joinRoom: (roomId: string) => Promise<{ peers: string[] }>
  onOffer: (handler: (from: string, offer: RTCSessionDescriptionInit) => void) => void
  onAnswer: (handler: (from: string, answer: RTCSessionDescriptionInit) => void) => void
  onIce: (handler: (from: string, candidate: RTCIceCandidateInit) => void) => void
  onPeerJoined: (handler: (peerId: string) => void) => void
  onPeerDisconnected: (handler: (peerId: string) => void) => void
  sendOffer: (to: string, offer: RTCSessionDescriptionInit) => void
  sendAnswer: (to: string, answer: RTCSessionDescriptionInit) => void
  sendIce: (to: string, candidate: RTCIceCandidateInit) => void
}

// 设置一次性的 socket 事件监听
function setupSocketListeners(socket: Socket) {
  socket.off('offer')
  socket.off('answer')
  socket.off('ice-candidate')
  socket.off('peer-joined')
  socket.off('peer-disconnected')
  
  socket.on('offer', (payload: { from: string; offer: RTCSessionDescriptionInit }) => {
    console.log('[Socket] Received offer from:', payload.from)
    handlers.offer?.(payload.from, payload.offer)
  })
  
  socket.on('answer', (payload: { from: string; answer: RTCSessionDescriptionInit }) => {
    console.log('[Socket] Received answer from:', payload.from)
    handlers.answer?.(payload.from, payload.answer)
  })
  
  socket.on('ice-candidate', (payload: { from: string; candidate: RTCIceCandidateInit }) => {
    console.log('[Socket] Received ICE candidate from:', payload.from)
    handlers.ice?.(payload.from, payload.candidate)
  })
  
  socket.on('peer-joined', (payload: { peerId: string }) => {
    console.log('[Socket] Peer joined:', payload.peerId)
    handlers.peerJoined?.(payload.peerId)
  })
  
  socket.on('peer-disconnected', (payload: { peerId: string }) => {
    console.log('[Socket] Peer disconnected:', payload.peerId)
    handlers.peerDisconnected?.(payload.peerId)
  })
}

export function useSocketSignaling(): SocketSignaling {
  const connect = useCallback(async () => {
    if (globalSocket?.connected) return
    if (connecting) {
      // 等待现有连接完成
      await new Promise(resolve => setTimeout(resolve, 100))
      if (globalSocket?.connected) return
    }
    
    connecting = true
    
    // Dynamic import to avoid ESM/CJS issues with socket.io-client in Next.js
    const { io } = await import('socket.io-client')
    
    return new Promise<void>((resolve) => {
      // 连接到 Socket.IO 服务器
      const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL
      const socketUrl = envUrl 
        ? envUrl 
        : (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
            ? 'http://localhost:3101' 
            : undefined) // undefined 表示使用同域名
      
      console.log('[Socket] Connecting to:', socketUrl || 'same-origin')
      
      const socket = io(socketUrl || '', {
        path: '/socket.io/',
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })
      
      globalSocket = socket
      setupSocketListeners(socket)
      
      socket.on('connect', () => {
        console.log('Socket.IO connected:', socket.id)
        connecting = false
        resolve()
      })
      
      socket.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err.message)
        connecting = false
      })
      
      socket.on('disconnect', (reason) => {
        console.log('Socket.IO disconnected:', reason)
      })
      
      // Fallback timeout
      setTimeout(() => {
        if (connecting) {
          connecting = false
          resolve()
        }
      }, 5000)
    })
  }, [])

  const disconnect = useCallback(() => {
    globalSocket?.disconnect()
    globalSocket = null
    // 清空处理器
    handlers.offer = null
    handlers.answer = null
    handlers.ice = null
    handlers.peerJoined = null
    handlers.peerDisconnected = null
  }, [])

  const createRoom = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!globalSocket) {
        reject(new Error('Socket not connected'))
        return
      }
      console.log('[Socket] Creating room')
      globalSocket.emit('create-room', {}, (response: { roomId: string; error?: string }) => {
        if (response.error) {
          reject(new Error(response.error))
        } else {
          console.log('[Socket] Room created:', response.roomId)
          resolve(response.roomId)
        }
      })
    })
  }, [])

  const joinRoom = useCallback(async (roomId: string): Promise<{ peers: string[] }> => {
    return new Promise((resolve, reject) => {
      if (!globalSocket) {
        reject(new Error('Socket not connected'))
        return
      }
      console.log('[Socket] Joining room:', roomId)
      globalSocket.emit('join-room', { roomId }, (response: { roomId: string; peers: string[]; error?: string }) => {
        if (response.error) {
          reject(new Error(response.error))
        } else {
          console.log('[Socket] Joined room:', response.roomId, 'with peers:', response.peers)
          resolve({ peers: response.peers })
        }
      })
    })
  }, [])

  // 注册处理器（替换旧的）
  const onOffer = useCallback((handler: (from: string, offer: RTCSessionDescriptionInit) => void) => {
    handlers.offer = handler
  }, [])

  const onAnswer = useCallback((handler: (from: string, answer: RTCSessionDescriptionInit) => void) => {
    handlers.answer = handler
  }, [])

  const onIce = useCallback((handler: (from: string, candidate: RTCIceCandidateInit) => void) => {
    handlers.ice = handler
  }, [])

  const onPeerJoined = useCallback((handler: (peerId: string) => void) => {
    handlers.peerJoined = handler
  }, [])

  const onPeerDisconnected = useCallback((handler: (peerId: string) => void) => {
    handlers.peerDisconnected = handler
  }, [])

  const sendOffer = useCallback((to: string, offer: RTCSessionDescriptionInit) => {
    console.log('[Socket] Sending offer to:', to)
    globalSocket?.emit('offer', { to, offer })
  }, [])

  const sendAnswer = useCallback((to: string, answer: RTCSessionDescriptionInit) => {
    console.log('[Socket] Sending answer to:', to)
    globalSocket?.emit('answer', { to, answer })
  }, [])

  const sendIce = useCallback((to: string, candidate: RTCIceCandidateInit) => {
    console.log('[Socket] Sending ICE candidate to:', to)
    globalSocket?.emit('ice-candidate', { to, candidate })
  }, [])

  return { 
    connect, 
    disconnect, 
    createRoom, 
    joinRoom, 
    onOffer, 
    onAnswer, 
    onIce, 
    onPeerJoined, 
    onPeerDisconnected,
    sendOffer, 
    sendAnswer, 
    sendIce 
  }
}
