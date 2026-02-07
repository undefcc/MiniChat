import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { MonitorService } from './monitor.service';
import { WsJwtAuthGuard } from '../auth/ws-jwt-auth.guard';

@UseGuards(WsJwtAuthGuard)
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/admin',
})
export class AdminGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private updateInterval: NodeJS.Timeout | null = null;

  constructor(private readonly monitorService: MonitorService) {}

  handleConnection(client: Socket) {
    console.log(`[Admin] Client connected: ${client.id}`);
    
    // 立即发送初始数据
    this.sendUpdate();
    
    // 启动定时推送（每2秒）
    if (!this.updateInterval) {
      this.updateInterval = setInterval(() => {
        this.sendUpdate();
      }, 2000);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`[Admin] Client disconnected: ${client.id}`);
    
    // 如果没有管理员连接，停止推送
    if (this.server?.sockets?.sockets?.size === 0) {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
    }
  }

  private async sendUpdate() {
    try {
      if (!this.server) {
        return;
      }

      const [rooms, stats, onlineUsers] = await Promise.all([
        this.monitorService.getAllRooms(),
        this.monitorService.getSystemStats(),
        this.monitorService.getOnlineUserCount(),
      ]);

      this.server.emit('monitor-update', {
        timestamp: Date.now(),
        rooms,
        stats,
        onlineUsers,
        roomCount: rooms.length,
      });
    } catch (error) {
      console.error('[Admin] Failed to send update:', error);
    }
  }
}
