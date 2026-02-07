import { Controller, Get, UseGuards } from '@nestjs/common'
import { StationService } from './station.service'
import { HttpJwtAuthGuard } from '../auth/http-jwt-auth.guard'

@Controller('stations')
@UseGuards(HttpJwtAuthGuard)
export class StationController {
  constructor(private readonly stationService: StationService) {}

  @Get('online')
  async getOnlineStations() {
    const stations = await this.stationService.getOnlineStations()
    return { stations }
  }
}
