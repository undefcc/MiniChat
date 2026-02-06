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
