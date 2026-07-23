import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RateExplanationDto {
  @IsIn(['up', 'down']) rating!: 'up' | 'down';
}

export class ReportProblemDto {
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
