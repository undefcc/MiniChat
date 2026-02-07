import { Module } from '@nestjs/common';
import { StationController } from './station.controller';
import { StationService } from './station.service';
import { StatusGateway } from './status.gateway';
import { StationGateway } from './station.gateway';

@Module({
  controllers: [StationController],
  providers: [StationService, StationGateway, StatusGateway],
  exports: [StationService],
})
export class StationModule {}
