import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AdminGateway } from './admin/admin.gateway'
import { MonitorService } from './admin/monitor.service'
import { RoomModule } from './room/room.module'
import { StationModule } from './station/station.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RoomModule,
    StationModule,
  ],
  providers: [
      AdminGateway, 
      MonitorService
  ],
})
export class AppModule {}
