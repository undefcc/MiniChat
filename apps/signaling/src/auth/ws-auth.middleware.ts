import { Server, Socket } from 'socket.io'
import { JwtVerifierService } from './jwt-verifier.service'
import { SessionStoreService } from './session-store.service'
import { extractTokenFromSocket } from './ws-auth.utils'

const AUTH_MIDDLEWARE_FLAG = Symbol.for('minichat.wsAuthMiddlewareApplied')

export function applyWsAuthMiddleware(
  server: Server,
  verifier: JwtVerifierService,
  sessionStore: SessionStoreService,
) {
  const serverAny = server as unknown as { [AUTH_MIDDLEWARE_FLAG]?: boolean }
  if (serverAny[AUTH_MIDDLEWARE_FLAG]) return
  serverAny[AUTH_MIDDLEWARE_FLAG] = true

  server.use(async (socket: Socket, next) => {
    const token = extractTokenFromSocket(socket)
    if (!token) {
      return next(new Error('UNAUTHORIZED: Unauthorized'))
    }

    try {
      const payload = await verifier.verifyToken(token)
      const userId = typeof payload.userId === 'string' ? payload.userId : undefined
      const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : undefined

      if (!userId || !sessionId) {
        return next(new Error('UNAUTHORIZED: invalid userId or sessionId'))
      }

      const activeSessionId = await sessionStore.getSessionId(userId)
      if (!activeSessionId || activeSessionId !== sessionId) {
        return next(new Error('UNAUTHORIZED: session mismatch detected'))
      }

      socket.data.user = payload
      return next()
    } catch {
      return next(new Error('UNAUTHORIZED: Unauthorized'))
    }
  })
}
