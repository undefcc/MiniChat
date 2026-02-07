export type WsErrorPayload = {
  code?: string
  message?: string
  detail?: Record<string, unknown>
}

const WS_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: '登录已过期，请重新登录',
  FORBIDDEN: '没有权限执行此操作',
  INVALID_ARGUMENT: '参数错误，请检查输入',
  NOT_FOUND: '资源不存在',
  CONFLICT: '资源冲突，请稍后重试',
  FAILED_PRECONDITION: '操作条件未满足',
  RESOURCE_EXHAUSTED: '资源已满或请求过于频繁',
  INTERNAL: '服务内部错误，请稍后重试',
  UNAVAILABLE: '服务暂不可用，请稍后重试',
  ROOM_NOT_FOUND: '房间不存在',
  ROOM_FULL: '房间已满',
  ROOM_CLOSED: '房间已关闭',
  ROOM_ALREADY_EXISTS: '房间已存在',
  ROOM_ALREADY_JOINED: '已在房间中',
  ROOM_INVALID_STATE: '房间状态异常',
  SIGNAL_OFFER_INVALID: '信令 Offer 无效',
  SIGNAL_ANSWER_INVALID: '信令 Answer 无效',
  SIGNAL_ICE_INVALID: '信令 ICE 候选无效',
  SIGNAL_PEER_NOT_FOUND: '对端不存在或已离线',
  STATION_NOT_FOUND: '站点不存在',
  STATION_OFFLINE: '站点离线',
  STATION_ALREADY_REGISTERED: '站点已注册',
  STATION_NOT_REGISTERED: '站点未注册',
  STATION_UNREACHABLE: '站点不可达',
}

export type WsErrorInfo = {
  code?: string
  message: string
}

export function getWsErrorInfo(err: unknown, fallbackMessage = '请求失败'): WsErrorInfo {
  if (!err) {
    return { message: fallbackMessage }
  }

  if (typeof err === 'string') {
    return { message: err }
  }

  const anyErr = err as {
    message?: string
    code?: string
    data?: WsErrorPayload
    error?: WsErrorPayload
  }

  const payload = anyErr.data || anyErr.error || (anyErr as WsErrorPayload)
  const code = payload?.code || anyErr.code
  const rawMessage = payload?.message || anyErr.message || fallbackMessage
  const mappedMessage = code && WS_ERROR_MESSAGES[code] ? WS_ERROR_MESSAGES[code] : rawMessage

  return { code, message: mappedMessage }
}

export function isWsUnauthorized(err: unknown): boolean {
  const { code, message } = getWsErrorInfo(err, '')
  if (code && code.toUpperCase() === 'UNAUTHORIZED') return true
  const normalized = message.toLowerCase()
  return normalized.includes('unauthorized') || normalized.includes('jwt') || normalized.includes('401')
}
