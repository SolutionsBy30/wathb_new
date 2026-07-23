import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpsertTestDto {
  @IsString() nameAr!: string;
  @IsString() nameEn!: string;
  // ADM-012 — chosen once at creation; not editable afterward (see
  // TaxonomyService.createTest) since sections/areas/labels/questions
  // beneath the test are authored assuming a fixed content language.
  @IsOptional() @IsIn(['ar', 'en']) language?: 'ar' | 'en';
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpsertSectionDto {
  @IsString() nameAr!: string;
  @IsString() nameEn!: string;
  @IsOptional() @Min(0) weight?: number;
  @IsOptional() @IsInt() sort?: number;
}

export class UpsertAreaDto {
  @IsString() nameAr!: string;
  @IsString() nameEn!: string;
  @IsOptional() @IsArray() @IsIn(['scientific', 'humanities'], { each: true })
  appliesToTracks?: ('scientific' | 'humanities')[];
  @IsOptional() @IsInt() sort?: number;
}

export class UpsertLabelDto {
  @IsString() nameAr!: string;
  @IsString() nameEn!: string;
  @IsOptional() @IsInt() @Min(1) defaultTimeLimitS?: number;
  @IsOptional() @IsInt() sort?: number;
}
