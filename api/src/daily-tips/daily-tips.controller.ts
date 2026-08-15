import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { DailyTipsService } from './daily-tips.service';
import { RequirePermission, RequireSession, SessionGuard } from '../auth/session.guard';

export class CreateDailyTipDto {
  @IsString() @MinLength(3) textAr!: string;
}

export class UpdateDailyTipDto {
  @IsOptional() @IsString() @MinLength(3) textAr?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sort?: number;
}

@Controller()
export class DailyTipsController {
  constructor(private tips: DailyTipsService) {}

  // Student Home's daily tip — session-gated like the rest of the Home data.
  @UseGuards(SessionGuard)
  @RequireSession('student')
  @Get('daily-tip')
  tipOfTheDay() {
    return this.tips.tipOfTheDay();
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('dailyTips')
  @Get('admin/daily-tips')
  listAll() {
    return this.tips.listAll();
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('dailyTips')
  @Post('admin/daily-tips')
  create(@Body() dto: CreateDailyTipDto) {
    return this.tips.create(dto.textAr);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('dailyTips')
  @Post('admin/daily-tips/:id')
  update(@Param('id') id: string, @Body() dto: UpdateDailyTipDto) {
    return this.tips.update(id, dto);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('dailyTips')
  @Delete('admin/daily-tips/:id')
  remove(@Param('id') id: string) {
    return this.tips.remove(id);
  }
}
