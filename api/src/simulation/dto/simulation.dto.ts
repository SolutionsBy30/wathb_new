import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { NavigationPolicy, SimulationMode } from '@prisma/client';

export class QuotaDto {
  @IsString() areaId!: string;
  @IsInt() @Min(1) @Max(500) count!: number;
  @IsOptional() @IsIn(['ascending', 'none']) difficultyCurve?: string;
}

export class SectionTemplateDto {
  @IsInt() @Min(0) @Max(20) orderIndex!: number;
  @IsIn(['verbal', 'quantitative', 'mixed']) part!: string;
  @IsInt() @Min(1) @Max(500) questionCount!: number;
  // Upper bound is three hours: long enough for any Qiyas section, short
  // enough that a typo of 15000 instead of 1500 is refused rather than
  // producing a section nobody can finish.
  @IsInt() @Min(30) @Max(10800) durationS!: number;
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) experimentalSlots?: number[];
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => QuotaDto) quotas!: QuotaDto[];
}

export class SaveSectionsDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SectionTemplateDto) sections!: SectionTemplateDto[];
}

export class BlueprintDto {
  @IsString() testId!: string;
  @IsOptional() @IsIn(['computerized', 'paper']) mode?: SimulationMode;
  @IsString() nameAr!: string;
  @IsString() nameEn!: string;

  @IsInt() @Min(1) @Max(500) totalQuestions!: number;
  @IsInt() @Min(1) @Max(20) sectionCount!: number;
  @IsOptional() @IsInt() @Min(30) @Max(10800) sectionDurationS?: number;
  @IsOptional() @IsBoolean() breakBetweenSections?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(3600) breakDurationS?: number;
  @IsOptional() @IsIn(['free_within_section', 'linear_only']) navigationPolicy?: NavigationPolicy;
  @IsOptional() @IsBoolean() allowFlagReview?: boolean;
  @IsOptional() @IsBoolean() calculatorAllowed?: boolean;
  @IsOptional() @IsIn(['digital', 'none']) scratchpad?: string;
  @IsOptional() @IsIn(['ascending', 'none']) difficultyOrdering?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) experimentalCount?: number;

  // §5.6 gate configuration. All optional so the schema defaults stand, and
  // all bounded so a mis-typed gate cannot lock the whole product: a
  // minCompletedLeaps of 2000 is not a stricter gate, it is an outage.
  @IsOptional() @IsInt() @Min(0) @Max(365) minCompletedLeaps?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000) minAnsweredQuestions?: number;
  @IsOptional() @IsBoolean() minCoverageAreas?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(365) minDaysBetweenAttempts?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) minLeapsBetweenAttempts?: number;
  @IsOptional() @IsBoolean() requirePlacement?: boolean;
}

export class GenerateFormDto {
  @IsOptional() @IsString() code?: string;
  /** Supplying a seed reproduces a known form — used to re-materialise one, not for routine generation. */
  @IsOptional() @IsString() seed?: string;
  @IsOptional() @IsBoolean() avoidReuse?: boolean;
}

export class SetStatusDto {
  @IsIn(['draft', 'published', 'archived']) status!: 'draft' | 'published' | 'archived';
}
