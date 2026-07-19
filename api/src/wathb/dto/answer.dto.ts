import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AnswerDto {
  @IsInt() @Min(0) position!: number;
  @IsOptional() @IsString() selectedKey?: string;
}
