import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3100')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  
  app.enableCors({
    origin: CORS_ORIGINS,
    credentials: true,
  })
  
  const port = process.env.PORT || 3101
  await app.listen(port, '0.0.0.0')
  console.log(`Signaling service is running on: http://0.0.0.0:${port}`)
}

bootstrap()
