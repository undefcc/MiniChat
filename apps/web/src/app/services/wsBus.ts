import type { Socket } from 'socket.io-client'
import { useUiStore } from '../store/uiStore'
import { useConnectionStore } from '../store/connectionStore'
import { useUserStore } from '../store/userStore'
import { getWsErrorInfo, isWsUnauthorized } from '../utils/wsErrors'
import { buildAckError, isAckUnauthorized } from '../utils/wsAck'

export type WsEventHandler = (...args: any[]) => void

type HandlerMap = Map<string, Set<WsEventHandler>>

const handlers: HandlerMap = new Map()
let socket: Socket | null = null
let connecting = false

const handleUnauthorized = () => {
  useUserStore.getState().clearAuth()
  useUiStore.getState().invalidateAuth()
  useUiStore.getState().openLogin(true)
}

const setSignalingStatus = (status: 'connected' | 'disconnected' | 'error' | 'connecting', error?: string | null) => {
  useConnectionStore.getState().setSignalingStatus(status, error ?? null)
}

const handleWsError = (err: unknown, fallback: string, retry?: () => void | Promise<void>) => {
  if (isWsUnauthorized(err)) {
    handleUnauthorized()
    return
  }

  const { message } = getWsErrorInfo(err, fallback)
  setSignalingStatus('error', message)
  useUiStore.getState().showWsError(message, retry)
}

const resolveSocketUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_SIGNALING_URL
  if (envUrl) return envUrl
  if (typeof window === 'undefined') return ''
  const protocol = window.location.protocol
  const hostname = window.location.hostname
  return `${protocol}//${hostname}:3101`
}

const attachHandlers = (sock: Socket) => {
  handlers.forEach((set, event) => {
    set.forEach(handler => {
      sock.off(event, handler)
      sock.on(event, handler)
    })
  })
}

const attachCoreListeners = (sock: Socket) => {
  sock.on('connect_error', (err: any) => {
    if (isWsUnauthorized(err)) {
      handleUnauthorized()
      return
    }
    const { message } = getWsErrorInfo(err, 'Socket connection error')
    setSignalingStatus('error', message)
    handleWsError(err, `信令连接失败：${message}`, () => {
      void connect()
    })
  })

  sock.on('disconnect', (reason) => {
    setSignalingStatus('disconnected')
    if (reason !== 'io client disconnect') {
      useUiStore.getState().showWsError(`信令连接断开：${reason}`, () => {
        void connect()
      })
    }
  })

  sock.on('error', (err: any) => {
    const { message } = getWsErrorInfo(err, 'Socket error')
    setSignalingStatus('error', message)
    handleWsError(err, `信令错误：${message}`, () => {
      void connect()
    })
  })

  sock.on('exception', (err: any) => {
    const { message } = getWsErrorInfo(err, 'Socket exception')
    setSignalingStatus('error', message)
    handleWsError(err, `信令异常：${message}`, () => {
      void connect()
    })
  })
}

export async function connect(): Promise<void> {
  if (socket?.connected) {
    setSignalingStatus('connected')
    return
  }

  if (connecting) {
    const startedAt = Date.now()
    while (connecting) {
      if (socket?.connected) return
      if (Date.now() - startedAt > 8000) {
        throw new Error('Socket connect timeout (waiting for in-flight connect)')
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (socket?.connected) return
    throw new Error('Socket connect failed')
  }

  connecting = true
  setSignalingStatus('connecting')

  const { io } = await import('socket.io-client')
  const socketUrl = resolveSocketUrl()
  const isSecure = socketUrl ? socketUrl.startsWith('https://') : (typeof window !== 'undefined' && window.location.protocol === 'https:')
  const isDev = process.env.NODE_ENV === 'development'
  const token = useUserStore.getState().token

  return new Promise<void>((resolve, reject) => {
    const sock = io(socketUrl || '', {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      secure: isSecure,
      rejectUnauthorized: !isDev,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: token ? { token } : undefined,
    })

    socket = sock
    attachCoreListeners(sock)
    attachHandlers(sock)

    const cleanup = () => {
      sock.off('connect', onConnect)
      sock.off('connect_error', onConnectError)
    }

    const onConnect = () => {
      connecting = false
      cleanup()
      setSignalingStatus('connected')
      resolve()
    }

    const onConnectError = (err: any) => {
      if (isWsUnauthorized(err)) {
        connecting = false
        cleanup()
        handleUnauthorized()
        disconnect()
        reject(err)
        return
      }
      const { message } = getWsErrorInfo(err, 'Socket connection error')
      connecting = false
      cleanup()
      setSignalingStatus('error', message)
      handleWsError(err, `信令连接失败：${message}`, () => {
        void connect()
      })
      reject(err)
    }

    sock.on('connect', onConnect)
    sock.on('connect_error', onConnectError)

    setTimeout(() => {
      if (connecting) {
        connecting = false
        cleanup()
        sock.disconnect()
        setSignalingStatus('error', 'Socket connect timeout')
        reject(new Error('Socket connect timeout'))
      }
    }, 8000)
  })
}

export function disconnect() {
  socket?.disconnect()
  socket = null
  setSignalingStatus('disconnected')
}

export function getSocket(): Socket | null {
  return socket
}

export function on(event: string, handler: WsEventHandler) {
  if (!handlers.has(event)) {
    handlers.set(event, new Set())
  }
  handlers.get(event)!.add(handler)
  if (socket) {
    socket.off(event, handler)
    socket.on(event, handler)
  }
}

export function off(event: string, handler: WsEventHandler) {
  const set = handlers.get(event)
  if (!set) return
  set.delete(handler)
  if (socket) {
    socket.off(event, handler)
  }
}

export function emit(event: string, payload?: any, ack?: (...args: any[]) => void) {
  if (!socket) return
  if (typeof ack === 'function') {
    socket.emit(event, payload, ack)
  } else {
    socket.emit(event, payload)
  }
}

export async function emitWithAck<T = any>(event: string, payload?: any, options?: { timeoutMs?: number }) {
  if (!socket) {
    throw new Error('Socket not connected')
  }
  if (typeof options?.timeoutMs === 'number') {
    return socket.timeout(options.timeoutMs).emitWithAck(event, payload) as Promise<T>
  }
  return socket.emitWithAck(event, payload) as Promise<T>
}

export async function emitWithAckChecked<T = any>(
  event: string,
  payload: any,
  fallbackMessage: string,
  options?: { timeoutMs?: number }
): Promise<T | null> {
  const response = await emitWithAck<T>(event, payload, options)
  const ackError = buildAckError(response, fallbackMessage)
  if (!ackError) return response

  if (isAckUnauthorized(response)) {
    handleUnauthorized()
    disconnect()
    return null
  }

  useUiStore.getState().showWsError(ackError.message, () => {
    void connect()
  })
  throw new Error(ackError.message)
}
