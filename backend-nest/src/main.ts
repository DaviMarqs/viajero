import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Response } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { UPLOADS_ROOT, UPLOADS_URL_PREFIX } from './common/uploads';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string>('CORS_ALLOW_ALL_ORIGINS', 'true') === 'true' ? true : config.get<string>('CORS_ALLOWED_ORIGINS', '').split(',').filter(Boolean),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useStaticAssets(UPLOADS_ROOT, {
    prefix: `${UPLOADS_URL_PREFIX}/`,
    setHeaders: (res: Response) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });

  const port = Number(config.get('PORT', 8001));
  await app.listen(port);
}

void bootstrap();
