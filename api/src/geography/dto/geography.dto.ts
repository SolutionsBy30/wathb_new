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

export class UpdateRegionDto {
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() nameEn?: string;
}

export class UpdateCityDto {
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsString() regionId?: string;
}

export class AddCityAliasDto {
  @IsString() alias!: string;
}

export class UpdateSchoolDto {
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsString() cityId?: string;
}

export class MergeSchoolsDto {
  @IsString() sourceId!: string;
  @IsString() targetId!: string;
}
