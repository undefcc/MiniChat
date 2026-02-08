import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { WsException } from '@nestjs/websockets'

type ErrorPayload = {
  code: string
  msg: string
  data: null
  success: false
}

const normalizeMessage = (value: unknown, fallback: string) => {
  if (!value) return fallback
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.join(', ')
  return fallback
}

const buildErrorPayload = (exception: unknown): ErrorPayload => {
  let code = 'ERROR'
  let msg = 'Internal error'

  if (exception instanceof WsException) {
    const err = exception.getError()
    if (typeof err === 'string') {
      msg = err
    } else if (err && typeof err === 'object') {
      const record = err as Record<string, unknown>
      if (typeof record.code === 'string') code = record.code
      if (typeof record.msg === 'string') msg = record.msg
      if (typeof record.message === 'string' && !record.msg) msg = record.message
    }
  } else if (exception instanceof HttpException) {
    const status = exception.getStatus()
    if (status === HttpStatus.UNAUTHORIZED) code = 'UNAUTHORIZED'
    else if (status === HttpStatus.FORBIDDEN) code = 'FORBIDDEN'
    const response = exception.getResponse()
    if (typeof response === 'string') {
      msg = response
    } else if (response && typeof response === 'object') {
      const record = response as Record<string, unknown>
      if (typeof record.code === 'string') code = record.code
      if (typeof record.msg === 'string') msg = record.msg
      if (record.message && !record.msg) {
        msg = normalizeMessage(record.message, msg)
      }
    } else {
      msg = exception.message
    }
  } else if (exception instanceof Error) {
    msg = exception.message
  }

  return { code, msg, data: null, success: false }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const payload = buildErrorPayload(exception)
    const type = host.getType<string>()

    if (type === 'ws') {
      const client = host.switchToWs().getClient()
      if (client && typeof client.emit === 'function') {
        client.emit('exception', payload)
      }
      return
    }

    if (type === 'http') {
      const response = host.switchToHttp().getResponse()
      const status = exception instanceof HttpException ? exception.getStatus() : 500
      response.status(status).json(payload)
      return
    }
  }
}
