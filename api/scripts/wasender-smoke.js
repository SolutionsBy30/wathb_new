#!/usr/bin/env node
/**
 * NOT-013 — one-command proof that Wasender is really wired up, before any
 * student depends on it.
 *
 * Reads the same .env the API does, resolves the provider through the same
 * rules, and sends one real message. Deliberately separate from the API
 * process so it can be run against production config without restarting
 * anything, and so a failure prints the provider's actual response instead of
 * the swallowed error the notification layer records.
 *
 *   node scripts/wasender-smoke.js +966563910245
 *   node scripts/wasender-smoke.js +966563910245 "نص مخصص"
 */
require('dotenv').config();

const to = process.argv[2];
const text = process.argv[3] ?? 'وثب — رسالة اختبار من الخادم. لا حاجة للرد.';

if (!to) {
  console.error('usage: node scripts/wasender-smoke.js <+E164 mobile> [text]');
  process.exit(1);
}

const key = process.env.WASENDER_API_KEY;
const baseUrl = (process.env.WASENDER_BASE_URL || 'https://wasenderapi.com/api').replace(/\/$/, '');
const provider = (process.env.WHATSAPP_PROVIDER || '(unset)').trim();

console.log(`WHATSAPP_PROVIDER : ${provider}`);
console.log(`WASENDER_API_KEY  : ${key ? `set (${key.length} chars)` : 'MISSING'}`);
console.log(`base URL          : ${baseUrl}`);

if (!key) {
  console.error('\nWASENDER_API_KEY is not set — nothing to test.');
  process.exit(1);
}
if (provider !== 'wasender') {
  console.warn(`\nNote: WHATSAPP_PROVIDER is "${provider}", so the API is NOT using Wasender.`);
  console.warn('This script still sends directly, to prove the credentials work.');
}

// Same normalisation as WasenderChannel.toRecipient.
const recipient = to.replace(/\D/g, '');
console.log(`recipient         : ${recipient}\n`);

fetch(`${baseUrl}/send-message`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: recipient, text }),
})
  .then(async (res) => {
    const raw = await res.text();
    console.log(`HTTP ${res.status}`);
    console.log(raw.slice(0, 800));
    if (!res.ok) {
      console.error('\nFAILED — check the API key, and that the WhatsApp session is linked in the Wasender dashboard.');
      process.exit(1);
    }
    console.log('\nOK — check the handset. If HTTP 200 but nothing arrives, the session is not connected.');
  })
  .catch((e) => {
    console.error('request failed:', e.message);
    process.exit(1);
  });
