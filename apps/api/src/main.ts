import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );
  // Forward SIGTERM/SIGINT through Nest lifecycle so @nestjs/bullmq WorkerHost
  // classes close Redis connections cleanly and in-flight HTTP requests drain.
  app.enableShutdownHooks();
  const port = process.env.API_PORT ?? 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Smart Attendance API running at http://localhost:${port}/api/v1`
  );
}

bootstrap();
