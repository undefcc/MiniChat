import { getWsErrorInfo, isWsUnauthorized } from './wsErrors'

export type WsAckError = {
  error?: { code?: string; message?: string; detail?: Record<string, unknown> } | string
  status?: string
  message?: string
}

const toAckError = (response: unknown): WsAckError | null => {
  if (!response || typeof response !== 'object') return null
  return response as WsAckError
}

export function getAckErrorPayload(response: unknown) {
  const ack = toAckError(response)
  if (!ack) return null
  if (ack.error) {
    return typeof ack.error === 'string' ? { message: ack.error } : ack.error
  }
  if (ack.status === 'error') {
    return { code: 'INTERNAL', message: ack.message || 'Request failed' }
  }
  return null
}

export function buildAckError(response: unknown, fallbackMessage: string) {
  const payload = getAckErrorPayload(response)
  if (!payload) return null
  return getWsErrorInfo(payload, fallbackMessage)
}

export function isAckUnauthorized(response: unknown) {
  const payload = getAckErrorPayload(response)
  if (!payload) return false
  return isWsUnauthorized(payload)
}
