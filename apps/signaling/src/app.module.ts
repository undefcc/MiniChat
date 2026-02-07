import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { RedisModule } from '@nestjs-modules/ioredis'
import * as path from 'path'
import { AdminGateway } from './admin/admin.gateway'
import { MonitorService } from './admin/monitor.service'
import { AuthModule } from './auth/auth.module'
import { RoomModule } from './room/room.module'
import { StationModule } from './station/station.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [path.resolve(__dirname, '../../../.env'), '.env'],
    }),
    AuthModule,
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL', 'redis://localhost:6379')
        const password = config.get<string>('REDIS_PASSWORD')
        
        return {
          type: 'single',
          url,
          options: password ? { password } : undefined,
        }
      },
    }),
    RoomModule,
    StationModule,
  ],
  providers: [
      AdminGateway, 
      MonitorService
  ],
})
export class AppModule {}
