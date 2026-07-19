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

  @IsString() @Length(6, 6)
  code!: string;
}
