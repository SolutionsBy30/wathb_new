import { Equals, IsIn, IsString, MinLength } from 'class-validator';

// ONB-009 — explicit, timestamped WhatsApp opt-in consent, required at
// signup since WhatsApp is the product's primary delivery channel.
// @Equals(true) rejects `false` or omission outright, before the request
// even reaches AccountsService — a client can't sneak an unchecked box past
// validation.
export class SignupStudentDto {
  @IsString() mobile!: string;
  @IsString() @MinLength(2) name!: string;
  @Equals(true, { message: 'WhatsApp opt-in consent is required' }) whatsappOptIn!: boolean;
}

export class SignupSupervisorDto {
  @IsString() mobile!: string;
  @IsString() @MinLength(2) name!: string;

  @IsIn(['parent', 'instructor'])
  type!: 'parent' | 'instructor';

  @Equals(true, { message: 'WhatsApp opt-in consent is required' }) whatsappOptIn!: boolean;
}
