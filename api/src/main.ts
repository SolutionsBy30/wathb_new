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
  // Paymob is given URLs built from API_PUBLIC_URL; when that env var is
  // missing its /api suffix (observed in production: every redirect-return
  // and webhook 404'd for days while payments stayed pending), the payer
  // and the money land on a dead path. A payment callback is too important
  // to fail on a config slip, so rewrite the two gateway-facing paths onto
  // the prefixed routes instead of 404ing.
  app.use((req: any, _res: any, next: () => void) => {
    if (req.url.startsWith('/checkout/return') || req.url.startsWith('/webhooks/paymob')) {
      req.url = `/api${req.url}`;
    }
    next();
  });
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`wathb-api listening on :${port}`);
}
bootstrap();
