import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// STU-012 — the admin inbox side of "report a problem": the student's flag,
// with their answer attached, lands here for triage.
@Injectable()
export class ProblemReportsService {
  constructor(private prisma: PrismaService) {}

  list(status?: 'open' | 'resolved') {
    return this.prisma.problemReport.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        student: { include: { user: true } },
        question: { include: { label: true } },
        answer: { include: { questionVersion: true } },
      },
    });
  }

  async resolve(id: string, adminId: string) {
    const report = await this.prisma.problemReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('problem report not found');
    return this.prisma.problemReport.update({
      where: { id },
      data: { status: 'resolved', resolvedAt: new Date(), resolvedBy: adminId },
    });
  }
}
