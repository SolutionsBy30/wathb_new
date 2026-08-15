import { IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAdminDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  // Minimum enforced here and again in the service, since the service is also
  // reachable from future non-HTTP callers.
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) permissions?: string[];
  @IsOptional() @IsBoolean() isSuperAdmin?: boolean;
}

export class UpdateAdminDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) permissions?: string[];
  @IsOptional() @IsBoolean() isSuperAdmin?: boolean;
  @IsOptional() @IsIn(['active', 'suspended']) status?: 'active' | 'suspended';
}
