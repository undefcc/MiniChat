import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export type StandardResponse<T = unknown> = {
  code: string
  data: T | null
  msg?: string
  success: boolean
}

const isStandardResponse = (value: unknown): value is StandardResponse => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.success === 'boolean' && typeof record.code === 'string'
}

const wrapSuccess = <T>(data: T | null): StandardResponse<T> => {
  return { code: '', data, success: true }
}

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        if (isStandardResponse(data)) {
          return data
        }
        if (typeof data === 'undefined') {
          return wrapSuccess(null)
        }
        return wrapSuccess(data as any)
      }),
    )
  }
}
