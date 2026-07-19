import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    // Powers the fuzzy stem-similarity duplicate check in QuestionsService — spec §4.2 #4.
    await this.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm').catch(() => undefined);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
