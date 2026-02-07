import { NestFactory } from '@nestjs/core'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'
import * as fs from 'fs'
import * as path from 'path'

const defaultOrigins = ['http://localhost:3100', 'https://localhost:3100']

async function bootstrap() {
  const defaultKeyPath = path.join(__dirname, '../../web/localhost+6-key.pem')
  const defaultCertPath = path.join(__dirname, '../../web/localhost+6.pem')
  const keyPath = process.env.SIGNALING_HTTPS_KEY_PATH || defaultKeyPath
  const certPath = process.env.SIGNALING_HTTPS_CERT_PATH || defaultCertPath

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
  const corsOrigins = (config.get<string>('CORS_ORIGIN') || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        callback(null, true)
        return
      }

      if (requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1')) {
        callback(null, true)
        return
      }

      const allowed = new Set([...defaultOrigins, ...corsOrigins])
      callback(null, allowed.has(requestOrigin))
    },
    credentials: true,
  })
  
  const port = process.env.SIGNALING_PORT || process.env.PORT || 3101
  await app.listen(port, '0.0.0.0')
  const scheme = hasHttpsCerts ? 'https' : 'http'
  console.log(`Signaling service is running on: ${scheme}://0.0.0.0:${port}`)
}

bootstrap()
