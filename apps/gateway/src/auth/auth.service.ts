import { Injectable, UnauthorizedException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { JwtService } from '@nestjs/jwt'
import { Model } from 'mongoose'
import * as bcrypt from 'bcryptjs'
import { TokenPayload, UserType } from './auth.types'
import { User, UserDocument } from './schemas/user.schema'

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<UserDocument>
  ) {}

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
    const existingUser = await this.userModel.findOne({ email }).lean()
    if (existingUser) {
      throw new UnauthorizedException('该用户已注册，请前往登录')
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    let user: UserDocument
    try {
      user = await this.userModel.create({
        email,
        password: hashedPassword,
        nickname,
        type: UserType.REGISTERED,
      })
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new UnauthorizedException('该用户已注册，请前往登录')
      }
      throw error
    }

    const payload: TokenPayload = {
      userId: user.id,
      type: UserType.REGISTERED,
      nickname,
    }

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email,
        nickname,
        type: UserType.REGISTERED,
      },
    }
  }

  async login(email: string, password: string) {
    const user = await this.userModel.findOne({ email })
    if (!user) {
      throw new UnauthorizedException('该用户不存在或密码错误')
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      throw new UnauthorizedException('该用户不存在或密码错误')
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
