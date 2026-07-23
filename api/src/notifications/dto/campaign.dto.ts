import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

// ADM-083 — filters compose with AND; each is optional so "all students"
// is expressible as an empty filter.
export class CampaignAudienceDto {
  @IsOptional() @IsUUID() packageId?: string;
  @IsOptional() @IsIn(['pending', 'active', 'expired', 'cancelled', 'refunded', 'none']) subscriptionStatus?: string;
  @IsOptional() @IsUUID() schoolId?: string;
  @IsOptional() @IsUUID() cityId?: string;
  @IsOptional() @IsUUID() regionId?: string;
  /** Activity level — no completed Wathb in at least this many days (or ever). */
  @IsOptional() @IsInt() @Min(1) inactiveDays?: number;
}

export class CampaignSendDto extends CampaignAudienceDto {
  @IsString() @MinLength(1) message!: string;
  @IsIn(['utility', 'marketing']) category!: 'utility' | 'marketing';
}
