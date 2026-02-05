import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import * as fs from 'fs'
import * as path from 'path'

const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3100')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

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
  
  app.enableCors({
    origin: CORS_ORIGINS,
    credentials: true,
  })
  
  const port = process.env.SIGNALING_PORT || process.env.PORT || 3101
  await app.listen(port, '0.0.0.0')
  const scheme = hasHttpsCerts ? 'https' : 'http'
  console.log(`Signaling service is running on: ${scheme}://0.0.0.0:${port}`)
}

bootstrap()
