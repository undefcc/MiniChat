export enum UserType {
  GUEST = 'guest',
  REGISTERED = 'registered',
}

export interface TokenPayload {
  userId: string
  type: UserType
  nickname: string
}