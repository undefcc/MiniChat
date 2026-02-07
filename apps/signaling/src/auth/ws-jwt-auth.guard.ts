import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { WsException } from '@nestjs/websockets'
import { Socket } from 'socket.io'
import { JwtVerifierService } from './jwt-verifier.service'

@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(private readonly verifier: JwtVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>()
    const token = this.extractToken(client)

    if (!token) {
      throw new WsException('Unauthorized')
    }

    try {
      const payload = await this.verifier.verifyToken(token)
      client.data.user = payload
      return true
    } catch {
      throw new WsException('Unauthorized')
    }
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token
    if (typeof authToken === 'string' && authToken.trim().length) {
      return authToken.trim()
    }

    const header = client.handshake.headers?.authorization
    if (Array.isArray(header)) {
      const fromArray = header.find(item => item.toLowerCase().startsWith('bearer '))
      if (fromArray) {
        return fromArray.slice(7).trim()
      }
    } else if (typeof header === 'string') {
      if (header.toLowerCase().startsWith('bearer ')) {
        return header.slice(7).trim()
      }
    }

    const queryToken = client.handshake.query?.token
    if (typeof queryToken === 'string' && queryToken.trim().length) {
      return queryToken.trim()
    }

    return undefined
  }
}
