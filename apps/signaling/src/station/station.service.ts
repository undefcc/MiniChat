import { Injectable } from '@nestjs/common'

@Injectable()
export class StationService {
  // 站点映射: stationId -> socketId (边缘节点/总控)
  private stations = new Map<string, string>()
  // socketId -> stationId 的反向映射，用于断开连接时快速清理
  private socketToStation = new Map<string, string>()
  // stationId -> session metadata (e.g. { sessionId: 'uuid' })
  private stationMetadata = new Map<string, any>()

  // 注册站点（总控上线）
  registerStation(stationId: string, socketId: string, metadata: any = {}) {
    // 如果该站点已有旧连接，可以覆盖或拒绝，这里选择覆盖
    const oldSocketId = this.stations.get(stationId)
    if (oldSocketId) {
      this.socketToStation.delete(oldSocketId)
    }
    
    this.stations.set(stationId, socketId)
    this.socketToStation.set(socketId, stationId)
    this.stationMetadata.set(stationId, metadata)
    console.log(`[StationService] Station registered: ${stationId} -> ${socketId} (Meta: ${JSON.stringify(metadata)})`)
  }

  // 获取站点元数据
  getStationMetadata(stationId: string): any {
      return this.stationMetadata.get(stationId)
  }

  // 获取站点的 socketId
  getStationSocketId(stationId: string): string | undefined {
    return this.stations.get(stationId)
  }

  getStationId(socketId: string): string | undefined {
    return this.socketToStation.get(socketId)
  }

  // 移除站点（通过 ID）
  removeStation(stationId: string): boolean {
    const socketId = this.stations.get(stationId)
    if (socketId) {
        this.stations.delete(stationId)
        this.socketToStation.delete(socketId)
        this.stationMetadata.delete(stationId)
        console.log(`[StationService] Station disconnected (MQTT LWT): ${stationId}`)
        return true
    }
    return false
  }

  // 移除站点（断开连接）
  removeStationBySocketId(socketId: string): string | null {
    const stationId = this.socketToStation.get(socketId)
    if (stationId) {
      this.stations.delete(stationId)
      this.socketToStation.delete(socketId)
      this.stationMetadata.delete(stationId)
      console.log(`[StationService] Station disconnected: ${stationId}`)
      return stationId
    }
    return null
  }

  getOnlineStations(): string[] {
    return Array.from(this.stations.keys())
  }
}
