import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtVerifierService } from './jwt-verifier.service'

@Injectable()
export class HttpJwtAuthGuard implements CanActivate {
  constructor(private readonly verifier: JwtVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>
      user?: unknown
    }>()
    const token = this.extractToken(request.headers?.authorization)

    if (!token) {
      throw new UnauthorizedException('Unauthorized')
    }

    const payload = await this.verifier.verifyToken(token)
    request.user = payload
    return true
  }

  private extractToken(authorization?: string | string[]): string | undefined {
    if (!authorization) return undefined

    if (Array.isArray(authorization)) {
      const bearer = authorization.find(item => item.toLowerCase().startsWith('bearer '))
      return bearer ? bearer.slice(7).trim() : undefined
    }

    const trimmed = authorization.trim()
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      return trimmed.slice(7).trim()
    }

    return undefined
  }
}
