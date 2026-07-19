import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { UpsertPackageDto } from './dto/packages.dto';

@Controller()
export class PackagesController {
  constructor(private packages: PackagesService) {}

  // Public pricing page — spec S1.
  @Get('packages')
  listPublic() {
    return this.packages.listPublic();
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Get('admin/packages')
  listAll() {
    return this.packages.listAll();
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/packages')
  create(@Body() dto: UpsertPackageDto) {
    return this.packages.create(dto);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Patch('admin/packages/:id')
  update(@Param('id') id: string, @Body() dto: Partial<UpsertPackageDto>) {
    return this.packages.update(id, dto);
  }
}
