import { getWsErrorInfo, isWsUnauthorized } from './wsErrors'

export type WsAckError = {
  error?: { code?: string; message?: string; detail?: Record<string, unknown> } | string
  status?: string
  message?: string
}

export function getAckErrorPayload(response: WsAckError | null | undefined) {
  if (!response) return null
  if (response.error) {
    return typeof response.error === 'string' ? { message: response.error } : response.error
  }
  if (response.status === 'error') {
    return { code: 'INTERNAL', message: response.message || 'Request failed' }
  }
  return null
}

export function buildAckError(response: WsAckError | null | undefined, fallbackMessage: string) {
  const payload = getAckErrorPayload(response)
  if (!payload) return null
  return getWsErrorInfo(payload, fallbackMessage)
}

export function isAckUnauthorized(response: WsAckError | null | undefined) {
  const payload = getAckErrorPayload(response)
  if (!payload) return false
  return isWsUnauthorized(payload)
}
