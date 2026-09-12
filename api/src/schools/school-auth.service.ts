import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { OtpService } from '../auth/otp.service';

/**
 * SCH-004 — school-administrator login.
 *
 * Its own path rather than the supervisor's, because the two authorise
 * different things: a supervisor session can reach a linked student's own
 * report, and a school session must never be able to. Sharing the endpoint
 * would make that distinction one mis-set field away from collapsing.
 *
 * The OTP itself is the existing one — same code, same TTL, same attempt caps.
 * Only the account lookup and the session kind differ.
 */
@Injectable()
export class SchoolAuthService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private otp: OtpService,
  ) {}

  private async findSchoolAdmin(mobile: string) {
    const user = await this.prisma.user.findUnique({
      where: { mobileE164: mobile },
      include: { schoolAdmins: { where: { isActive: true }, select: { id: true } } },
    });
    // Deliberately the same refusal for "no such number" and "not a school
    // administrator": the difference tells an attacker which numbers are
    // registered.
    if (!user || user.schoolAdmins.length === 0) throw new ForbiddenException('لا يوجد حساب مدرسة لهذا الرقم.');
    if (user.status === 'suspended') throw new ForbiddenException('الحساب موقوف.');
    return user;
  }

  async requestCode(mobile: string) {
    await this.findSchoolAdmin(mobile);
    return this.otp.requestOtp(mobile, 'school');
  }

  async verifyCode(mobile: string, code: string) {
    const user = await this.findSchoolAdmin(mobile);
    await this.otp.verifyOtp(mobile, 'school', code);
    // Eight hours, not the 24 the student and supervisor apps use: this is a
    // staff account read on a shared school computer, and a session left open
    // overnight there is a different risk from one on a student's own phone.
    const token = this.auth.issueSession({ sub: user.id, kind: 'school' }, 8 * 3600);
    return { token, kind: 'school' as const, name: user.name };
  }
}
