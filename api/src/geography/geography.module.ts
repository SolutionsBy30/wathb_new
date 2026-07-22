import { Module } from '@nestjs/common';
import { GeographyService } from './geography.service';
import { GeographyController } from './geography.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [GeographyService],
  controllers: [GeographyController],
  exports: [GeographyService],
})
export class GeographyModule {}
