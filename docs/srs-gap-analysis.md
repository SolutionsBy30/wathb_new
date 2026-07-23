# Wathb SRS v1.1 — Gap Analysis

Status of the codebase (`SolutionsBy30/wathb_new`, branch `claude/ui-language-recommendation-oawn6q`) against `docs/wathb-srs.md`. Legend: ✅ Done · 🟡 Partial · ❌ Missing.

## §3.1 Public site, signup & onboarding (ONB)

| Req | Status | Note |
|---|---|---|
| ONB-001/002/003 | ✅ | `src/pages/Landing` |
| ONB-004 self-service signup, both roles | ✅ | `auth/signup/student\|supervisor` |
| ONB-005 OTP by mobile | ✅ | 4-digit, `+966` prefix |
| ONB-006 package selection if no active sub | ✅ | `WathbService.today()` gate → Pricing screen |
| ONB-007 Paymob card/Mada | ✅ | `PaymobProvider`, untested against a live account |
| ONB-008 wire transfer + manual admin activation | ✅ | `activate-wire-transfer` |
| ONB-009 WhatsApp opt-in consent artifact | ❌ | `whatsappOptInAt` field exists on `User` but nothing sets/captures it at signup |
| ONB-010 goal capture (target test/date/score) | 🟡 | `GoalSetupDto` has these fields; UI only collects test + track today, not score/date at onboarding (score is set nowhere yet) |
| ONB-011 school picker w/ suggest-and-review | ✅ | Built this session — `geography/schools/suggest` |
| ONB-012 notification-window slot picker at onboarding | 🟡 | Fields exist (`notifSlotStartHour/EndHour`), settable from Profile post-onboarding, not during onboarding itself; no free-tier hide logic (free tier doesn't exist yet) |
| ONB-013 placement Wathb + optional supervisor invite prompt | 🟡 | Placement Wathb exists (`generatePlacement`); no post-signup "invite a supervisor?" prompt |
| ONB-014 OTP fallback `1928`, audited, disabled once WhatsApp live | 🟡 | Fallback built and correct; **not** written to any audit log (no audit_log table exists yet); no deploy-time check preventing it in production |

## §3.2–3.3 Student loop & dashboard (STU)

| Req | Status | Note |
|---|---|---|
| STU-001 streak/totals/composite index | 🟡 | Streak + totals ✅; **no composite index anywhere** — only a weekly delta calculation (`compositeDelta`), not a displayed headline number |
| STU-002 test picker among activated tests | 🟡 | Single `targetTestId` per student, not a multi-test "activated tests" set — no picker |
| STU-003/004/005/006 timed question UI, no back/skip | ✅ | `Question.jsx`, server-authoritative via `WathbQuestion.servedAt` |
| STU-007 **no repeat within a bundle** | 🟡 | Selection engine excludes previously-answered questions bundle-to-bundle, but has no explicit in-bundle distinctness guarantee independent of that — needs verification/test |
| STU-008 **single-section-per-Wathb focus** | ❌ | **Selection engine has no section concept at all** — it weights across all labels under the student's track regardless of section. This is a core behavior gap, not cosmetic. |
| STU-009 server-persisted per-question answers, idle-window partial close | 🟡 | Answers persist per-question (`WathbService.answer()`) ✅; no idle-window auto-close-as-partial job |
| STU-010/011 review screen w/ cohort comparison | 🟡 | Explanations screen ✅ (answer/correct/explanation); **no cohort time/accuracy comparison** — that needs `question_stats.meanTimeMs`/`pValue`, which now exist (Phase 6) but aren't wired into the review screen |
| STU-012 👍/👎 + problem report | ❌ | Not built |
| STU-013 completion summary + per-label delta | ✅ | Built this session (`Complete.jsx`) |
| STU-020/021/022 dashboard, charts, MIN_SAMPLE gate | ✅ | `Performance.jsx`, `MIN_SAMPLE_FOR_REPORTING = 20` |
| STU-023 rule-based coaching advice | ✅ | `AdviceRule` (2-row demo per README) |
| STU-024/025 subscription mgmt, test activation | 🟡 | Subscription mgmt ✅; "activate tests" doesn't apply (single-test architecture) |
| STU-026/027 supervisor invite/revoke, invite-unregistered-number | 🟡 | Invite/revoke ✅; inviting an unregistered number **creates the account directly** rather than sending an invitation WhatsApp message that completes signup — different flow than spec's ONB-027 |
| STU-028 notification settings | ✅ | Daily window ✅ (built this session); weekly day/hour on supervisor side, not student side |
| STU-029 step-up OTP for sensitive actions | ❌ | Not built |
| STU-030 friendly expired/paused states | 🟡 | Pricing screen shows a blocked-message; no dedicated "link expired" screen |

## §3.4 Supervisor console (SUP)

| Req | Status | Note |
|---|---|---|
| SUP-001/002 read-only, shared parent/tutor console | ✅ | |
| SUP-003 card vs. table by count, needs-attention ordering | ✅ | `Dashboard.jsx` (`family_card` / `instructor_table`) |
| SUP-004/005 shared report, MIN_SAMPLE | ✅ | Enhanced this session with label/speed detail |
| SUP-006 notification prefs | ✅ | |
| SUP-007 accept/reject pending invite | 🟡 | Accept ✅ (`AcceptInvite.jsx`); **no reject**, and no persistent "pending invites" nav tab — only reachable via the magic link itself, not browsable within a logged-in session |
| SUP-008 supervisor pays on behalf of student | ❌ | Not built — checkout is student-session-only |

## §3.5–3.14 Admin console (ADM)

| Req | Status | Note |
|---|---|---|
| ADM-001/002 overview + alerts | ❌ | No overview screen at all in the current admin app (nav starts at taxonomy) |
| ADM-003 grouped nav | 🟡 | Flat nav list, ungrouped |
| ADM-010/011 taxonomy tree | ✅ | |
| ADM-012 **per-test language setting** | ❌ | `Test` has no `language` field; everything assumes Arabic |
| ADM-013 composite weight, drag-reorder, soft-delete | 🟡 | `sort` field exists, no drag UI; retire exists for labels/questions |
| ADM-020–023 question bank + editor | ✅ | |
| ADM-024 versioning | ✅ | |
| ADM-025 duplicate detection | ✅ | `findSimilar` (pg_trgm) |
| ADM-026 bank-health widget | ❌ | Not built |
| ADM-027 review queue | ❌ | `in_review` status exists as a filter, no dedicated queue/approve screen |
| ADM-030/031 **destination-first import** | ❌ | Current import still requires a `label_id` column per row in the uploaded file — opposite of the spec's destination-selected-in-wizard model |
| ADM-032–034 template, 3-stage import, no partial commit | ✅ | Matches current (label-per-row) design |
| ADM-040–044 solution performance | ✅ | Built this session (p-value/discrimination/flags); missing: distractor-distribution UI, explanation 👍/👎 counts, problem-report counts, correct-rate-over-time chart, per-student answer list |
| ADM-050/051 students list + detail report | 🟡 | List ✅ (built this session); detail = link out to shared report only, not embedded; no school/city filter or performance sort yet |
| ADM-052 subscription/payment/delivery/access history on student detail | ❌ | Not built |
| ADM-060–066 geography & cohort | 🟡 | Region/city/school CRUD ✅, cohort report ✅ (this session); **no comparison-overlay view**, no city/region edit/delete/alias, no school merge tooling |
| ADM-070–076 subscriptions/packages/invoicing | 🟡 | List/CRUD/manual-activation ✅; **no invoicing at all** (no PDF, no ZATCA switch), no price-snapshot-on-subscribe verification, no discount codes, no auto-renew/proration |
| FRE-001–008 **free tier** | ❌ | **Entirely missing.** No package feature flags, no 1-Wathb/day cap, no partial-report blur, no locked-invite state |
| ADM-080/081 notification log | ✅ | |
| ADM-082 manual individual send w/ fresh link | ✅ | `send/:studentId` |
| ADM-083 bulk/promotional send to filtered audience | ❌ | Only "send all due" exists, not an audience-filtered campaign tool |
| ADM-084 WABA quality/cost dashboard | ❌ | Not built |
| ADM-085 suspend + audit log | ❌ | Not built — no `audit_log` table, no suspend action anywhere |

## §3.15 Selection engine (SEL)

| Req | Status | Note |
|---|---|---|
| SEL-001 **one section per Wathb, rotating** | ❌ | Biggest functional gap — engine currently has no section-level concept |
| SEL-002/003 weighted scoring, hard constraints | ✅ | Weakness/coverage/recency/strength/exploration/variety/difficulty-ladder all implemented — just not scoped to a section |
| SEL-004 in-bundle no-repeat + 21-day spaced review | 🟡 | No-repeat effectively holds; **21-day review re-entry not implemented** (README already flagged this) |
| SEL-005 passages atomic, own bundle | ✅ | `bundleType: 'passage'` exists in schema; verify generation logic honors it |
| SEL-006 graceful degradation + admin alert on exhaustion | 🟡 | Degradation exists (sibling-label borrowing per earlier build); no admin alert |
| SEL-007 cold-start uniform coverage | ✅ | Placement Wathb |
| SEL-008 package/activated-test scoping | 🟡 | Package test scope ✅; "activated tests" plural doesn't apply (single-test model) |

## §3.16 Notification/magic-link engine (NOT)

| Req | Status | Note |
|---|---|---|
| NOT-001/002/003 scoped, hashed, high-entropy | ✅ | |
| NOT-004 **24-hour link validity** | ❌ | Current TTLs are purpose-specific and **not** 24h: `wathb`=6h, `weekly_report`/`link_invite`=7 days, `renewal`=1h. Contradicts NOT-004 directly — worth a deliberate decision, not silently "fixed" to 24h, since the 6h Wathb TTL was itself a documented choice (end-of-slot + grace). Flagging for explicit confirmation. |
| NOT-005 revoke on suspend/expiry/mobile-change, step-up | ❌ | No suspend, no step-up |
| NOT-006/007 utility template, reactive scheduler | ✅ | `reactive-scheduler.ts`, tested |
| NOT-008 idempotent nightly plan, UTC storage | ✅ | `plan_day` idempotent per `(student, date)`; admin-triggered not cron |
| NOT-009 paused/expired/suspended/skip/quiet-hour handling, retry ladder | 🟡 | Skip-days ✅; suspended state doesn't exist; no retry ladder |
| NOT-010 frequency caps, STOP opt-out | 🟡 | 2/day cap ✅ (`MAX_STUDENT_MESSAGES_PER_DAY`); **no STOP/إيقاف keyword handling at all** |
| NOT-011 admin manual + bulk send | 🟡 | Manual ✅; bulk/filtered-campaign ❌ |
| NOT-012 channel abstraction | ✅ | `NotificationChannel` interface, Console/WhatsApp adapters |

## §4 Data model

Present: `User/Student/Supervisor/StudentSupervisor`, `Region/City/School` (no `SchoolEnrollment` history table — student↔school is a single current pointer, not a history), `Test/Section/Area/Label/Passage/Question/QuestionVersion`, `Package/Subscription` (no `Invoice`, no `DiscountCode`), `Wathb/Answer` (no section-focus field on `Wathb`, no snapshotted school/city/region on `Answer`), `MagicLink/MagicLinkAccess`, `Notification/WaSession`, `student_label_stats` (✅ materialized, matches spec exactly), `question_stats` (✅ built this session), `cohort_label_stats` — **documented deviation**: computed live, not materialized nightly. **Missing entirely**: `Invoice`, `DiscountCode`/`Redemption`, `audit_log`, `SchoolEnrollment`. No package feature-flag columns for the free tier.

## §6 Non-functional requirements

| Req | Status |
|---|---|
| NFR-001 payload/perf budget | 🟡 Not measured/enforced, likely fine at current bundle size |
| NFR-002 report from materialized stats | ✅ |
| NFR-003/003a RTL, responsive | ✅ (this session's shell rebuild) |
| NFR-004/005 magic link security, rate limiting | 🟡 Security properties ✅; **no rate limiting** on OTP/magic-link exchange (README already flags this) |
| NFR-005a OTP fallback prod-safety | ❌ No audit log entry, no deploy-time check |
| NFR-006/006a cohort 403, free-tier server enforcement | 🟡 Cohort 403 ✅; free-tier N/A (doesn't exist) |
| NFR-007 anti-sharing signal | ❌ Not built |
| NFR-008 PDPL (consent, export/delete, retention) | ❌ Not built |
| NFR-009 VAT invoicing | ❌ Not built |
| NFR-010 Meta policy compliance (categories, opt-out) | 🟡 Categories used correctly; opt-out missing |
| NFR-011/012/013 statistical honesty, server timing, plain-language metrics | ✅ / ✅ / 🟡 (plain-language wording from §1.3.1 not literally used in admin UI copy yet) |
| NFR-014 accessibility | ❌ Not addressed |
| NFR-015/016 idempotent sends, UTC storage | ✅ |

## §9 Open product questions — adopting the SRS's own recommendations as defaults

The SRS states these "materially change the implementation" and lists a recommendation for most. Rather than guess silently or block on all 14, adopting the stated recommendation, documented here, so it's a visible decision point you can override at any time:

1. **Auto-renew vs. manual** → manual (no recommendation given; safer default, matches what's built — a subscription just expires, no stored payment method to auto-charge yet).
2. **Who pays** → student-primary flow stays as built; SUP-008 (supervisor pays) is a real gap, not resolved by this default.
3. **Missed-day behavior** → **vanish** (SRS recommendation) — already the de facto behavior (no rollover/stacking exists).
4. **On-demand extra practice, paid tiers** → allow, uncapped for now (matches current "another Wathb" button); revisit once the free tier exists and caps matter.
5. **Skip/back** → **neither** (SRS recommendation) — already the built behavior.
6. **Passage bundles** → **own Wathb** (SRS recommendation) — matches `bundleType: 'passage'`.
7. **Headline composite score** → **neutral internal index, not a predicted score** (SRS recommendation) — informs how I'll build STU-001's missing composite index: a 0–100 index, never framed as "your estimated Qiyas score."
8. **Content origin** → out of scope for engineering; no action.
9. **Minimum volume before question stats shown to admins** → already implemented as `MIN_SAMPLE_FOR_REPORTING = 20` for p-value, 20 distinct students for discrimination (Phase 6, this session).
10. **Data residency** → infrastructure/hosting decision, not code; no action.
11. **School registry source** → organic (student-suggested + admin review), already built.
12. **PDPL justification for school data** → **optional + skippable + honest purpose** (SRS recommendation) — already how `Student.schoolId` is modeled (nullable, opt-in).
13. **Free-tier shape specifics** (duration, blur portion, prompt wording) → no recommendation given; needs a real answer before FRE-001–008 can be built correctly. **Flagging this one specifically as worth a real decision**, not a default — the blur boundary is a product/legal call (FRE-004 requires it enforced server-side), not something to guess at.
14. **B2B roadmap** → no action needed now; SRS itself says decide direction, build later.

## Recommended build order

Given the scale, roughly in priority order by (spec importance × how self-contained the change is):

1. **SEL-001 single-section-per-Wathb** — the single biggest behavioral gap; changes the selection engine's core loop.
2. **Composite index** (STU-001/SUP-003/ADM-*) — referenced throughout the UI spec as a headline number; currently doesn't exist anywhere.
3. **NOT-004 24h magic links + NOT-010 STOP opt-out** — security/compliance-adjacent, self-contained.
4. **Free tier (FRE-001–008)** — big, but well-specified; blocked on open question #13 (blur boundary) for full fidelity — will build the mechanism with a placeholder boundary and flag it clearly.
5. **ADM-030/031 destination-first import redesign**.
6. **ADM-085 suspend + audit log** — touches many actions (wire-transfer activation, OTP fallback use, manual sends) that should already be writing to it.
7. **ADM-001/002 admin overview + alerts** — currently the admin app has no landing screen.
8. Everything else in this document, roughly by section order.

Invoicing/ZATCA (ADM-074), discount codes (ADM-076), WABA dashboard (ADM-084), and PDPL export/delete (NFR-008) are large, mostly-standalone subsystems better scoped as their own follow-up passes rather than folded into this one.
