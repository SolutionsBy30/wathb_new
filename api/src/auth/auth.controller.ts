import { Body, Controller, Ip, Param, Post, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { SignupStudentDto, SignupSupervisorDto } from './dto/signup.dto';
import { AccountsService } from '../people/accounts.service';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private otp: OtpService,
    private accounts: AccountsService,
  ) {}

  @Post('admin/login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto.email, dto.password);
  }

  // Mirrors spec §9.3: POST /api/auth/magic/:token -> exchange for scoped session.
  // This is what a real WhatsApp notification tap lands on — see
  // notifications.service.ts for where these links get minted.
  @Post('magic/:token')
  async exchange(@Param('token') token: string, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.auth.exchangeMagicLink(token, { ip, userAgent });
  }

  // Mirrors spec §9.3: POST /api/auth/otp/request|verify — the login page for
  // students/supervisors who don't have (or can't find) a fresh WhatsApp link.
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.otp.requestOtp(dto.mobile, dto.subjectType);
  }

  @Post('otp/verify')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const user = await this.otp.verifyOtp(dto.mobile, dto.subjectType, dto.code);
    const token = this.auth.issueSession({ sub: user.id, kind: dto.subjectType }, 24 * 3600);
    return { token, kind: dto.subjectType, name: user.name };
  }

  // Public self-signup — creates the account, then immediately requests an
  // OTP so the client can go straight to the code-entry step, same as login.
  @Post('signup/student')
  async signupStudent(@Body() dto: SignupStudentDto) {
    await this.accounts.createStudent(dto.mobile, dto.name);
    return this.otp.requestOtp(dto.mobile, 'student');
  }

  @Post('signup/supervisor')
  async signupSupervisor(@Body() dto: SignupSupervisorDto) {
    await this.accounts.createSupervisor(dto.mobile, dto.name, dto.type);
    return this.otp.requestOtp(dto.mobile, 'supervisor');
  }
}
