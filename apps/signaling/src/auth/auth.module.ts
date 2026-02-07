import { Global, Module } from '@nestjs/common'
import { AuthDiagnosticsController } from './auth-diagnostics.controller'
import { JwtVerifierService } from './jwt-verifier.service'
import { WsJwtAuthGuard } from './ws-jwt-auth.guard'

@Global()
@Module({
  controllers: [AuthDiagnosticsController],
  providers: [JwtVerifierService, WsJwtAuthGuard],
  exports: [JwtVerifierService, WsJwtAuthGuard],
})
export class AuthModule {}
