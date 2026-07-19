import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpsertTestDto {
  @IsString() nameAr!: string;
  @IsString() nameEn!: string;
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
