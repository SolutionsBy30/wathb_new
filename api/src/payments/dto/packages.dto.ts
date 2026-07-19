import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpsertPackageDto {
  @IsString() nameAr!: string;
  @IsString() nameEn!: string;
  @IsArray() @IsString({ each: true }) testIds!: string[];
  @IsInt() @Min(1) durationMonths!: number;
  @IsInt() @Min(0) priceHalalas!: number;
  @IsOptional() @IsInt() @Min(1) questionsPerDay?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsIn(['public', 'link_only']) visibility?: 'public' | 'link_only';
}

export class StartCheckoutDto {
  @IsString() packageId!: string;
}
