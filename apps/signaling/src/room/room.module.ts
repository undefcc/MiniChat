import { Module } from '@nestjs/common';
import { RoomService } from './room.service';
import { SignalingGateway } from './signaling.gateway';
import { RoomGateway } from './room.gateway';

@Module({
  providers: [RoomService, RoomGateway, SignalingGateway],
  exports: [RoomService],
})
export class RoomModule {}
