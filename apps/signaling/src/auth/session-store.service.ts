import { Injectable } from '@nestjs/common'
import { InjectRedis } from '@nestjs-modules/ioredis'
import Redis from 'ioredis'

@Injectable()
export class SessionStoreService {
  private readonly USER_SESSION_KEY_PREFIX = 'auth:session:user:'

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async getSessionId(userId: string): Promise<string | null> {
    return this.redis.get(this.getUserSessionKey(userId))
  }

  private getUserSessionKey(userId: string) {
    return `${this.USER_SESSION_KEY_PREFIX}${userId}`
  }
}
