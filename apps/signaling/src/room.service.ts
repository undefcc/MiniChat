import { Injectable } from '@nestjs/common'

interface Room {
  id: string
  creatorId: string
  peers: Set<string>
  createdAt: Date
}

@Injectable()
export class RoomService {
  private rooms = new Map<string, Room>()
  // 站点映射: stationId -> socketId (边缘节点/总控)
  private stations = new Map<string, string>()
  // socketId -> stationId 的反向映射，用于断开连接时快速清理
  private socketToStation = new Map<string, string>()

  // 注册站点（总控上线）
  registerStation(stationId: string, socketId: string) {
    // 如果该站点已有旧连接，可以覆盖或拒绝，这里选择覆盖
    const oldSocketId = this.stations.get(stationId)
    if (oldSocketId) {
      this.socketToStation.delete(oldSocketId)
    }
    
    this.stations.set(stationId, socketId)
    this.socketToStation.set(socketId, stationId)
    console.log(`[RoomService] Station registered: ${stationId} -> ${socketId}`)
  }

  // 获取站点的 socketId
  getStationSocketId(stationId: string): string | undefined {
    return this.stations.get(stationId)
  }

  getStationId(socketId: string): string | undefined {
    return this.socketToStation.get(socketId)
  }

  // 移除站点（断开连接）
  removeStationBySocketId(socketId: string): string | null {
    const stationId = this.socketToStation.get(socketId)
    if (stationId) {
      this.stations.delete(stationId)
      this.socketToStation.delete(socketId)
      console.log(`[RoomService] Station disconnected: ${stationId}`)
      return stationId
    }
    return null
  }

  getOnlineStations(): string[] {
    return Array.from(this.stations.keys())
  }

  createRoom(creatorId: string): string {
    const roomId = this.generateRoomId()
    this.rooms.set(roomId, {
      id: roomId,
      creatorId,
      peers: new Set([creatorId]),
      createdAt: new Date(),
    })
    return roomId
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  addPeerToRoom(roomId: string, peerId: string) {
    const room = this.rooms.get(roomId)
    if (room) {
      room.peers.add(peerId)
    }
  }

  removePeerFromRoom(roomId: string, peerId: string) {
    const room = this.rooms.get(roomId)
    if (room) {
      room.peers.delete(peerId)
      if (room.peers.size === 0) {
        this.rooms.delete(roomId)
      }
    }
  }

  leaveAllRooms(peerId: string) {
    this.rooms.forEach((room, roomId) => {
      if (room.peers.has(peerId)) {
        this.removePeerFromRoom(roomId, peerId)
      }
    })
  }

  getAllRooms(): Record<string, string[]> {
    const result: Record<string, string[]> = {}
    this.rooms.forEach((room, roomId) => {
      result[roomId] = Array.from(room.peers)
    })
    return result
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 10)
  }
}
