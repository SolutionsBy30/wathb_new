import { Button } from './Button';

/**
 * FRE-010 — the persistent "you're on the free plan" strip.
 *
 * Shown on every screen rather than only on the pricing page, because the
 * free tier's limits (one leap a day, partial report, no supervisor linking)
 * are felt where the student is working, not where they'd go to pay. It is
 * driven by the package's own price rather than a hardcoded name or id, so a
 * second free tier or a renamed one needs no code change.
 *
 * Deliberately not dismissible: a dismissed banner is a banner that never
 * comes back, and this is the only standing prompt to upgrade. It stays
 * quiet visually — one line, no modal, never blocking the leap.
 */
export function FreePlanBanner({ subscription, onUpgrade }) {
  // No subscription at all is a different state (mid-signup, or an expired
  // plan) that the pricing screen already handles with its own message —
  // claiming "you are on the free plan" there would be wrong.
  if (!subscription || subscription.status !== 'active') return null;
  if ((subscription.package?.priceHalalas ?? 0) > 0) return null;

  const limit = subscription.package?.dailyWathbLimit;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        background: 'var(--on-indigo-subtle)',
        boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
      }}
    >
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
        أنت على <span style={{ color: 'var(--sand)' }}>الباقة المجانية</span>
        {limit ? ` — وثبة واحدة يومياً` : ''}. ترقّ للحصول على وثبات غير محدودة وتقرير كامل.
      </span>
      <Button variant="primary" onClick={onUpgrade}>ترقية الباقة</Button>
    </div>
  );
}
