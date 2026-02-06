import { Module } from '@nestjs/common';
import { StationService } from './station.service';
import { StatusGateway } from './status.gateway';
import { StationGateway } from './station.gateway';

@Module({
  providers: [StationService, StationGateway, StatusGateway],
  exports: [StationService],
})
export class StationModule {}
