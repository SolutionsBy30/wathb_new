import { IsIn, IsString, MinLength } from 'class-validator';

export class SignupStudentDto {
  @IsString() mobile!: string;
  @IsString() @MinLength(2) name!: string;
}

export class SignupSupervisorDto {
  @IsString() mobile!: string;
  @IsString() @MinLength(2) name!: string;

  @IsIn(['parent', 'instructor'])
  type!: 'parent' | 'instructor';
}
