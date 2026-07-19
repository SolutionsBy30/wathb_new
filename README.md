# Wathb (وثب)

A subscription service that delivers a small daily bundle of standardized-test
questions to a student, weighted toward their measured weak areas, with
progress reported to a parent/instructor. Full product spec:
[`docs/product-spec.md`](./docs/product-spec.md).

This repo currently implements **Phase 0–2** of the spec's build sequence
(§11): the taxonomy/question bank, the core Wathb loop (magic-link auth →
timed questions → explanations → completion), and the adaptive selection
engine + student/supervisor reporting. **Phase 3 (WhatsApp), Phase 4
(payments), and Phase 6 (ops/analytics) are not built** — see
[What's not built yet](#whats-not-built-yet).

## Architecture

| Layer | Choice |
|---|---|
| API | NestJS + TypeScript (`/api`) |
| DB | PostgreSQL via Prisma |
| Cache/Queue | Redis (provisioned, not yet used — no scheduler until Phase 3) |
| Student app | React + Vite, mobile-width, RTL (`/src`, repo root) |
| Admin console | React + Vite, desktop (`/admin`) |
| Supervisor app | React + Vite, mobile-width, RTL (`/supervisor`) |

Each frontend is an independent Vite app sharing a copy of the same design
system (`design-system/` — IBM Plex Sans Arabic + Outfit, indigo/sand/lime
tokens) that shipped with the original prototype.

**Auth model** implements spec §7.1 (scoped, single-purpose magic links,
hashed tokens, no session in the URL) with one pragmatic deviation: the
scoped session is returned as a JWT in the response body (stored in
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

## What's not built yet

Deliberately out of scope for this pass — each is a later phase in the
spec's own build sequence (§11):

- **WhatsApp delivery** (Phase 3) — `NotificationChannel` adapter against
  [Meta's Business Messaging Cloud API](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview)
  is not implemented. The `dev/request-link` endpoint
  (`ALLOW_DEV_LOGIN=true` only) stands in for "the WhatsApp message arrives
  and the student taps it."
- **Payments/packages** (Phase 4) — checkout, `Package`/`Subscription`
  tables, VAT/ZATCA invoicing. Integration point is
  [Paymob's no-code hosted checkout](https://developers.paymob.com/paymob-docs/integration-paths/no-code)
  per the product owner's direction.
- **Geography/schools, cohort analytics, solution-performance analytics
  (p-value/discrimination), suspensions/audit log, advice-string library
  beyond a 2-row demo, spaced repetition (21-day review re-entry)** (Phase
  5–6).

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
- **Demo student:** mobile `+966500000001`
- **Demo supervisor:** mobile `+966500000099` (pre-linked to the demo student)

### 3. Frontends (each is a separate Vite app)

```bash
npm install && npm run dev              # student app  — http://localhost:5173/wathb/
cd admin && npm install && npm run dev  # admin console — http://localhost:5174/admin/
cd supervisor && npm install && npm run dev  # supervisor — http://localhost:5175/supervisor/
```

The student and supervisor apps log in via a **dev-only magic-link
stand-in**: enter the seeded mobile number and it mints + exchanges a token
in one step (`ALLOW_DEV_LOGIN=true` in `api/.env`, off by default — never
enable in production). This is the only place a real WhatsApp tap is
simulated; everything downstream (session scoping, TTL, single-use) is the
real mechanism from spec §7.1.

### 4. Tests

```bash
cd api && npm test     # selection engine unit tests
```

## API surface

See `api/src/*/*.controller.ts` for the full list; the core Phase 0–2
endpoints mirror spec §9.3:

```
POST /api/auth/admin/login
POST /api/auth/magic/:token
POST /api/auth/dev/request-link        (dev-only)

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
POST /api/students/me/supervisors/invite
```

## Known limitations of this pass

- Bulk-import jobs are held in an in-memory `Map` (`bulk-import.service.ts`)
  — fine for a single API instance, move to Redis before scaling out.
- No spaced-repetition re-entry (§6.4's 21-day wrong-answer review) — the
  selection engine simply never re-serves an answered question yet.
- `student_label_stats.difficultyLevel` uses a simple ±1 ladder step per
  answer rather than a calibrated IRT-style model; adequate for the v1
  "deterministic and debuggable" requirement in §6.4.
- No rate limiting on magic-link exchange/OTP (spec §9.5) — add before any
  non-local deployment.
