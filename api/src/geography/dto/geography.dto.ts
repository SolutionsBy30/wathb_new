import { IsOptional, IsString } from 'class-validator';

export class CreateRegionDto {
  @IsString() nameAr!: string;
  @IsString() nameEn!: string;
}

export class CreateCityDto {
  @IsString() regionId!: string;
  @IsString() nameAr!: string;
  @IsString() nameEn!: string;
}

export class CreateSchoolDto {
  @IsString() cityId!: string;
  @IsString() nameAr!: string;
  @IsOptional() @IsString() nameEn?: string;
}

export class SuggestSchoolDto {
  @IsString() cityId!: string;
  @IsString() nameAr!: string;
}
