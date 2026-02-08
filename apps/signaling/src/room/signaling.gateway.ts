import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Injectable, UseGuards } from '@nestjs/common'
import { WsJwtAuthGuard } from '../auth/ws-jwt-auth.guard'
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
export class SignalingGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server

  constructor(
    private readonly verifier: JwtVerifierService,
    private readonly sessionStore: SessionStoreService,
    private readonly socketRegistry: SocketRegistryService,
  ) {}

  afterInit(server: Server) {
    this.socketRegistry.register(server)
    applyWsAuthMiddleware(server, this.verifier, this.sessionStore)
  }

  // 纯 WebRTC 信令交换
  // 注意：用户必须已经通过 ManagementGateway 加入了 create-room/join-room 对应的 socket.io 房间
  // 这里才能使用 client.to(roomId) 或者 client.to(peerId) 进行转发

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
}
