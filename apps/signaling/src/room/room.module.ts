import { Module } from '@nestjs/common';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { SignalingGateway } from './signaling.gateway';
import { RoomGateway } from './room.gateway';

@Module({
  controllers: [RoomController],
  providers: [RoomService, RoomGateway, SignalingGateway],
  exports: [RoomService],
})
export class RoomModule {}
