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

const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3100,http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

@WebSocketGateway({
  cors: {
    origin: (requestOrigin, callback) => {
      // 允许所有 localhost 开发环境
      if (!requestOrigin || requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) {
        callback(null, true);
      } else {
        callback(null, CORS_ORIGINS.includes(requestOrigin));
      }
    },
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
    
    // 清理普通房间
    this.roomService.leaveAllRooms(client.id)
    const rooms = Array.from(client.rooms).filter(room => room !== client.id)
    rooms.forEach(roomId => {
      client.to(roomId).emit('peer-disconnected', { peerId: client.id })
    })

    // 清理站点注册（如果是总控掉线）
    const offlineStationId = this.roomService.removeStationBySocketId(client.id)
    if (offlineStationId) {
      this.server.emit('station-disconnected', { stationId: offlineStationId })
    }
  }

  // --- 边缘节点/车场总控 专用接口 ---

  // 1. 总控启动时注册: { stationId: 'bj_01', secret: '...' }
  @SubscribeMessage('register-station')
  handleRegisterStation(
    @MessageBody() data: { stationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.roomService.registerStation(data.stationId, client.id)
    // 广播给所有在线的前端：有新站点上线
    this.server.emit('station-connected', { stationId: data.stationId })
    return { success: true, message: 'Station registered' }
  }

  // 获取当前在线站点列表
  @SubscribeMessage('get-online-stations')
  handleGetOnlineStations() {
    const stations = this.roomService.getOnlineStations()
    return { stations }
  }

  // 3. 邀请站点加入房间 (反向呼叫/对讲)
  @SubscribeMessage('invite-station')
  handleInviteStation(
    @MessageBody() data: { stationId: string; roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const stationSocketId = this.roomService.getStationSocketId(data.stationId)
    if (!stationSocketId) {
      return { error: 'Station offline' }
    }

    console.log(`[Signaling] Inviting station ${data.stationId} to room ${data.roomId}`)
    
    // 发指令给 Edge
    this.server.to(stationSocketId).emit('cmd-station-join-room', {
      roomId: data.roomId,
      inviterId: client.id
    })
    
    return { success: true }
  }

  // 2. 前端请求查看视频: { stationId: 'bj_01', cameraId: 'cam_1' }
  //    云端转发给对应的总控
  @SubscribeMessage('cmd-request-stream')
  handleRequestStream(
    @MessageBody() data: { stationId: string; cameraId: string; offer?: RTCSessionDescriptionInit },
    @ConnectedSocket() client: Socket,
  ) {
    const edgeSocketId = this.roomService.getStationSocketId(data.stationId)
    if (!edgeSocketId) {
      return { error: 'Station offline or not found' }
    }

    console.log(`[Signaling] Forwarding stream request: ${client.id} -> ${data.stationId} (${edgeSocketId})`)
    
    // 转发给总控，携带 requesterId 以便总控回复
    this.server.to(edgeSocketId).emit('cmd-start-stream', {
      requesterId: client.id,
      cameraId: data.cameraId,
      offer: data.offer // 如果是 WebRTC P2P 模式，前端可能直接带 Offer 上来
    })
    
    return { success: true, status: 'request-sent' }
  }

  // 3. 总控回复流信息: { requesterId: '...', status: 'ok', url: '...' }
  //    或者回复 P2P 的 Answer
  @SubscribeMessage('cmd-stream-response')
  handleStreamResponse(
    @MessageBody() data: { requesterId: string; status: string; url?: string; answer?: RTCSessionDescriptionInit; error?: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`[Signaling] Stream response from Edge -> ${data.requesterId}`)
    
    this.server.to(data.requesterId).emit('stream-ready', {
      stationId: this.roomService.getStationId(client.id) || 'unknown',
      ...data
    })
  }

  // --- 原有 P2P 房间接口 ---

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

  // 4. 站点呼叫总控/求助 (Edge -> Center)
  @SubscribeMessage('station-call-center')
  handleStationCallCenter(
    @MessageBody() data: { stationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`[Signaling] Station ${data.stationId} is calling center`)
    // 广播给所有在线的前端（管理员）：有站点呼入
    this.server.emit('incoming-call', { 
      stationId: data.stationId, 
      timestamp: Date.now() 
    })
    return { success: true }
  }
}
