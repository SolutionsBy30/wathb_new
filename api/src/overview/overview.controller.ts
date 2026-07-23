import { Controller, Get, UseGuards } from '@nestjs/common';
import { OverviewService } from './overview.service';
import { RequireSession, SessionGuard } from '../auth/session.guard';

@UseGuards(SessionGuard)
@RequireSession('admin')
@Controller('admin/overview')
export class OverviewController {
  constructor(private overview: OverviewService) {}

  @Get('kpis')
  kpis() {
    return this.overview.kpis();
  }

  @Get('alerts')
  alerts() {
    return this.overview.alerts();
  }
}
