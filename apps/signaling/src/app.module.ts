import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SignalingGateway } from './signaling.gateway'
import { RoomService } from './room.service'
import { AdminGateway } from './admin.gateway'
import { MonitorService } from './monitor.service'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  providers: [SignalingGateway, RoomService, AdminGateway, MonitorService],
})
export class AppModule {}
