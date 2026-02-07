import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'
import * as fs from 'fs'
import * as path from 'path'

async function bootstrap() {
  const defaultKeyPath = path.join(__dirname, '../../web/localhost+6-key.pem')
  const defaultCertPath = path.join(__dirname, '../../web/localhost+6.pem')
  const keyPath = process.env.GATEWAY_HTTPS_KEY_PATH || defaultKeyPath
  const certPath = process.env.GATEWAY_HTTPS_CERT_PATH || defaultCertPath

  const hasHttpsCerts = fs.existsSync(keyPath) && fs.existsSync(certPath)

  const app = await NestFactory.create(
    AppModule,
    hasHttpsCerts
      ? {
          httpsOptions: {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
          },
        }
      : undefined,
  )
  
  const config = app.get(ConfigService)
  const corsOrigins = (config.get<string>('CORS_ORIGIN') || 'http://localhost:3100')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) {
        callback(null, true)
      } else {
        callback(null, corsOrigins.includes(requestOrigin))
      }
    },
    credentials: true,
  })
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  )
  
  const port = process.env.PORT || 4000
  await app.listen(port)
  const scheme = hasHttpsCerts ? 'https' : 'http'
  console.log(`Gateway service is running on: ${scheme}://0.0.0.0:${port}`)
}

bootstrap()
