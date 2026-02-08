import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { StationService } from './station.service'
import { Injectable, UseGuards } from '@nestjs/common'
import { WsJwtAuthGuard } from '../auth/ws-jwt-auth.guard'
import { wsException } from '../common/ws-errors'
import { JwtVerifierService } from '../auth/jwt-verifier.service'
import { SessionStoreService } from '../auth/session-store.service'
import { SocketRegistryService } from '../auth/socket-registry.service'
import { applyWsAuthMiddleware } from '../auth/ws-auth.middleware'

const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3100,http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

@UseGuards(WsJwtAuthGuard)
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
export class StationGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server

  constructor(
    private stationService: StationService,
    private readonly verifier: JwtVerifierService,
    private readonly sessionStore: SessionStoreService,
    private readonly socketRegistry: SocketRegistryService,
  ) {}

  afterInit(server: Server) {
    this.socketRegistry.register(server)
    applyWsAuthMiddleware(server, this.verifier, this.sessionStore)
  }

  handleConnection(client: Socket) {
    // console.log(`[StationGateway] Client connected: ${client.id}`)
  }

  async handleDisconnect(client: Socket) {
    // 清理站点注册（如果是总控/TOC掉线）
    const offlineStationId = await this.stationService.removeStationBySocketId(client.id)
    if (offlineStationId) {
      this.server.emit('station-disconnected', { stationId: offlineStationId })
    }
  }

  // --- Station Management ---

  // 1. 站点上线注册 (Edge -> Cloud)
  @SubscribeMessage('station-register')
  async handleRegisterStation(
    @MessageBody() data: { stationId: string; sessionId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      console.log(`[StationGateway] Station Registered: ${data.stationId} (Socket: ${client.id})`)
      await this.stationService.registerStation(data.stationId, client.id, { sessionId: data.sessionId })
      // 广播给前端：站点上线
      this.server.emit('station-connected', { stationId: data.stationId })
      return { stationId: data.stationId }
    } catch (error) {
      console.error(`[StationGateway] Register failed for ${data.stationId}:`, error)
      // 返回友好的错误信息而不是让 NestJS 抛出 Internal Error
      throw wsException('INTERNAL', 'Register failed')
    }
  }

  // 获取当前在线站点列表
  @SubscribeMessage('get-online-stations')
  async handleGetOnlineStations() {
    try {
      const stations = await this.stationService.getOnlineStations()
      return { stations }
    } catch (error) {
      console.error(`[StationGateway] Get online stations failed:`, error)
      throw wsException('INTERNAL', 'Get stations failed')
    }
  }

  // 邀请站点加入房间 (反向呼叫/对讲)
  @SubscribeMessage('station-invite')
  async handleInviteStation(
    @MessageBody() data: { stationId: string; roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const stationSocketId = await this.stationService.getStationSocketId(data.stationId)
    if (!stationSocketId) {
      throw wsException('STATION_OFFLINE', 'Station offline')
    }

    console.log(`[StationGateway] Inviting station ${data.stationId} to room ${data.roomId}`)
    
    // 发指令给 Edge
    this.server.to(stationSocketId).emit('station-cmd-join-room', {
      roomId: data.roomId,
      inviterId: client.id
    })
    
    return undefined
  }

  // 站点呼叫总控/求助 (Edge -> Center)
  @SubscribeMessage('station-call-center')
  handleStationCallCenter(
    @MessageBody() data: { stationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`[StationGateway] Station ${data.stationId} is calling center`)
    this.server.emit('station-incoming-call', { 
      stationId: data.stationId, 
      timestamp: Date.now() 
    })
    return undefined
  }

  // 前端请求查看视频 (Cloud -> Edge)
  @SubscribeMessage('station-cmd-request-stream')
  async handleRequestStream(
    @MessageBody() data: { stationId: string; cameraId: string; offer?: RTCSessionDescriptionInit },
    @ConnectedSocket() client: Socket,
  ) {
    const edgeSocketId = await this.stationService.getStationSocketId(data.stationId)
    if (!edgeSocketId) {
      throw wsException('STATION_OFFLINE', 'Station offline or not found')
    }

    console.log(`[StationGateway] Forwarding stream request: ${client.id} -> ${data.stationId}`)
    
    this.server.to(edgeSocketId).emit('station-cmd-start-stream', {
      requesterId: client.id,
      cameraId: data.cameraId,
      offer: data.offer
    })
    
    return { status: 'request-sent' }
  }

  // 总控回复流信息
  @SubscribeMessage('station-cmd-stream-response')
  async handleStreamResponse(
    @MessageBody() data: { requesterId: string; status: string; url?: string; answer?: RTCSessionDescriptionInit; error?: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.requesterId).emit('station-stream-ready', {
      stationId: await this.stationService.getStationId(client.id) || 'unknown',
      ...data
    })
  }
}
