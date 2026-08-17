import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpsertPackageDto {
  @IsString() nameAr!: string;
  @IsString() nameEn!: string;
  @IsArray() @IsString({ each: true }) testIds!: string[];
  @IsInt() @Min(1) durationMonths!: number;
  @IsInt() @Min(0) priceHalalas!: number;
  @IsOptional() @IsInt() @Min(1) questionsPerDay?: number;
  // PAY-010 — the "was" price. Null clears it.
  @IsOptional() @IsInt() @Min(0) compareAtHalalas?: number | null;
  // Wathbs per day; null = unlimited. @IsOptional also passes null through,
  // which is exactly the "clear the limit" signal Prisma expects.
  @IsOptional() @IsInt() @Min(1) dailyWathbLimit?: number | null;
  @IsOptional() @IsInt() sort?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsIn(['public', 'link_only']) visibility?: 'public' | 'link_only';
  // FRE-007 — the free tier's limits, tunable per package without a code change.
  @IsOptional() @IsBoolean() dailyNotificationEnabled?: boolean;
  @IsOptional() @IsIn(['full', 'partial']) reportVisibility?: 'full' | 'partial';
  @IsOptional() @IsBoolean() weeklyReportEnabled?: boolean;
  @IsOptional() @IsBoolean() supervisorLinkingAllowed?: boolean;
  // FRE-009 — enrol every new account into this package automatically.
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class StartCheckoutDto {
  @IsString() packageId!: string;
  // PAY-011 — optional; the server re-validates and re-prices from the stored
  // code, so this is only which code to try, never what it is worth.
  @IsOptional() @IsString() promoCode?: string;
}

export class StartCheckoutForStudentDto {
  @IsString() studentId!: string;
  @IsString() packageId!: string;
  @IsOptional() @IsString() promoCode?: string;
}

export class PreviewPromoDto {
  @IsString() code!: string;
  @IsString() packageId!: string;
}

export class UpsertDiscountCodeDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsIn(['percent', 'fixed']) kind?: 'percent' | 'fixed';
  @IsOptional() @IsInt() @Min(1) value?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) packageIds?: string[];
  @IsOptional() @IsInt() @Min(1) maxRedemptions?: number | null;
  @IsOptional() @IsString() startsAt?: string | null;
  @IsOptional() @IsString() expiresAt?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ActivateWireTransferDto {
  @IsString() studentId!: string;
  @IsString() packageId!: string;
}
