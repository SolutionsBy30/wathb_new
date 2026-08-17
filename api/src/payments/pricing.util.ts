/**
 * PAY-010 / PAY-011 — what a package actually costs, and what to show.
 *
 * Pure so the arithmetic that decides what a student is charged is testable
 * without a database or a gateway. Everything is halalas (integers): money is
 * never a float here, and every result is rounded to a whole halala so the
 * amount sent to Paymob is exactly the amount displayed.
 */

export interface PackagePricing {
  priceHalalas: number;
  compareAtHalalas: number | null;
}

export interface PackagePriceView {
  priceHalalas: number;
  /** Only present when it is a genuine saving — see below. */
  compareAtHalalas: number | null;
  discountPercent: number | null;
}

/**
 * PAY-010 — the strikethrough view.
 *
 * A compareAt that is not strictly greater than the price is ignored rather
 * than rendered: an admin who lowers the "was" price below the real one, or
 * leaves it equal, would otherwise produce "0% off" or a negative saving on
 * the public pricing page.
 */
export function packagePriceView(pkg: PackagePricing): PackagePriceView {
  const compareAt = pkg.compareAtHalalas;
  if (compareAt == null || compareAt <= pkg.priceHalalas) {
    return { priceHalalas: pkg.priceHalalas, compareAtHalalas: null, discountPercent: null };
  }
  return {
    priceHalalas: pkg.priceHalalas,
    compareAtHalalas: compareAt,
    discountPercent: Math.round(((compareAt - pkg.priceHalalas) / compareAt) * 100),
  };
}

export interface DiscountCodeLike {
  id: string;
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  packageIds: string[];
  maxRedemptions: number | null;
  timesRedeemed: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
}

export type PromoRejection =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'exhausted'
  | 'not_applicable';

export type PromoResult =
  | { ok: true; discountHalalas: number; totalHalalas: number }
  | { ok: false; reason: PromoRejection };

/**
 * PAY-011 — validate a code against one package and price, and say what it
 * takes off.
 *
 * Every rejection is a distinct reason rather than a bare false: "this code
 * expired" and "this code isn't valid for this package" send a student to
 * completely different next actions, and a single "invalid code" makes
 * support guess.
 */
export function applyPromoCode(
  code: DiscountCodeLike | null,
  packageId: string,
  priceHalalas: number,
  now: Date = new Date(),
): PromoResult {
  if (!code) return { ok: false, reason: 'not_found' };
  if (!code.isActive) return { ok: false, reason: 'inactive' };
  if (code.startsAt && now < code.startsAt) return { ok: false, reason: 'not_started' };
  if (code.expiresAt && now > code.expiresAt) return { ok: false, reason: 'expired' };
  if (code.maxRedemptions != null && code.timesRedeemed >= code.maxRedemptions) {
    return { ok: false, reason: 'exhausted' };
  }
  // Empty scope means every package.
  if (code.packageIds.length > 0 && !code.packageIds.includes(packageId)) {
    return { ok: false, reason: 'not_applicable' };
  }

  const raw = code.kind === 'percent'
    ? Math.round((priceHalalas * code.value) / 100)
    : code.value;

  // Clamped both ways: a code worth more than the package makes it free, not
  // negative, and a total can never drop below zero for the gateway.
  const discountHalalas = Math.max(0, Math.min(raw, priceHalalas));
  return { ok: true, discountHalalas, totalHalalas: priceHalalas - discountHalalas };
}

/** Arabic reasons, so every caller words a rejection the same way. */
export const PROMO_REJECTION_AR: Record<PromoRejection, string> = {
  not_found: 'رمز الخصم غير صحيح.',
  inactive: 'رمز الخصم غير مفعّل.',
  not_started: 'رمز الخصم لم يبدأ بعد.',
  expired: 'انتهت صلاحية رمز الخصم.',
  exhausted: 'استُنفد عدد مرات استخدام هذا الرمز.',
  not_applicable: 'رمز الخصم لا ينطبق على هذه الباقة.',
};
