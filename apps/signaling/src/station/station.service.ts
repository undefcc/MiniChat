import { Injectable } from '@nestjs/common'
import { InjectRedis } from '@nestjs-modules/ioredis'
import Redis from 'ioredis'

@Injectable()
export class StationService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private readonly KEY_PREFIX = 'signaling:station:'
  private readonly ONLINE_SET_KEY = 'signaling:stations:online'

  private getStationKey(stationId: string) {
    return `${this.KEY_PREFIX}${stationId}:socket`
  }

  private getSocketKey(socketId: string) {
    return `${this.KEY_PREFIX}sock:${socketId}`
  }

  private getMetaKey(stationId: string) {
    return `${this.KEY_PREFIX}${stationId}:meta`
  }

  // 注册站点（总控上线）
  async registerStation(stationId: string, socketId: string, metadata: any = {}) {
    // Pipeline for atomicity and performance
    const pipeline = this.redis.pipeline()

    // 1. 如果该站点已有旧连接，清理旧连接的反向映射
    const oldSocketId = await this.redis.get(this.getStationKey(stationId))
    if (oldSocketId) {
      pipeline.del(this.getSocketKey(oldSocketId))
    }

    // 2. 设置新的映射
    pipeline.set(this.getStationKey(stationId), socketId)
    pipeline.set(this.getSocketKey(socketId), stationId)
    pipeline.set(this.getMetaKey(stationId), JSON.stringify(metadata))
    
    // 3. 加入在线列表
    pipeline.sadd(this.ONLINE_SET_KEY, stationId)

    // 设置过期时间 (例如 24小时，防止僵尸数据，虽然通常依靠 disconnect 清理)
    pipeline.expire(this.getStationKey(stationId), 86400)
    pipeline.expire(this.getSocketKey(socketId), 86400)
    pipeline.expire(this.getMetaKey(stationId), 86400)

    await pipeline.exec()
    console.log(`[StationService] Station registered: ${stationId} -> ${socketId} (Meta: ${JSON.stringify(metadata)})`)
  }

  // 获取站点元数据
  async getStationMetadata(stationId: string): Promise<any> {
      const data = await this.redis.get(this.getMetaKey(stationId))
      return data ? JSON.parse(data) : null
  }

  // 获取站点的 socketId
  async getStationSocketId(stationId: string): Promise<string | null> {
    return this.redis.get(this.getStationKey(stationId))
  }

  async getStationId(socketId: string): Promise<string | null> {
    return this.redis.get(this.getSocketKey(socketId))
  }

  // 移除站点（通过 ID）
  async removeStation(stationId: string): Promise<boolean> {
    const socketId = await this.redis.get(this.getStationKey(stationId))
    if (socketId) {
        const pipeline = this.redis.pipeline()
        pipeline.del(this.getStationKey(stationId))
        pipeline.del(this.getSocketKey(socketId))
        pipeline.del(this.getMetaKey(stationId))
        pipeline.srem(this.ONLINE_SET_KEY, stationId)
        await pipeline.exec()

        console.log(`[StationService] Station disconnected (MQTT LWT/Manual): ${stationId}`)
        return true
    }
    return false
  }

  // 移除站点（断开连接）
  async removeStationBySocketId(socketId: string): Promise<string | null> {
    const stationId = await this.redis.get(this.getSocketKey(socketId))
    if (stationId) {
      const pipeline = this.redis.pipeline()
      pipeline.del(this.getStationKey(stationId))
      pipeline.del(this.getSocketKey(socketId))
      pipeline.del(this.getMetaKey(stationId))
      pipeline.srem(this.ONLINE_SET_KEY, stationId)
      await pipeline.exec()

      console.log(`[StationService] Station disconnected: ${stationId}`)
      return stationId
    }
    return null
  }

  async getOnlineStations(): Promise<string[]> {
    return this.redis.smembers(this.ONLINE_SET_KEY)
  }
}
