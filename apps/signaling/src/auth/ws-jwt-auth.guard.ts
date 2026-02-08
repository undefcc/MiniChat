import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { WsException } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { JwtVerifierService } from './jwt-verifier.service'
import { SessionStoreService } from './session-store.service'
import { extractTokenFromSocket } from './ws-auth.utils'

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(
    private readonly verifier: JwtVerifierService,
    private readonly sessionStore: SessionStoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>()
    const token = extractTokenFromSocket(client)

    if (!token) {
      throw new WsException('UNAUTHORIZED: Unauthorized')
    }

    try {
      const payload = await this.verifier.verifyToken(token)
      const userId = typeof payload.userId === 'string' ? payload.userId : undefined
      const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : undefined

      if (!userId || !sessionId) {
        throw new WsException('UNAUTHORIZED: Unauthorized')
      }

      const activeSessionId = await this.sessionStore.getSessionId(userId)
      if (!activeSessionId || activeSessionId !== sessionId) {
        throw new WsException('UNAUTHORIZED: Unauthorized')
      }

      client.data.user = payload
      return true
    } catch {
      throw new WsException('UNAUTHORIZED: Unauthorized')
    }
  }

}
