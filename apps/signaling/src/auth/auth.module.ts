import { Global, Module } from '@nestjs/common'
import { AuthDiagnosticsController } from './auth-diagnostics.controller'
import { HttpJwtAuthGuard } from './http-jwt-auth.guard'
import { JwtVerifierService } from './jwt-verifier.service'
import { WsJwtAuthGuard } from './ws-jwt-auth.guard'

@Global()
@Module({
  controllers: [AuthDiagnosticsController], // REST API占位用
  providers: [JwtVerifierService, WsJwtAuthGuard, HttpJwtAuthGuard],
  exports: [JwtVerifierService, WsJwtAuthGuard, HttpJwtAuthGuard],
})
export class AuthModule {}
