import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SignalingGateway } from './signaling.gateway'
import { RoomService } from './room.service'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  providers: [SignalingGateway, RoomService],
})
export class AppModule {}
