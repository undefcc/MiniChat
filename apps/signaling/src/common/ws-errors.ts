import { WsException } from '@nestjs/websockets'

export type WsErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_ARGUMENT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FAILED_PRECONDITION'
  | 'RESOURCE_EXHAUSTED'
  | 'INTERNAL'
  | 'UNAVAILABLE'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ROOM_CLOSED'
  | 'ROOM_ALREADY_EXISTS'
  | 'ROOM_ALREADY_JOINED'
  | 'ROOM_INVALID_STATE'
  | 'SIGNAL_OFFER_INVALID'
  | 'SIGNAL_ANSWER_INVALID'
  | 'SIGNAL_ICE_INVALID'
  | 'SIGNAL_PEER_NOT_FOUND'
  | 'STATION_NOT_FOUND'
  | 'STATION_OFFLINE'
  | 'STATION_ALREADY_REGISTERED'
  | 'STATION_NOT_REGISTERED'
  | 'STATION_UNREACHABLE'

export type WsErrorPayload = {
  code: WsErrorCode
  message: string
  detail?: Record<string, unknown>
}

export function wsError(code: WsErrorCode, message: string, detail?: Record<string, unknown>) {
  return { error: { code, message, detail } }
}

export function wsException(code: WsErrorCode, message: string, detail?: Record<string, unknown>) {
  return new WsException({ code, message, detail })
}
