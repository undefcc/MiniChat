import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { InjectRedis } from '@nestjs-modules/ioredis'
import Redis from 'ioredis'
import { SocketRegistryService } from './socket-registry.service'

const KICK_CHANNEL = 'auth:session:kick'

interface KickMessage {
  userId: string
  sessionId: string
  reason?: string
}

@Injectable()
export class SessionKickSubscriber implements OnModuleInit, OnModuleDestroy {
  private subscriber: Redis | null = null

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly socketRegistry: SocketRegistryService,
  ) {}

  async onModuleInit() {
    this.subscriber = this.redis.duplicate()
    this.subscriber.on('message', (_channel, message) => {
      this.handleMessage(message)
    })
    await this.subscriber.subscribe(KICK_CHANNEL)
  }

  async onModuleDestroy() {
    if (!this.subscriber) return
    await this.subscriber.unsubscribe(KICK_CHANNEL)
    this.subscriber.quit()
    this.subscriber = null
  }

  private handleMessage(message: string) {
    let payload: KickMessage
    try {
      payload = JSON.parse(message) as KickMessage
    } catch {
      return
    }

    if (!payload?.userId || !payload?.sessionId) {
      return
    }

    const servers = this.socketRegistry.getServers()
    for (const server of servers) {
      const socketContainer = (server as unknown as { sockets?: Map<string, any> | { sockets?: Map<string, any> } })
        .sockets
      const socketMap = socketContainer instanceof Map ? socketContainer : socketContainer?.sockets
      if (!socketMap) continue

      for (const socket of socketMap.values()) {
        const user = socket.data.user as { userId?: string; sessionId?: string } | undefined
        if (user?.userId === payload.userId && user.sessionId === payload.sessionId) {
          socket.emit('kicked', {
            reason: payload.reason || 'NEW_LOGIN',
          })
          socket.disconnect(true)
        }
      }
    }
  }
}
