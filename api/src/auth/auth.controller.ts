import { Body, Controller, Ip, Param, Post, Headers } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { SignupStudentDto, SignupSupervisorDto } from './dto/signup.dto';
import { AccountsService } from '../people/accounts.service';

// NFR-005 — every auth entry point here is a brute-force/abuse surface
// (password guessing, OTP guessing, magic-link token guessing, spam
// account creation) and gets a much tighter limit than the app-wide
// default (see app.module.ts's ThrottlerModule.forRoot).
const AUTH_THROTTLE = { default: { limit: 5, ttl: 5 * 60_000 } }; // 5 requests / 5 minutes / IP

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private otp: OtpService,
    private accounts: AccountsService,
  ) {}

  @Throttle(AUTH_THROTTLE)
  @Post('admin/login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto.email, dto.password);
  }

  // Mirrors spec §9.3: POST /api/auth/magic/:token -> exchange for scoped session.
  // This is what a real WhatsApp notification tap lands on — see
  // notifications.service.ts for where these links get minted. Tokens are
  // 256-bit CSPRNG so guessing is already infeasible; the throttle here is
  // defense in depth, and looser than the OTP/login limits since a
  // legitimate user reloading/re-tapping a link shouldn't get locked out.
  @Throttle({ default: { limit: 20, ttl: 5 * 60_000 } })
  @Post('magic/:token')
  async exchange(@Param('token') token: string, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.auth.exchangeMagicLink(token, { ip, userAgent });
  }

  // Mirrors spec §9.3: POST /api/auth/otp/request|verify — the login page for
  // students/supervisors who don't have (or can't find) a fresh WhatsApp link.
  @Throttle(AUTH_THROTTLE)
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.otp.requestOtp(dto.mobile, dto.subjectType);
  }

  // Looser than request — OtpService already caps wrong-code attempts at 5
  // per code (MAX_ATTEMPTS) before forcing a fresh request; this just
  // bounds the endpoint itself against a flood.
  @Throttle({ default: { limit: 10, ttl: 5 * 60_000 } })
  @Post('otp/verify')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const user = await this.otp.verifyOtp(dto.mobile, dto.subjectType, dto.code);
    const token = this.auth.issueSession({ sub: user.id, kind: dto.subjectType }, 24 * 3600);
    return { token, kind: dto.subjectType, name: user.name };
  }

  // Public self-signup — creates the account, then immediately requests an
  // OTP so the client can go straight to the code-entry step, same as login.
  @Throttle(AUTH_THROTTLE)
  @Post('signup/student')
  async signupStudent(@Body() dto: SignupStudentDto) {
    await this.accounts.createStudent(dto.mobile, dto.name, new Date());
    return this.otp.requestOtp(dto.mobile, 'student');
  }

  @Throttle(AUTH_THROTTLE)
  @Post('signup/supervisor')
  async signupSupervisor(@Body() dto: SignupSupervisorDto) {
    await this.accounts.createSupervisor(dto.mobile, dto.name, dto.type, new Date());
    return this.otp.requestOtp(dto.mobile, 'supervisor');
  }
}
