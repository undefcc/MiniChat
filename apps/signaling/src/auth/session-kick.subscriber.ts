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
      // 获取 sockets 容器
      const container = server.sockets
      
      // 兼容不同版本
      let socketMap: Map<string, any> | undefined
      if (container instanceof Map) {
        socketMap = container  // v3.x
      } else if (container && 'sockets' in container) {
        socketMap = container.sockets  // v4.x
      }
      
      if (!socketMap) continue
      
      // 遍历 socket
      for (const socket of Array.from(socketMap.values())) {
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
