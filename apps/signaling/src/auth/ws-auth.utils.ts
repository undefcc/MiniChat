import { Socket } from 'socket.io'

export function extractTokenFromSocket(client: Socket): string | undefined {
  const authToken = client.handshake.auth?.token
  if (typeof authToken === 'string' && authToken.trim().length) {
    return authToken.trim()
  }

  const header = client.handshake.headers?.authorization
  if (Array.isArray(header)) {
    const fromArray = header.find(item => item.toLowerCase().startsWith('bearer '))
    if (fromArray) {
      return fromArray.slice(7).trim()
    }
  } else if (typeof header === 'string') {
    if (header.toLowerCase().startsWith('bearer ')) {
      return header.slice(7).trim()
    }
  }

  const queryToken = client.handshake.query?.token
  if (typeof queryToken === 'string' && queryToken.trim().length) {
    return queryToken.trim()
  }

  return undefined
}
