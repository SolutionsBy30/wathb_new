import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Create requires a body; update may change only the active flag. */
export class CreateNotificationMessageDto {
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
