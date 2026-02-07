import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'
import { UserType } from '../auth.types'

export type UserDocument = HydratedDocument<User>

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  email: string

  @Prop({ required: true })
  password: string

  @Prop({ required: true })
  nickname: string

  @Prop({ required: true, enum: UserType, default: UserType.REGISTERED })
  type: UserType
}

export const UserSchema = SchemaFactory.createForClass(User)