import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common'
import { JwtVerifierService } from './jwt-verifier.service'

@Controller('auth')
export class AuthDiagnosticsController {
  constructor(private readonly verifier: JwtVerifierService) {}

  @Get('diagnostics')
  async diagnose(@Headers('authorization') authorization?: string) {
    const token = this.extractToken(authorization)
    if (!token) {
      throw new UnauthorizedException('Missing Bearer token')
    }

    const payload = await this.verifier.verifyToken(token)
    return {
      ok: true,
      payload,
    }
  }

  private extractToken(authorization?: string): string | undefined {
    if (!authorization) {
      return undefined
    }

    const trimmed = authorization.trim()
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      return trimmed.slice(7).trim()
    }

    return undefined
  }
}
