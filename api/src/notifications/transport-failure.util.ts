/**
 * NOT-024 — is this failure the transport being down, or this one message?
 *
 * RoutingChannel only moves to the backup sender on a transport failure, so
 * this predicate decides whether failover happens at all. Get it wrong in the
 * conservative direction and the backup number never gets used — which is
 * exactly what happened: a disconnected primary threw errors this did not
 * recognise, the router re-threw them, and the OTP path fell straight through
 * to its fallback without ever trying the second sender.
 *
 * Pure and tested rather than inlined in the adapter, because the cost of a
 * missed case is invisible: everything still "works", just never on the
 * backup.
 */

/**
 * Wordings that mean the WhatsApp link itself is down.
 *
 * Wasender is an unofficial bridge to a real phone and its messages are not a
 * stable API, so match on distinctive fragments rather than exact strings.
 * Every one of these is fatal to every message equally.
 */
const UNAVAILABLE_FRAGMENTS = [
  'session is not connected',
  'session not connected',
  'not connected',
  'disconnect',
  'logged out',
  'logout',
  'not authenticated',
  'unauthenticated',
  'unauthorized',
  'invalid api key',
  'scan the qr',
  'qr code',
  'session expired',
  'session closed',
  'no active session',
  'device not found',
];

/** Network-level failures: nothing reached the provider at all. */
const NETWORK_FRAGMENTS = [
  'fetch failed',
  'econnrefused',
  'econnreset',
  'enotfound',
  'etimedout',
  'network',
  'socket hang up',
  'aborted',
];

/**
 * HTTP statuses that condemn the sender rather than the message.
 *
 * 401/403 — the key is rejected, so every send fails.
 * 408/5xx — the provider is unwell; the next message will fail the same way.
 * 429 — Wasender rate-limits the whole session, and the backup is a different
 *       number, so moving across is the one thing that can still deliver.
 */
export function isUnavailableStatus(status: number): boolean {
  if (status === 401 || status === 403 || status === 408 || status === 429) return true;
  return status >= 500;
}

/** True when the wording or status means the transport, not the message. */
export function isTransportFailure(message: string | undefined, status?: number): boolean {
  if (status !== undefined && isUnavailableStatus(status)) return true;
  const text = (message ?? '').toLowerCase();
  if (!text) return false;
  return (
    UNAVAILABLE_FRAGMENTS.some((f) => text.includes(f)) ||
    NETWORK_FRAGMENTS.some((f) => text.includes(f))
  );
}

/**
 * A thrown value that never reached the provider — DNS failure, refused
 * connection, timeout. `fetch` rejects with a TypeError for these, which
 * carries no status, so they are classified by message alone.
 */
export function isNetworkError(e: unknown): boolean {
  if (!e) return false;
  const message = e instanceof Error ? e.message : String(e);
  const cause = (e as { cause?: { code?: string } })?.cause?.code ?? '';
  const text = `${message} ${cause}`.toLowerCase();
  return NETWORK_FRAGMENTS.some((f) => text.includes(f));
}
