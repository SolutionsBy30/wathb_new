import { IsIn, IsString, Length } from 'class-validator';

export class RequestOtpDto {
  @IsString() mobile!: string;

  @IsIn(['student', 'supervisor'])
  subjectType!: 'student' | 'supervisor';
}

export class VerifyOtpDto {
  @IsString() mobile!: string;

  @IsIn(['student', 'supervisor'])
  subjectType!: 'student' | 'supervisor';

  @IsString() @Length(4, 6)
  code!: string;
}

// STU-029 — the caller is already authenticated (SessionGuard); only the
// fresh OTP code itself needs to travel, not the mobile/subjectType, which
// come from the session instead of being client-supplied.
export class StepUpVerifyDto {
  @IsString() @Length(4, 6)
  code!: string;
}
