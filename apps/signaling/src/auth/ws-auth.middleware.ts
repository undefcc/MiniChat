import { Server, Socket } from 'socket.io'
import { JwtVerifierService } from './jwt-verifier.service'
import { extractTokenFromSocket } from './ws-auth.utils'

const AUTH_MIDDLEWARE_FLAG = Symbol.for('minichat.wsAuthMiddlewareApplied')

export function applyWsAuthMiddleware(server: Server, verifier: JwtVerifierService) {
  const serverAny = server as unknown as { [AUTH_MIDDLEWARE_FLAG]?: boolean }
  if (serverAny[AUTH_MIDDLEWARE_FLAG]) return
  serverAny[AUTH_MIDDLEWARE_FLAG] = true

  server.use(async (socket: Socket, next) => {
    const token = extractTokenFromSocket(socket)
    if (!token) {
      const err = new Error('UNAUTHORIZED') as Error & { data?: { code: string; message: string } }
      err.data = { code: 'UNAUTHORIZED', message: 'Unauthorized' }
      return next(err)
    }

    try {
      const payload = await verifier.verifyToken(token)
      socket.data.user = payload
      return next()
    } catch {
      const err = new Error('UNAUTHORIZED') as Error & { data?: { code: string; message: string } }
      err.data = { code: 'UNAUTHORIZED', message: 'Unauthorized' }
      return next(err)
    }
  })
}
