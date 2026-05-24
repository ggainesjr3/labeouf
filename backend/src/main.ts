import { webcrypto } from "crypto";
if (!globalThis.crypto) { (globalThis as any).crypto = webcrypto; }

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const uploadRoot = process.env.UPLOAD_PATH || join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadRoot, { prefix: '/uploads/' });
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  app.enableCors({
    origin: allowedOrigin === '*' ? '*' : allowedOrigin ? allowedOrigin.split(',') : ['http://localhost:3000', 'http://localhost:8080'],
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
