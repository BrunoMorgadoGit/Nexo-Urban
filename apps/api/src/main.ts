import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const origin = config.getOrThrow<string>('WEB_ORIGIN');

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  await app.listen(config.getOrThrow<number>('API_PORT'), '127.0.0.1');
}
await bootstrap();
