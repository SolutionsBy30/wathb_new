import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Entitlements, mergeEntitlements } from './entitlements.util';

/**
 * PAY-013 — one place that answers "what is this student entitled to".
 *
 * Before this, six services each did their own
 * `subscription.findFirst({ status: 'active' })` and read a flag off whichever
 * row came back. That is correct only while a student can hold exactly one
 * subscription; the moment they buy a second package for a different test, the
 * answer depends on which row sorted first.
 */
@Injectable()
export class EntitlementsService {
  constructor(private prisma: PrismaService) {}

  async forStudent(studentId: string): Promise<Entitlements> {
    const subs = await this.prisma.subscription.findMany({
      where: { studentId, status: 'active' },
      select: {
        package: {
          select: {
            testIds: true,
            questionsPerDay: true,
            dailyWathbLimit: true,
            simulationsIncluded: true,
            weeklyReportEnabled: true,
            supervisorLinkingAllowed: true,
            dailyNotificationEnabled: true,
            reportVisibility: true,
          },
        },
      },
    });
    return mergeEntitlements(subs.map((s) => s.package));
  }
}
