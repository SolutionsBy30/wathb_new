import { IsIn, IsString } from 'class-validator';

export class DevRequestLinkDto {
  @IsString()
  mobile!: string;

  @IsIn(['student', 'supervisor'])
  subjectType!: 'student' | 'supervisor';
}
