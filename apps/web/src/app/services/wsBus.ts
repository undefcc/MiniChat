import type { Socket } from 'socket.io-client'
import { useUiStore } from '../store/uiStore'
import { useConnectionStore } from '../store/connectionStore'
import { useUserStore } from '../store/userStore'
import { WS_EVENTS } from './wsConstants'

export type WsEventHandler = (...args: any[]) => void

// 统一的 Socket.IO 通道：错误归一化、鉴权驱动的重连控制、ack 处理
type HandlerMap = Map<string, Set<WsEventHandler>>

type SocketIssueOptions = {
  prefix?: string
  retry?: () => void | Promise<void>
  allowRetry?: boolean
  fallback?: string
}

const handlers: HandlerMap = new Map()
// 全局单例 socket 实例
let socket: Socket | null = null
// 防止并发 connect() 造成竞态
let connecting = false
// 在被踢/登出后禁止自动重连
let allowReconnect = true
// 记录当前 socket 使用的 token
let lastToken: string | null = null

// 将 UNAUTHORIZED 视为登出触发条件
const isWsUnauthorized = (err: unknown): boolean => {
  if (!err) return false
  const message = typeof err === 'string'
    ? err
    : typeof (err as Record<string, unknown>)?.message === 'string'
        ? String((err as Record<string, unknown>).message)
        : ''
  const normalized = message.toLowerCase()
  return normalized.includes('unauthorized') || normalized.includes('jwt') || normalized.includes('401')
}

// 被踢/登出后清理鉴权并禁止重连
const handleUnauthorized = () => {
  allowReconnect = false
  disconnect()
  useUserStore.getState().clearAuth()
  useUiStore.getState().invalidateAuth()
  useUiStore.getState().openLogin(() => useUiStore.getState().runAuthResume())
}

// 统一更新 UI 的连接状态
const setSignalingStatus = (status: 'connected' | 'disconnected' | 'error' | 'connecting', error?: string | null) => {
  useConnectionStore.getState().setSignalingStatus(status, error ?? null)
}

// 统一处理连接错误与鉴权问题
const handleSocketIssue = (err: unknown, options: SocketIssueOptions = {}) => {
  if (isWsUnauthorized(err)) {
    handleUnauthorized()
    return
  }

  const rawMessage = typeof err === 'string'
    ? err
    : typeof (err as Record<string, unknown>)?.message === 'string'
        ? String((err as Record<string, unknown>).message)
        : options.fallback || '连接错误'
  const finalMessage = options.prefix ? `${options.prefix}${rawMessage}` : String(rawMessage)
  setSignalingStatus('error', finalMessage)

  if (options.allowRetry && options.retry) {
    useUiStore.getState().showWsError(finalMessage, options.retry)
    return
  }

  useUiStore.getState().showWsError(finalMessage)
}

// 从环境变量或当前域名解析信令地址
const resolveSocketUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_SIGNALING_URL
  if (envUrl) return envUrl
  if (typeof window === 'undefined') return ''
  const protocol = window.location.protocol
  const hostname = window.location.hostname
  return `${protocol}//${hostname}:3101`
}

// 重新绑定所有已注册的事件处理器
const attachHandlers = (sock: Socket) => {
  handlers.forEach((set, event) => {
    set.forEach(handler => {
      sock.off(event, handler)
      sock.on(event, handler)
    })
  })
}

// 核心监听：处理踢下线与重连策略
const attachCoreListeners = (sock: Socket) => {
  sock.on(WS_EVENTS.CORE.KICKED, (payload?: { reason?: string }) => {
    const reason = payload?.reason ? ` (${payload.reason})` : ''
    useUiStore.getState().showWsError(`账号已在其他位置登录${reason}`)
    handleUnauthorized()
  })

  sock.on('connect_error', (err: any) => {
    handleSocketIssue(err, {
      fallback: 'Socket connection error',
      prefix: '信令连接失败：',
      allowRetry: allowReconnect,
      retry: allowReconnect ? () => connect() : undefined,
    })
  })

  sock.on('disconnect', (reason) => {
    setSignalingStatus('disconnected')
    if (reason !== 'io client disconnect') {
      if (allowReconnect) {
        useUiStore.getState().showWsError(`信令连接断开：${reason}`, () => {
          void connect()
        })
      } else {
        useUiStore.getState().showWsError(`信令连接断开：${reason}`)
      }
    }
  })

  sock.on('error', (err: any) => {
    handleSocketIssue(err, {
      fallback: 'Socket error',
      prefix: '信令错误：',
      allowRetry: allowReconnect,
      retry: allowReconnect ? () => connect() : undefined,
    })
  })

  sock.on('exception', (err: any) => {
    handleSocketIssue(err, {
      fallback: 'Socket exception',
      prefix: '信令异常：',
      allowRetry: allowReconnect,
      retry: allowReconnect ? () => connect() : undefined,
    })
  })
}

// 使用最新 token 建立连接
export async function connect(): Promise<void> {
  if (socket?.connected) {
    setSignalingStatus('connected')
    return
  }

  // 显式 connect() 时恢复重连开关
  allowReconnect = true

  // 所有 WS 操作都需要鉴权
  const token = useUserStore.getState().token
  if (!token) {
    connecting = false
    setSignalingStatus('disconnected')
    handleUnauthorized()
    return
  }

  // token 变化时重建 socket，避免旧鉴权
  if (socket && lastToken && lastToken !== token) {
    disconnect()
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
  lastToken = token

  return new Promise<void>((resolve, reject) => {
    const sock = io(socketUrl || '', {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      secure: isSecure,
      rejectUnauthorized: !isDev,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: { token },
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
      connecting = false
      cleanup()
      handleSocketIssue(err, {
        fallback: 'Socket connection error',
        prefix: '信令连接失败：',
        allowRetry: true,
        retry: () => connect(),
      })
      if (isWsUnauthorized(err)) {
        disconnect()
      }
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

// 主动断开，不触发自动重连
export function disconnect() {
  socket?.disconnect()
  socket = null
  lastToken = null
  setSignalingStatus('disconnected')
}

// 获取当前 socket 供诊断与检查
export function getSocket(): Socket | null {
  return socket
}

// 注册持久事件处理器，重连后继续生效
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

// 移除已注册的事件处理器
export function off(event: string, handler: WsEventHandler) {
  const set = handlers.get(event)
  if (!set) return
  set.delete(handler)
  if (socket) {
    socket.off(event, handler)
  }
}

// 发送事件，可选 ack 回调
export function emit(event: string, payload?: any, ack?: (...args: any[]) => void) {
  if (!socket) return
  if (typeof ack === 'function') {
    socket.emit(event, payload, ack)
  } else {
    socket.emit(event, payload)
  }
}

// 发送事件并支持 ack 与超时
export async function emitWithAck<T = any>(event: string, payload?: any, options?: { timeoutMs?: number }) {
  if (!socket) {
    throw new Error('Socket not connected')
  }
  if (typeof options?.timeoutMs === 'number') {
    return socket.timeout(options.timeoutMs).emitWithAck(event, payload) as Promise<T>
  }
  return socket.emitWithAck(event, payload) as Promise<T>
}

