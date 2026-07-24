import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { assertOtpFallbackNotReachableInProduction } from './otp-fallback-guard.util';

async function bootstrap() {
  assertOtpFallbackNotReachableInProduction(process.env);
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`wathb-api listening on :${port}`);
}
bootstrap();
