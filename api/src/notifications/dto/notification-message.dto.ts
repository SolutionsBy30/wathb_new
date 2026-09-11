import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MESSAGE_KINDS } from '../notification-messages.service';

/** Create requires a body; update may change only the active flag. */
export class CreateNotificationMessageDto {
  // COM-005 — which message this varies. Omitted means the daily leap, which
  // is what every existing caller means.
  @IsOptional() @IsIn(MESSAGE_KINDS as unknown as string[]) kind?: string;
  @IsString() @MinLength(1) @MaxLength(900) body!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateNotificationMessageDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(900) body?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PreviewMessageDto {
  @IsString() @MaxLength(2000) body!: string;
}
