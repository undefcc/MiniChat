import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { StationService } from './station.service'
import { Injectable } from '@nestjs/common'

const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3100,http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

@WebSocketGateway({
  cors: {
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) {
        callback(null, true);
      } else {
        callback(null, CORS_ORIGINS.includes(requestOrigin));
      }
    },
    credentials: true,
  },
})
@Injectable()
export class StationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  constructor(
    private stationService: StationService,
  ) {}

  handleConnection(client: Socket) {
    // console.log(`[StationGateway] Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    // 清理站点注册（如果是总控/TOC掉线）
    const offlineStationId = this.stationService.removeStationBySocketId(client.id)
    if (offlineStationId) {
      this.server.emit('station-disconnected', { stationId: offlineStationId })
    }
  }

  // --- Station Management ---

  // 1. 站点上线注册 (Edge -> Cloud)
  @SubscribeMessage('register-station')
  handleRegisterStation(
    @MessageBody() data: { stationId: string; sessionId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`[StationGateway] Station Registered: ${data.stationId} (Socket: ${client.id})`)
    this.stationService.registerStation(data.stationId, client.id, { sessionId: data.sessionId })
    // 广播给前端：站点上线
    this.server.emit('station-connected', { stationId: data.stationId })
    return { success: true }
  }

  // 获取当前在线站点列表
  @SubscribeMessage('get-online-stations')
  handleGetOnlineStations() {
    const stations = this.stationService.getOnlineStations()
    return { stations }
  }

  // 邀请站点加入房间 (反向呼叫/对讲)
  @SubscribeMessage('invite-station')
  handleInviteStation(
    @MessageBody() data: { stationId: string; roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const stationSocketId = this.stationService.getStationSocketId(data.stationId)
    if (!stationSocketId) {
      return { error: 'Station offline' }
    }

    console.log(`[StationGateway] Inviting station ${data.stationId} to room ${data.roomId}`)
    
    // 发指令给 Edge
    this.server.to(stationSocketId).emit('cmd-station-join-room', {
      roomId: data.roomId,
      inviterId: client.id
    })
    
    return { success: true }
  }

  // 站点呼叫总控/求助 (Edge -> Center)
  @SubscribeMessage('station-call-center')
  handleStationCallCenter(
    @MessageBody() data: { stationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`[StationGateway] Station ${data.stationId} is calling center`)
    this.server.emit('incoming-call', { 
      stationId: data.stationId, 
      timestamp: Date.now() 
    })
    return { success: true }
  }

  // 前端请求查看视频 (Cloud -> Edge)
  @SubscribeMessage('cmd-request-stream')
  handleRequestStream(
    @MessageBody() data: { stationId: string; cameraId: string; offer?: RTCSessionDescriptionInit },
    @ConnectedSocket() client: Socket,
  ) {
    const edgeSocketId = this.stationService.getStationSocketId(data.stationId)
    if (!edgeSocketId) {
      return { error: 'Station offline or not found' }
    }

    console.log(`[StationGateway] Forwarding stream request: ${client.id} -> ${data.stationId}`)
    
    this.server.to(edgeSocketId).emit('cmd-start-stream', {
      requesterId: client.id,
      cameraId: data.cameraId,
      offer: data.offer
    })
    
    return { success: true, status: 'request-sent' }
  }

  // 总控回复流信息
  @SubscribeMessage('cmd-stream-response')
  handleStreamResponse(
    @MessageBody() data: { requesterId: string; status: string; url?: string; answer?: RTCSessionDescriptionInit; error?: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.requesterId).emit('stream-ready', {
      stationId: this.stationService.getStationId(client.id) || 'unknown',
      ...data
    })
  }
}
