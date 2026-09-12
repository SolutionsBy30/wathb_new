import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class SchoolLoginDto {
  // Same E.164 shape the rest of the auth surface accepts.
  @IsString() @Matches(/^\+[1-9]\d{7,14}$/, { message: 'رقم جوال غير صالح' }) mobile!: string;
}

export class SchoolVerifyDto extends SchoolLoginDto {
  @IsString() @Length(4, 8) code!: string;
}

/** وثب-side: grant someone access to a school's dashboard. */
export class GrantSchoolAdminDto {
  @IsString() schoolId!: string;
  @IsString() @Matches(/^\+[1-9]\d{7,14}$/, { message: 'رقم جوال غير صالح' }) mobile!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
}

export class SetDisclosureDto {
  // 'full' hands a third party the names of minors, so it is a deliberate
  // choice among three rather than a boolean anyone can flip past.
  @IsIn(['none', 'consented', 'full']) disclosure!: 'none' | 'consented' | 'full';
}

export class SetSchoolAdminActiveDto {
  @IsBoolean() isActive!: boolean;
}
