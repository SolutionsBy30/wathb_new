import { createHmac } from 'crypto';

// Paymob's transaction HMAC — the field order is fixed by their docs, do
// not reorder. The same 20 fields cover both delivery shapes: the POST
// webhook ("Transaction Processed Callback", nested JSON object) and the
// GET redirect-return ("Transaction Response Callback", flat query params
// whose keys literally contain dots, e.g. `source_data.pan`).
export const PAYMOB_HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id',
  'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
  'is_voided', 'order.id', 'owner', 'pending', 'source_data.pan', 'source_data.sub_type',
  'source_data.type', 'success',
];

function getPath(obj: Record<string, unknown>, path: string): unknown {
  // Flat dotted key first (query-param shape), then nested traversal
  // (webhook JSON shape) — one resolver serves both delivery shapes.
  if (path in obj) return obj[path];
  return path.split('.').reduce<any>((o, k) => o?.[k], obj);
}

export function computePaymobHmac(source: Record<string, unknown>, secret: string): string {
  const concatenated = PAYMOB_HMAC_FIELDS.map((f) => String(getPath(source, f) ?? '')).join('');
  return createHmac('sha512', secret).update(concatenated).digest('hex');
}
