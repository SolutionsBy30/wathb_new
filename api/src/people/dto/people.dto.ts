import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
  // ONB-012 — "a configurable skip-days toggle" (0=Sunday..6=Saturday);
  // existed in the schema with a KSA-weekend default but was never actually
  // settable by anyone until now.
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) skipDays?: number[];
}

/**
 * NOT-012 — email as a second notification channel. Shared by students and
 * supervisors: both live on `users`, so both set it the same way.
 * Passing null for the address clears it and switches the channel off.
 */
export class EmailPrefsDto {
  @IsOptional() @IsEmail() notificationEmail?: string | null;
  @IsOptional() @IsBoolean() emailNotificationsEnabled?: boolean;
}

/** ADM-086 — admin edits to an account's contact details. */
export class AdminUpdateAccountDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsEmail() notificationEmail?: string | null;
}
