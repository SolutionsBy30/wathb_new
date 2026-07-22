import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateStudentDto {
  @IsString() mobile!: string;
  @IsString() name!: string;
}

export class CreateSupervisorDto {
  @IsString() mobile!: string;
  @IsString() name!: string;
  @IsIn(['parent', 'instructor']) type!: 'parent' | 'instructor';
}

export class GoalSetupDto {
  @IsString() targetTestId!: string;
  @IsOptional() @IsIn(['scientific', 'humanities']) track?: 'scientific' | 'humanities';
  @IsOptional() @IsInt() @Min(0) @Max(100) targetScore?: number;
  @IsOptional() @IsDateString() testDate?: string;
}

export class InviteSupervisorDto {
  @IsString() mobile!: string;
  @IsString() name!: string;
  @IsIn(['parent', 'instructor']) type!: 'parent' | 'instructor';
}

export class SupervisorPreferencesDto {
  @IsOptional() @IsInt() @Min(0) @Max(6) weeklyReportDay?: number;
  @IsOptional() @IsInt() @Min(0) @Max(23) weeklyReportHour?: number;
  @IsOptional() @IsBoolean() weeklyReportMuted?: boolean;
}

export class StudentNotificationPrefsDto {
  @IsOptional() @IsInt() @Min(0) @Max(23) notifSlotStartHour?: number;
  @IsOptional() @IsInt() @Min(0) @Max(23) notifSlotEndHour?: number;
}
