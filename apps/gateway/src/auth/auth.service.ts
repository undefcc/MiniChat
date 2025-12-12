import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'

export enum UserType {
  GUEST = 'guest',
  REGISTERED = 'registered',
}

export interface TokenPayload {
  userId: string
  type: UserType
  nickname: string
}

@Injectable()
export class AuthService {
  // TODO: Replace with actual database
  private users = new Map<string, any>()

  constructor(private jwtService: JwtService) {}

  async createGuestToken(nickname?: string): Promise<{ accessToken: string; user: any }> {
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const guestNickname = nickname || `访客${Math.floor(Math.random() * 9999)}`

    const payload: TokenPayload = {
      userId: guestId,
      type: UserType.GUEST,
      nickname: guestNickname,
    }

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: guestId,
        type: UserType.GUEST,
        nickname: guestNickname,
      },
    }
  }

  async register(email: string, password: string, nickname: string) {
    if (this.users.has(email)) {
      throw new UnauthorizedException('User already exists')
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const userId = `user_${Date.now()}`

    this.users.set(email, {
      id: userId,
      email,
      password: hashedPassword,
      nickname,
      type: UserType.REGISTERED,
    })

    const payload: TokenPayload = {
      userId,
      type: UserType.REGISTERED,
      nickname,
    }

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: userId,
        email,
        nickname,
        type: UserType.REGISTERED,
      },
    }
  }

  async login(email: string, password: string) {
    const user = this.users.get(email)
    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const payload: TokenPayload = {
      userId: user.id,
      type: user.type,
      nickname: user.nickname,
    }

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        type: user.type,
      },
    }
  }

  async validateUser(payload: TokenPayload) {
    return payload
  }
}
