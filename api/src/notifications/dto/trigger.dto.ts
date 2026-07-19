import { IsDateString, IsOptional } from 'class-validator';

export class TriggerDateDto {
  @IsOptional() @IsDateString() forDate?: string;
}
