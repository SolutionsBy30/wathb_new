import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetSiteTextDto {
  // Long enough for a paragraph, bounded so a paste accident cannot store a
  // megabyte on the homepage.
  @IsString() @MaxLength(2000) valueAr!: string;
}

export class UpsertLandingFeatureDto {
  @IsString() @MaxLength(120) titleAr!: string;
  @IsString() @MaxLength(400) bodyAr!: string;
  @IsOptional() @IsInt() sort?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
