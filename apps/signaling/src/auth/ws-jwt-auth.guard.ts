import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { WsException } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { JwtVerifierService } from './jwt-verifier.service'
import { extractTokenFromSocket } from './ws-auth.utils'

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(private readonly verifier: JwtVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>()
    const token = extractTokenFromSocket(client)

    if (!token) {
      throw new WsException({ code: 'UNAUTHORIZED', message: 'Unauthorized' })
    }

    try {
      const payload = await this.verifier.verifyToken(token)
      client.data.user = payload
      return true
    } catch {
      throw new WsException({ code: 'UNAUTHORIZED', message: 'Unauthorized' })
    }
  }

}
