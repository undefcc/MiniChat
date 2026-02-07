import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { RoomService } from './room.service'
import { HttpJwtAuthGuard } from '../auth/http-jwt-auth.guard'

@Controller('rooms')
@UseGuards(HttpJwtAuthGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post()
  createRoom() {
    const roomId = this.roomService.createRoom()
    return { roomId }
  }

  @Get(':roomId/exists')
  checkRoom(@Param('roomId') roomId: string) {
    const room = this.roomService.getRoom(roomId)
    return { exists: !!room }
  }
}
