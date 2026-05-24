import { webcrypto } from "crypto";
if (!globalThis.crypto) { (globalThis as any).crypto = webcrypto; }

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { getCorsOrigins } from './config/env';
import { isR2Configured } from './r2-storage';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  if (!isR2Configured()) {
    const uploadRoot = process.env.UPLOAD_PATH || join(process.cwd(), 'uploads');
    app.useStaticAssets(uploadRoot, { prefix: '/uploads/' });
  }

  app.enableCors({
    origin: getCorsOrigins(),
    methods: 'GET,POST,PATCH,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  await app.listen(3001, '0.0.0.0');
}
bootstrap();
