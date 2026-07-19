# Wathb (وثب)

A subscription service that delivers a small daily bundle of standardized-test
questions to a student, weighted toward their measured weak areas, with
progress reported to a parent/instructor. Full product spec:
[`docs/product-spec.md`](./docs/product-spec.md).

This repo currently implements **Phase 0–5** of the spec's build sequence
(§11): the taxonomy/question bank, the core Wathb loop (magic-link auth →
timed questions → explanations → completion), the adaptive selection engine
+ student/supervisor reporting, WhatsApp delivery (reactive scheduler,
webhook, delivery log) behind a channel adapter, payments/subscriptions
(checkout, VAT-inclusive pricing, subscription gating) behind a payment
adapter, and weekly WhatsApp reports for students and supervisors. **Phase 6
(ops/analytics) is not built** — see
[What's not built yet](#whats-not-built-yet).

## Architecture

| Layer | Choice |
|---|---|
| API | NestJS + TypeScript (`/api`) |
| DB | PostgreSQL via Prisma |
| Cache/Queue | Redis (provisioned; the scheduler in this pass runs as directly-callable/admin-triggered service methods rather than registered BullMQ jobs — see [Phase 3](#phase-3--whatsapp-delivery)) |
| Student app | React + Vite, mobile-width, RTL (`/src`, repo root) |
| Admin console | React + Vite, desktop (`/admin`) |
| Supervisor app | React + Vite, mobile-width, RTL (`/supervisor`) |

Each frontend is an independent Vite app sharing a copy of the same design
system (`design-system/` — IBM Plex Sans Arabic + Outfit, indigo/sand/lime
tokens) that shipped with the original prototype.

**Auth model** — two entry points, both spec §9.3:
- **The login page** (student/supervisor apps): mobile number → 6-digit OTP,
  delivered via the same `NotificationChannel` as everything else
  (`POST /api/auth/otp/request|verify`). Code is hashed at rest, single-use,
  5-minute expiry, capped at 5 verify attempts.
- **The daily Wathb link**: spec §7.1's scoped, single-purpose magic links
  (hashed tokens, no session in the URL) — what a real WhatsApp notification
  tap lands on (`POST /api/auth/magic/:token`).

Both issue the same kind of session. One pragmatic deviation from spec §7.1:
the session is returned as a JWT in the response body (stored in
`localStorage` by the frontends) rather than an `httpOnly` cookie, because the
three frontends run on different localhost ports in dev. Swap this for a
`Set-Cookie` + `SameSite` flow once the apps are served same-site in
production — the exchange endpoint (`POST /api/auth/magic/:token`) doesn't
need to change, only how the frontend stores what it returns.

## What's built

- **Domain model** (Prisma schema, `api/prisma/schema.prisma`): full
  Test→Section→Area→Label taxonomy, question versioning, passages,
  magic links, `student_label_stats`, advice rules.
- **Selection engine** (`api/src/selection/`): the exact §6.4 algorithm
  (weakness/coverage/recency weighting, strength + exploration guarantees,
  variety cap, difficulty ladder), pure and unit-tested (12 tests) independent
  of the DB.
- **Magic links + sessions** (`api/src/auth/`): CSPRNG tokens, hashed at
  rest, purpose-scoped, TTL per purpose, access-logged.
- **Taxonomy admin** (`api/src/taxonomy/`, `admin/src/pages/Taxonomy.jsx`):
  tree editor, soft-delete/retire semantics.
- **Question bank** (`api/src/questions/`, `admin/src/pages/QuestionBank.jsx`
  + `QuestionEditor.jsx`): CRUD, versioning (edits never mutate history),
  exact + `pg_trgm` fuzzy duplicate detection, live RTL preview.
- **Bulk import** (`api/src/questions/bulk-import.service.ts`,
  `admin/src/pages/BulkImport.jsx`): parse → validate → confirm, per-row
  errors, in-grid correction, **never a partial commit**.
- **The Wathb loop** (`api/src/wathb/`, student app): placement bundle on
  first login, server-authoritative timer (`servedAt`→`answeredAt`), no
  back/skip, correctness revealed only after the full bundle (never
  mid-bundle), streak tracking.
- **Reporting** (`api/src/reports/`): shared, role-scoped
  (`student|supervisor|admin`) report — accuracy by area/label gated by
  `MIN_SAMPLE_FOR_REPORTING = 20` ("collecting data" instead of a noisy
  percentage), 8-week trend, consistency heatmap, recent mistakes.
- **Supervisor linking** (`api/src/people/`): student-initiated invite,
  explicit accept, revocable consent; dashboard renders family-card or
  instructor-table view per `supervisor.type`.

### Phase 3 — WhatsApp delivery

- **`NotificationChannel` adapter** (`api/src/notifications/channel.interface.ts`):
  `ConsoleChannel` (default — logs instead of sending, so nothing can ever
  send for real without credentials configured) and `WhatsAppCloudChannel`
  (real Meta Business Messaging Cloud API calls —
  https://developers.facebook.com/documentation/business-messaging/whatsapp/overview).
  The factory in `notification-channel.provider.ts` picks whichever one has
  credentials; nothing above the interface knows which one is active.
- **Reactive scheduler** (`reactive-scheduler.ts`, unit tested, 7 tests):
  the exact §7.3 rule — `next_send = last_inbound_at + 24h - safety_margin`;
  free-form/template chosen by whether that lands inside the student's
  notification slot, template billable outside it.
- **Magic-link delivery**: `plan_day` pre-generates the next day's Wathb and
  a `daily_wathb` notification row (idempotent per student+day); `send_notification`
  mints a fresh scoped magic link at send time and builds the tap-through URL
  (`{STUDENT_APP_URL}/#magic=<token>`). The student app's bootstrap now
  handles that `#magic=` hash directly — tapping the link exchanges the
  token and lands the student on Home, exactly like a real WhatsApp tap.
- **Webhook** (`webhooks.controller.ts`): `GET` verification handshake,
  `POST` inbound-message handling (opens the `wa_sessions` 24h window) and
  delivery/read status callbacks, with HMAC signature verification via
  `WHATSAPP_APP_SECRET` (skipped only when unset, i.e. local dev).
- **Delivery log + manual triggers** (`admin/src/pages/DeliveryLog.jsx`):
  since this environment has no clock-driven cron to demonstrate against,
  `plan_day`/`send_notification` are exposed as admin-triggerable endpoints
  instead of registered BullMQ jobs — register them as repeatable jobs
  (`api/src/notifications/notifications.service.ts` has the exact logic
  already factored out into plain methods) before any real deployment.
- **Frequency cap** (spec §7.4): max 2 messages/day per student, enforced in
  `NotificationsService.sendDailyWathbNotification`.

**Not implemented in Phase 3**: weekly-report notifications, streak
milestones, subscription-expiring/payment-failed pushes (need Phase 4's
`Subscription` model, now built — wiring those two notification kinds is a
small follow-up), template category/approval bookkeeping beyond the single
`daily_wathb_reminder` name, and WABA quality-rating monitoring.

### Phase 4 — Payments

- **`PaymentProvider` adapter** (`api/src/payments/payment-provider.interface.ts`):
  same shape as `NotificationChannel`. `ConsolePaymentProvider` (default —
  the "checkout URL" points at our own dev-complete endpoint, which instantly
  marks the subscription paid and redirects onward) and `PaymobProvider`
  (real Paymob Intention API call + hosted Unified Checkout redirect, per
  [Paymob's no-code integration path](https://developers.paymob.com/paymob-docs/integration-paths/no-code)).
  The dev-complete endpoint refuses to run at all once real Paymob
  credentials are configured, so it can't leak into a real deployment.
- **`Package` / `Subscription` models**: price stored VAT-inclusive
  (15% KSA, spec §4.5); a purchase snapshots the package's price at checkout
  time so a later price change never touches an active subscription.
- **Checkout flow**: `POST /checkout/start` creates a `pending` subscription
  and returns a checkout URL; a webhook (`POST /webhooks/paymob`, HMAC-verified
  when `PAYMOB_HMAC_SECRET` is set) or the dev-complete redirect confirms it
  to `active` and sets `startsAt`/`endsAt` from the package's duration.
  Confirmation is idempotent — a webhook retry or a double-hit dev-complete
  can't double-extend a subscription.
- **Subscription gates the Wathb loop**: `WathbService.today()` now requires
  an active, unexpired subscription whose package covers the student's
  target test (`isSubscriptionCovering`, pure + unit tested, 8 tests) —
  spec S14, "Expired/paused state — Renewal CTA." The student app catches
  the 403 and routes straight to the pricing screen with the CTA message.
- **Admin Packages screen** (`admin/src/pages/Packages.jsx`): create
  packages (name, tests covered, duration, VAT-inclusive price), toggle
  active/inactive.
- **Student pricing/checkout screen** (`src/pages/StudentDesktop/screens/Pricing.jsx`):
  package cards, VAT-inclusive price display, one-tap checkout; Profile shows
  current subscription status and renewal date.

**Not implemented in Phase 4**: discount codes (`DiscountCode`/`redemptions`
tables), ZATCA e-invoicing (needs legal confirmation per spec §4.5 before
building), proration on upgrade, auto-renewal, a public pre-login pricing
landing page (spec S1 — this app's pricing screen is reachable only after
login/goal-setup), and the subscription-expiring/payment-failed notification
kinds mentioned above.

### Phase 5 — Stakeholders (weekly reports)

Most of Phase 5 (supervisor dashboard, shared student report, student-
initiated invite) was already built in Phase 0–2 — this pass filled in the
one real gap: the weekly WhatsApp report (spec §5.3/§6.5/§9.4's
`weekly_report` job).

- **Weekly report content** (`api/src/reports/weekly-report.util.ts`, 10 unit
  tests): pure week-over-week composite delta, top strength/weakness gated
  by `MIN_SAMPLE_FOR_REPORTING`, and an `AdviceRule` lookup for the weakest
  label — reuses `ReportsService` rather than re-querying the DB.
- **`WeeklyReportService`**: mints a fresh magic link per recipient
  (`weekly_report` for the student, `supervisor_report` for the supervisor),
  sends via the existing `NotificationChannel`, logs to `notifications`,
  idempotent per `(user, week)`. Supervisor sends respect a mute flag and
  skip supervisors with no linked students.
- **Supervisor notification preferences** (spec V3): day-of-week + hour
  picker and a mute toggle (`Supervisor.weeklyReportDay/Hour/Muted`),
  `admin`-independent — the supervisor sets these themselves.
- **Student S11 landing screen**: the weekly link lands on a dedicated
  streak/Δ/strength/weakness screen, not Home — verified end-to-end
  including the honest "not enough data yet" state for a fresh account.
- Exposed as an admin-triggerable endpoint (`POST /api/admin/notifications/weekly-reports`),
  same manual-trigger rationale as `plan_day`/`send_notification` — no
  clock-driven cron in this sandbox to demonstrate against.

**Bug found and fixed while building this**: the supervisor app never
handled a `#magic=<token>` URL hash at all — only the student app did. Every
WhatsApp-delivered supervisor link (invite *or* weekly report) was landing
on the login screen instead of exchanging the token. Fixed in
`supervisor/src/App.jsx`'s `bootstrap()`; verified with a real link exchange
in a browser afterward.

**Not implemented in Phase 5**: an instructor-specific weekly digest format
(the supervisor message currently lists up to 4 linked students in one
message regardless of `supervisor.type`), and the day/hour preference isn't
yet read by anything — the manual trigger sends immediately regardless of a
supervisor's chosen slot (there's no scheduler to honor it yet, same
limitation as Phase 3's `plan_day`).

## What's not built yet

Deliberately out of scope for this pass — each is a later phase in the
spec's own build sequence (§11): geography/schools, cohort analytics,
solution-performance analytics (p-value/discrimination), suspensions/audit
log, advice-string library beyond a 2-row demo, spaced repetition (21-day
review re-entry) — all Phase 6. Plus the Phase 3/4/5 gaps called out above.

## Running it locally

### 1. Database

```bash
docker compose up -d          # postgres:16 + redis:7
```

(If Docker isn't available, any local Postgres 16 + Redis works — see
`docker-compose.yml` for the expected user/password/db name, or update
`api/.env` to match what you have. The `pg_trgm` extension is created
automatically on API boot.)

### 2. API

```bash
cd api
cp .env.example .env          # edit DATABASE_URL if not using docker-compose defaults
npm install
npx prisma migrate dev        # creates schema
npx prisma db seed            # taxonomy + demo questions + demo accounts
npm run start:dev             # http://localhost:4000/api
```

Seed prints the demo accounts on success:
- **Admin:** `admin@wathb.dev` / `wathb-admin-2026`
- **Demo student:** mobile `+966500000001` (pre-seeded with an active
  12-month subscription, so the Wathb loop works immediately)
- **Demo supervisor:** mobile `+966500000099` (pre-linked to the demo student)

### 3. Frontends (each is a separate Vite app)

```bash
npm install && npm run dev              # student app  — http://localhost:5173/wathb/
cd admin && npm install && npm run dev  # admin console — http://localhost:5174/admin/
cd supervisor && npm install && npm run dev  # supervisor — http://localhost:5175/supervisor/
```

The student and supervisor apps log in with the **real OTP flow**: enter the
seeded mobile number, request a code, enter it. The code is sent through
whichever `NotificationChannel` is active — with no WhatsApp credentials
configured that's `ConsoleChannel`, so the code lands in the API's log
output. Set `ALLOW_DEV_LOGIN=true` in `api/.env` (off by default) to also
have the API echo the code back in the `otp/request` response, so the login
page can display it directly — convenient for local dev, never set this in
production.

To configure real WhatsApp delivery instead of the console fallback, set
`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`,
and `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in `api/.env` (see `.env.example`) —
these need a real Meta WhatsApp Business Platform app. Similarly, set
`PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_INTEGRATION_ID`, and
`PAYMOB_HMAC_SECRET` for real Paymob checkout instead of the console
fallback — these need a real Paymob merchant account.

### 4. Trying the WhatsApp flow without real credentials

```bash
# as admin (email/password from seed output):
POST /api/admin/notifications/plan-day        { "forDate": "2026-08-01" }  # generates tomorrow's bundle + queues it
POST /api/admin/notifications/send-due?forDate=2026-08-01                  # "sends" it (ConsoleChannel logs the message + tap-through URL)
GET  /api/admin/notifications                                              # delivery log
```

Copy the URL the API logs (`http://localhost:5173/wathb/#magic=...`) into a
browser — it exchanges the token and lands you on the student Home screen,
the same as a real WhatsApp tap would.

### 5. Trying checkout without real Paymob credentials

Log into the student app with a mobile number that has no active
subscription (the seed's demo student already has one — create another via
`POST /api/admin/students` as admin, or just let `otp/request` create the
account implicitly is not supported; use the admin endpoint). Tap "ابدأ
الوثبة" with no subscription and the app routes straight to the pricing
screen; tap "اشترك الآن" on any package and the console provider's checkout
URL confirms the subscription and redirects straight back — no card details,
no real Paymob account needed.

### 6. Tests

```bash
cd api && npm test     # selection engine + reactive scheduler + subscription + weekly-report unit tests (37 total)
```

## API surface

See `api/src/*/*.controller.ts` for the full list; the core Phase 0–2
endpoints mirror spec §9.3:

```
POST /api/auth/admin/login
POST /api/auth/magic/:token
POST /api/auth/otp/request | verify    (student/supervisor login)

GET  /api/wathb/today
POST /api/wathb/:id/answer
POST /api/wathb/:id/complete

GET  /api/report/student/:id           (role-scoped)

GET  /api/tests
GET  /api/tests/:id/tree
POST /api/admin/tests | sections | areas | labels

GET  /api/admin/questions
POST /api/admin/questions
POST /api/admin/questions/:id/versions
POST /api/admin/questions/import       (multipart CSV)
POST /api/admin/questions/import/:jobId/commit

GET  /api/supervisors/me/dashboard
GET|PATCH /api/supervisors/me/preferences           (weekly report day/hour/mute)
POST /api/students/me/supervisors/invite

GET  /api/admin/notifications                      (delivery log)
POST /api/admin/notifications/plan-day[/:studentId]
POST /api/admin/notifications/send-due | send/:studentId
POST /api/admin/notifications/weekly-reports        (student + supervisor weekly reports)
GET|POST /api/webhooks/whatsapp                     (Meta verification + inbound/status events)

GET  /api/packages                                  (public pricing)
POST /api/admin/packages | PATCH /api/admin/packages/:id
POST /api/checkout/start                            (student session)
GET  /api/checkout/me                                (student's latest subscription)
GET  /api/checkout/dev-complete                      (dev-only, self-disables with real Paymob creds)
POST /api/webhooks/paymob                            (Paymob transaction callback, HMAC-verified)
```

## Known limitations of this pass

- Bulk-import jobs are held in an in-memory `Map` (`bulk-import.service.ts`)
  — fine for a single API instance, move to Redis before scaling out.
- No spaced-repetition re-entry (§6.4's 21-day wrong-answer review) — the
  selection engine simply never re-serves an answered question yet.
- `student_label_stats.difficultyLevel` uses a simple ±1 ladder step per
  answer rather than a calibrated IRT-style model; adequate for the v1
  "deterministic and debuggable" requirement in §6.4.
- OTP has a per-code verify-attempt cap (5) and expiry (5 min), but no
  per-mobile *request* throttling yet — someone could spam `otp/request` for
  a given number. Add rate limiting here and on magic-link exchange (spec
  §9.5) before any non-local deployment.
- `plan_day`/`send_notification` are plain service methods triggered
  manually (admin endpoints), not registered BullMQ repeatable jobs —
  register them on a real queue before relying on them unattended.
- Webhook inbound-message matching is by `mobileE164` lookup only; no
  handling yet for a WhatsApp number that maps to multiple users or has
  changed since signup.
- `WHATSAPP_TEMPLATE_DAILY_WATHB` assumes one pre-approved utility template
  with two body variables (name, link) — real templates need Meta approval
  before they can be sent, and category can silently change on re-approval
  (spec §7.2 flags checking this after every approval, not just submission).
- No proration, upgrade/downgrade, or auto-renewal — a subscription is a flat
  purchase for its `durationMonths` and simply expires; spec §10 open
  question #1 (auto-renew or manual) is still unanswered.
- `PaymobProvider`'s request/webhook field names follow Paymob's published
  Intention API docs but are unverified against a live account — re-check
  field names and the HMAC field order at integration time, same discipline
  the spec asks for on the WhatsApp pricing rules (§7.2).
- `checkout/dev-complete` is a real, reachable endpoint whenever no Paymob
  credentials are configured — that's correct for local dev but means a
  staging environment without real Paymob keys can have subscriptions
  "purchased" for free. Never deploy without Paymob credentials configured
  once real users can reach the environment.
