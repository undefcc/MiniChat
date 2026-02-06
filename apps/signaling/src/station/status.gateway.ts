import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { StationService } from './station.service'
import * as mqtt from 'mqtt'
import { OnModuleInit, OnModuleDestroy, Injectable } from '@nestjs/common'

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
export class StatusGateway implements OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server: Server

  // MQTT Client
  private mqttClient: mqtt.MqttClient

  // 状态聚合缓冲区 { stationId: payload }
  private statusBuffer: Map<string, any> = new Map()
  // 聚合推送定时器
  private flushInterval: NodeJS.Timeout

  constructor(
    private stationService: StationService,
  ) {}

  onModuleInit() {
    this.startStatusFlushLoop()
    this.initMqtt()
  }

  onModuleDestroy() {
    if (this.mqttClient) {
      this.mqttClient.end()
    }
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
  }

  private initMqtt() {
    console.log('[MQTT] Connecting to broker...')
    // 连接到本地 MQTT Broker
    this.mqttClient = mqtt.connect(process.env.MQTT_URL || 'mqtt://localhost:1883', {
      clientId: 'signaling-server-' + Math.random().toString(16).substr(2, 8),
      clean: true,
    })

    this.mqttClient.on('connect', () => {
      console.log('[MQTT] Connected to broker (StatusGateway)')
      // 订阅所有站点的状态上报 Topic
      this.mqttClient.subscribe('stations/+/status', (err) => {
        if (!err) {
          console.log('[MQTT] Subscribed to stations/+/status')
        }
      })
    })

    this.mqttClient.on('error', (err) => {
      console.error('[MQTT] Client error:', err)
    })

    this.mqttClient.on('message', (topic, message) => {
      try {
        const payload = JSON.parse(message.toString())
        const parts = topic.split('/')
        // stations/bj-01/status
        const stationId = parts[1]
        
        if (stationId && payload) {
            this.processStatusUpdate(stationId, payload)
        }
      } catch (e) {
        console.error('[MQTT] Failed to parse message', e)
      }
    })
  }

  // 移除 MQTT 离线处理，完全由 ManagementGateway WebSocket 负责生命周期
  // private handleStationOffline(stationId: string, payload: any) { ... }

  private processStatusUpdate(stationId: string, data: any) {
    const updatedAt = data.updatedAt || Date.now();
    const now = Date.now();

    // 检查数据是否过期 (只接受过去 15 秒内的数据)
    if (now - updatedAt > 15000) {
        // console.warn(`[StatusGateway] Ignoring stale status for ${stationId}`)
        return;
    }

    // 关键变更：如果站点未在 RoomService 注册（即未连接 WebSocket），直接忽略 MQTT 数据
    // 这确保了 WS 断开后，后端不再处理该站点的任何 MQTT 消息
    if (!this.stationService.getStationSocketId(stationId)) {
        // Option: console.debug(`[StatusGateway] Ignoring MQTT data for offline station: ${stationId}`)
        
        // 临时 Debug: 打印未能匹配的 stationId，帮助排查注册问题
        // console.log(`[StatusGateway] Ignored MQTT for unregistered: ${stationId}`)
        return;
    }

    const payload = {
      ...data,
      stationId,
      updatedAt,
    }

    // 存入 Buffer，等待 Batch 推送
    this.statusBuffer.set(stationId, payload)
  }

  private startStatusFlushLoop() {
    this.flushInterval = setInterval(() => {
      this.flushStatusBuffer()
    }, 1000)
  }

  private flushStatusBuffer() {
    if (this.statusBuffer.size === 0) return

    // 将 Map 转换为数组进行批量广播
    const updates = Array.from(this.statusBuffer.values())
    // 广播事件：'batch-station-status-update'
    this.server.emit('batch-station-status-update', updates)
    
    // 清空 Buffer
    this.statusBuffer.clear()
  }

  // 前端请求站点设备状态 (Center -> Edge)
  // 如果是 MQTT 设备，我们需要通过 MQTT 下发指令
  @SubscribeMessage('request-station-status')
  handleRequestStationStatus(
    @MessageBody() data: { stationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const stationSocketId = this.stationService.getStationSocketId(data.stationId)
    
    // 如果是 MQTT 注册的虚拟 ID，或者找不到 Socket，尝试 MQTT 下发
    if (!stationSocketId || stationSocketId.startsWith('mqtt:')) {
        if (this.mqttClient && this.mqttClient.connected) {
            const cmd = {
                type: 'report-status',
                requesterId: client.id
            }
            this.mqttClient.publish(`stations/${data.stationId}/cmd`, JSON.stringify(cmd))
            return { success: true, via: 'mqtt' }
        }
    }
    
    // 如果有 Socket 连接 (ManagementGateway 会处理 Socket 路由吗？)
    // 这里要注意：request-station-status 也是一种 Station Interaction。 
    // 上面 ManagementGateway 也有这个吗？ 
    // 之前 StationGateway 里有这个。
    // 如果 Station 是纯 Socket 连的，ManagementGateway 处理。
    // 如果 Station 是 MQTT 连的，StatusGateway 处理。
    // 为了简单，可以让 StatusGateway 处理 MQTT，ManagementGateway 处理 Socket。
    // 或者 StatusGateway 负责所有 Status 相关的 Command。
    
    return { error: 'Station unreachable or handled by ManagementGateway' }
  }
}
