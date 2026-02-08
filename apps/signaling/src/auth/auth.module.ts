import { Global, Module } from '@nestjs/common'
import { AuthDiagnosticsController } from './auth-diagnostics.controller'
import { HttpJwtAuthGuard } from './http-jwt-auth.guard'
import { JwtVerifierService } from './jwt-verifier.service'
import { SessionKickSubscriber } from './session-kick.subscriber'
import { SessionStoreService } from './session-store.service'
import { SocketRegistryService } from './socket-registry.service'
import { WsJwtAuthGuard } from './ws-jwt-auth.guard'

@Global()
@Module({
  controllers: [AuthDiagnosticsController], // REST API占位用
  providers: [
    JwtVerifierService,
    SessionStoreService,
    SocketRegistryService,
    SessionKickSubscriber,
    WsJwtAuthGuard,
    HttpJwtAuthGuard,
  ],
  exports: [JwtVerifierService, SessionStoreService, SocketRegistryService, WsJwtAuthGuard, HttpJwtAuthGuard],
})
export class AuthModule {}
