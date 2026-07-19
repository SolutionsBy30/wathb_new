import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { QuestionType } from '@prisma/client';

export class OptionDto {
  @IsString() key!: string;
  @IsString() text!: string;
  @IsOptional() @IsString() imageUrl?: string;
}

export class CreateQuestionDto {
  @IsString() labelId!: string;
  @IsOptional() @IsString() passageId?: string;
  @IsOptional() @IsIn(['mcq_single', 'mcq_multi', 'numeric_entry', 'true_false']) type?: QuestionType;
  @IsInt() @Min(1) @Max(5) difficulty!: number;
  @IsOptional() @IsInt() timeLimitS?: number;
  @IsString() stem!: string;
  @IsOptional() @IsString() stemImageUrl?: string;
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => OptionDto) options!: OptionDto[];
  @IsString() correctKey!: string;
  @IsString() explanation!: string;
  @IsOptional() @IsString() source?: string;
}

export class UpdateQuestionContentDto extends CreateQuestionDto {}

export class ListQuestionsQuery {
  @IsOptional() @IsString() testId?: string;
  @IsOptional() @IsString() sectionId?: string;
  @IsOptional() @IsString() areaId?: string;
  @IsOptional() @IsString() labelId?: string;
  @IsOptional() @IsIn(['draft', 'in_review', 'published', 'retired']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) difficulty?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}
