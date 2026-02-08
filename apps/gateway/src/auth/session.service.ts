import { Injectable } from '@nestjs/common'
import { InjectRedis } from '@nestjs-modules/ioredis'
import Redis from 'ioredis'
import { randomBytes } from 'crypto'

const KICK_CHANNEL = 'auth:session:kick'

@Injectable()
export class SessionService {
  private readonly USER_SESSION_KEY_PREFIX = 'auth:session:user:'
  private readonly SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async createSession(userId: string): Promise<string> {
    const sessionId = randomBytes(16).toString('hex')
    const previousSessionId = await this.redis.get(this.getUserSessionKey(userId))
    await this.redis.set(this.getUserSessionKey(userId), sessionId, 'EX', this.SESSION_TTL_SECONDS)
    if (previousSessionId && previousSessionId !== sessionId) {
      await this.redis.publish(
        KICK_CHANNEL,
        JSON.stringify({
          userId,
          sessionId: previousSessionId,
          reason: 'NEW_LOGIN',
        }),
      )
    }
    return sessionId
  }

  async getSessionId(userId: string): Promise<string | null> {
    return this.redis.get(this.getUserSessionKey(userId))
  }

  private getUserSessionKey(userId: string) {
    return `${this.USER_SESSION_KEY_PREFIX}${userId}`
  }
}
