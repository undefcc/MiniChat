import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { RoomService } from './room.service'

const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3100')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

@WebSocketGateway({
  cors: {
    origin: CORS_ORIGINS,
    credentials: true,
  },
})
export class SignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  constructor(private roomService: RoomService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`)
    this.roomService.leaveAllRooms(client.id)
    
    // 通知房间内其他用户
    const rooms = Array.from(client.rooms).filter(room => room !== client.id)
    rooms.forEach(roomId => {
      client.to(roomId).emit('peer-disconnected', { peerId: client.id })
    })
  }

  @SubscribeMessage('create-room')
  handleCreateRoom(@ConnectedSocket() client: Socket) {
    const roomId = this.roomService.createRoom(client.id)
    client.join(roomId)
    return { roomId }
  }

  @SubscribeMessage('check-room')
  handleCheckRoom(
    @MessageBody() data: { roomId: string },
  ) {
    const room = this.roomService.getRoom(data.roomId)
    return { exists: !!room }
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId } = data
    const room = this.roomService.getRoom(roomId)

    if (!room) {
      return { error: 'Room not found' }
    }

    client.join(roomId)
    this.roomService.addPeerToRoom(roomId, client.id)

    // 通知房间内其他用户有新成员加入
    client.to(roomId).emit('peer-joined', { peerId: client.id })

    // 返回房间内现有的所有用户
    return {
      roomId,
      peers: Array.from(room.peers).filter(id => id !== client.id),
    }
  }

  @SubscribeMessage('offer')
  handleOffer(
    @MessageBody() data: { to: string; offer: RTCSessionDescriptionInit },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.to).emit('offer', {
      from: client.id,
      offer: data.offer,
    })
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @MessageBody() data: { to: string; answer: RTCSessionDescriptionInit },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.to).emit('answer', {
      from: client.id,
      answer: data.answer,
    })
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @MessageBody() data: { to: string; candidate: RTCIceCandidateInit },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.to).emit('ice-candidate', {
      from: client.id,
      candidate: data.candidate,
    })
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId } = data
    client.leave(roomId)
    this.roomService.removePeerFromRoom(roomId, client.id)
    
    // 通知房间内其他用户
    client.to(roomId).emit('peer-left', { peerId: client.id })
  }
}
