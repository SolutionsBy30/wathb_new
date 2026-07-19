import { Module } from '@nestjs/common';
import { TaxonomyService } from './taxonomy.service';
import { TaxonomyController } from './taxonomy.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [TaxonomyService],
  controllers: [TaxonomyController],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
