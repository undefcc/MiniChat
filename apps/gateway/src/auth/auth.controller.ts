import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('guest')
  async createGuest(@Body() body: { nickname?: string }) {
    return this.authService.createGuestToken(body.nickname)
  }

  @Post('register')
  async register(@Body() body: { email: string; password: string; nickname: string }) {
    return this.authService.register(body.email, body.password, body.nickname)
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password)
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return req.user
  }
}
