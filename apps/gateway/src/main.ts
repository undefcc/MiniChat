import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
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
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  )
  
  const port = process.env.PORT || 4000
  await app.listen(port)
  console.log(`Gateway service is running on: http://localhost:${port}`)
}

bootstrap()
