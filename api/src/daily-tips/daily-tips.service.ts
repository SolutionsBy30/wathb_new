import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DailyTipsService {
  constructor(private prisma: PrismaService) {}

  /**
   * The tip shown under "معلومة تساعدك في وثبة اليوم" on the student Home.
   * Active tips rotate one per calendar day — deterministic (day index mod
   * count), so every student sees the same tip on a given day and it
   * changes at midnight without any scheduler. Returns null when the admin
   * hasn't authored any active tips; the client then falls back to its
   * generated weakest-area tip rather than showing nothing.
   */
  async tipOfTheDay() {
    const tips = await this.prisma.dailyTip.findMany({
      where: { isActive: true },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
    if (tips.length === 0) return { tip: null };
    const dayIndex = Math.floor(Date.now() / 86_400_000);
    return { tip: tips[dayIndex % tips.length] };
  }

  listAll() {
    return this.prisma.dailyTip.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] });
  }

  create(textAr: string) {
    return this.prisma.dailyTip.create({ data: { textAr } });
  }

  update(id: string, dto: { textAr?: string; isActive?: boolean; sort?: number }) {
    return this.prisma.dailyTip.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.dailyTip.delete({ where: { id } });
  }
}
