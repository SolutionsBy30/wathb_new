# Wathb — Daily Practice Platform for Standardized Tests
### Product Requirements & Build Spec
**Version 0.1 — Draft for Claude Design (prototype) & Claude Code (implementation)**

---

## 1. Product Overview

**One-liner:** A subscription service that delivers a small bundle of standardized-test questions to a student's WhatsApp every day, weights those questions toward the student's measured weak areas, and reports progress to a parent or instructor.

**Core loop:**
> Student receives WhatsApp message → taps a passwordless link → answers a timed bundle of ~5 questions ("a Wathb") → sees explanations immediately → performance updates their strength/weakness profile → tomorrow's bundle is re-weighted → weekly report to student + supervisor.

**Volume target:** 1,000–3,000 unique questions answered per student per year. At 5 questions/day × 365 days = ~1,825. The bank must be large enough and the selection algorithm smart enough that a student never sees a repeat until deliberately scheduled for spaced review.

**Primary market:** Saudi Arabia — Qiyas GAT (قدرات) first, but the system is built test-agnostic. Arabic-first, RTL-first UI, with English as a secondary locale.

**Naming note:** "Wathb" (وثب) is used throughout as the name of a question bundle/session. If it is also the product name, keep the distinction explicit in the UI copy ("Today's Wathb").

---

## 2. Roles & Permissions

| | Admin | Supervisor | Student |
|---|---|---|---|
| Create/edit tests, sections, labels | ✅ | — | — |
| Author & import questions | ✅ | — | — |
| Set per-question timers | ✅ | — | — |
| Create packages & pricing | ✅ | — | — |
| Create discount codes | ✅ | — | — |
| Suspend users | ✅ | — | — |
| View platform-wide analytics | ✅ | — | — |
| View **school / city / region cohort** analytics | ✅ | — | — |
| View **question quality** analytics | ✅ | — | — |
| View one student's performance report | ✅ | ✅ (linked students only) | ✅ (self) |
| Receive weekly WhatsApp report | — | ✅ | ✅ |
| Answer questions | — | — | ✅ |
| Subscribe / pay | — | — | ✅ (or supervisor pays on behalf) |
| Set goal & notification window | — | — | ✅ |

**Notes on role edges:**
- A supervisor may be a **parent** (usually one to three students) or an **instructor** (potentially dozens). Same role, different scale — the supervisor dashboard must handle both. Consider a `supervisor_type` field to switch between a "family card view" and an "instructor table view."
- One student can have **multiple supervisors** (mother + tutor). One supervisor can have multiple students. Many-to-many.
- Linking is done by **student invite**: student enters supervisor's mobile → supervisor gets a WhatsApp link → taps to accept. Consent is explicit and revocable by the student (age-appropriate compliance).
- Admin has a **support sub-role** (view-only + resend link + extend subscription) so customer support staff aren't handed full destructive powers. Recommended even at v1.

---

## 3. Domain Model

```
Test (اختبار)
 └── Section (قسم)            e.g. Verbal (لفظي), Quantitative (كمي)
      └── Area (مجال)          e.g. Semantic Relationships (العلاقات اللفظية)
           └── Label (تصنيف)   e.g. Verbal Analogy (التناظر اللفظي)
                └── Question
```

A **three-level taxonomy** (Section → Area → Label) is what makes the strength/weakness report meaningful. The Qiyas structure the client described maps like this:

**Test: Qiyas GAT — General Aptitude Test**

| Section | Area | Labels |
|---|---|---|
| Verbal (لفظي) | Semantic Relationships | Verbal Analogy, Related Terms (المفردة الشاذة alt.), Odd-One-Out |
| Verbal | Linguistic Structures | Sentence Completion, Contextual Error, True/False Statements |
| Verbal | Comprehension | Reading Comprehension |
| Quantitative (كمي) | Arithmetic | Operations, Ratios, Percentages, Number Properties |
| Quantitative | Geometry | Angles, Areas, Volumes, Coordinate Geometry |
| Quantitative | Algebra | Equations, Inequalities, Sequences — *scientific track only* |
| Quantitative | Data Analysis | Tables, Charts, Probability, Statistics |

**Critical requirement:** Labels are **admin-defined data, not code enums.** Adding a new test (STEP, SAAT, Mawhiba, TOEFL-style, or a school's internal exam) must require zero deployment. Every dropdown, report axis, and chart in the product reads from this table.

**Track/eligibility flag:** Algebra is scientific-track only. Model this as a `applies_to_tracks: []` array on the Area/Label, and a `track` field on the student's enrollment. The selection engine filters on it.

### 3.1 Question entity

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `test_id`, `section_id`, `area_id`, `label_id` | fk | Label implies its parents; denormalize for query speed |
| `type` | enum | `mcq_single`, `mcq_multi`, `numeric_entry`, `true_false` |
| `passage_id` | fk nullable | For reading comprehension — several questions share one passage |
| `stem` | rich text | Arabic RTL, LaTeX/MathML support, may contain an image |
| `stem_image_url` | string nullable | Geometry figures |
| `options[]` | json | `{key, text, image_url}` — 4 or 5 options |
| `correct_key` | string | |
| `explanation` | rich text | **Mandatory.** Shown after the bundle. This is the product's teaching moment. |
| `difficulty` | enum/int | `1..5` seeded by author, **auto-corrected by live p-value** |
| `time_limit_seconds` | int nullable | Overrides the label/global default |
| `status` | enum | `draft` → `in_review` → `published` → `retired` |
| `source` | string | Provenance — matters for copyright/originality audit |
| `tags[]` | array | Freeform, for admin's own slicing |
| `version` | int | Editing a published question creates v2; historic answers stay bound to v1 |

**Question versioning is non-negotiable.** If an admin fixes a typo in a question 8,000 students have already answered, the historical analytics must not silently change meaning. Answers reference `question_version_id`.

### 3.2 Passage entity
Reading comprehension needs a `Passage` with 3–5 attached questions. The selection engine must treat a passage as an **atomic unit** — never deliver question 2 of a passage without the passage. This has a knock-on effect: a passage bundle may be a Wathb of 4 instead of 5, or a passage may occupy a whole Wathb. Decide the rule explicitly (recommendation: passage sets get their own Wathb, flagged `bundle_type: passage`).

### 3.3 Other core entities

- **Package** — `name`, `test_ids[]`, `duration` (1 / 6 / 12 months), `price`, `currency: SAR`, `questions_per_day`, `is_active`, `visibility` (public / link-only for B2B deals).
- **Subscription** — `student_id`, `package_id`, `starts_at`, `ends_at`, `status` (active / paused / expired / suspended / refunded), `discount_code_id`, `amount_paid`.
- **DiscountCode** — `code`, `type` (percent / fixed / free_days), `value`, `max_redemptions`, `redemptions_used`, `per_user_limit`, `valid_from`, `valid_to`, `applicable_package_ids[]`, `owner_label` (which influencer/campaign — this is the whole point, attribution).
- **Wathb (Session)** — `student_id`, `scheduled_for`, `delivered_at`, `opened_at`, `completed_at`, `question_ids[]`, `status`, `magic_link_id`.
- **Answer** — `wathb_id`, `question_version_id`, `selected_key`, `is_correct`, `time_taken_ms`, `timed_out` (bool), `answered_at`.
- **Goal** — `student_id`, `target_score`, `test_date`, `daily_question_target`.
- **MagicLink** — see §7.
- **NotificationLog** — see §6.

### 3.4 Geography & institutions

**Do not add `school` and `city` as free-text fields on the student record.** Typed text cannot be aggregated. You will get "ثانوية الملك فهد", "King Fahd Secondary", "k.fahd sec.", and "مدرسة الملك فهد الثانوية بالدمام" as four separate schools, and the per-school report — the entire point of the request — becomes noise. Model them as canonical entities from day one; retrofitting canonical data onto a year of free text is a manual cleanup project nobody will fund.

```
Region (منطقة)        13 KSA admin regions, seeded, fixed
  └── City (مدينة)     seeded, admin-extensible
       └── School (مدرسة)
```

- **Region** — `id`, `name_ar`, `name_en`, `country_code`. Seed the 13 Saudi regions. This is the rollup marketing actually thinks in (Riyadh / Makkah / Eastern Province), and it's the level where sample sizes are large enough to mean something on day one.
- **City** — `id`, `region_id`, `name_ar`, `name_en`, `aliases[]`, `is_active`. Seed the ~50 cities that matter; let admin add. Aliases matter: Dammam / الدمام / Ad-Dammam must resolve to one row.
- **School** — `id`, `city_id`, `name_ar`, `name_en`, `aliases[]`, `moe_code` (Ministry of Education school ID, if obtainable), `type` (public / private / international / foreign-curriculum), `gender` (boys / girls / mixed), `stage` (secondary / intermediate), `is_verified`, `merged_into_id` (nullable), `created_by` (admin | student-suggested), `student_count`.
- **SchoolEnrollment** — `student_id`, `school_id`, `grade`, `academic_year`, `started_at`, `ended_at`.

**Three design decisions worth defending:**

1. **City derives from school — don't ask twice.** If the student picks a school, the city and region come free and are guaranteed consistent. Asking both independently guarantees you eventually store "Al-Faisaliyah School" located in "Jeddah" when the school is in Riyadh, and then no report can be trusted. Ask city directly *only* as a fallback when the student skips or can't find their school (homeschooled, expat, retaking after graduation — a real and growing segment of GAT candidates who have no current school at all).

2. **Enrollment is a history, not a foreign key.** Students change schools; a student who transfers in October must not have September's answers silently re-attributed to the new school. Every `answer` should carry a `school_id` snapshot at answer time, resolved from the enrollment active on that date. Without this, per-school reports quietly rewrite themselves every time a student transfers — the worst kind of bug, because it never errors.

3. **`merged_into_id`, not delete.** Duplicate schools are inevitable no matter how good the autocomplete is. Admin needs a **merge tool**, and merging must repoint enrollments rather than orphan them. Budget for this; it is not optional cleanup, it is a standing weekly chore.

---

## 4. Admin

### 4.1 Test & Taxonomy Builder
A tree editor: Test → Section → Area → Label. Drag to reorder, inline rename, soft-delete (a label with questions attached cannot be hard-deleted — it is retired, and its questions must be reassigned or retired with it; the UI must state this rather than fail silently).

Per node, admin sets:
- Display name (AR + EN)
- Default `time_limit_seconds` (inherited down the tree unless overridden — show the inherited value greyed out so the admin knows what they're overriding)
- Weight in the composite score (does Verbal count 50%?)
- Track applicability

### 4.2 Question Bank
This is where the admin will spend 90% of their time. Design it like a serious tool, not a CRUD form.

**Screens:**
1. **Bank list** — dense table. Filters: test, section, area, label, difficulty, status, has-image, times-served, p-value, author, date. Full-text search across stem. Bulk select → bulk retire / bulk relabel / bulk export.
2. **Question editor** — split view: form on the left, live student-eye preview on the right (RTL, mobile width). Math renders live. Explanation field sits beside the answer key so the author can't forget it — make `explanation` a hard validation, not a nice-to-have.
3. **Bulk importer** — CSV/XLSX upload with a downloadable template + Word/Docx paste. Import runs in three stages: **parse → validate → confirm**. The validation report shows per-row errors (missing label, no correct answer, duplicate stem hash) and the admin fixes them in-grid before committing. Never partial-commit a bad import.
4. **Duplicate detector** — on import and on save, hash the normalized stem and fuzzy-match (trigram / embedding similarity) against the bank. Duplicates are the single biggest threat to the "3,000 unique questions" promise.
5. **Review queue** — questions in `in_review`, with a second-reviewer approve/reject + comment. Optional at v1, essential by the time you have freelance authors.

**Bank health dashboard** (admin home widget) — the number that tells the admin whether the product can keep its promise:
> "Verbal → Semantic Relationships → Odd-One-Out: **62 published questions**. At current usage this label is exhausted for a 12-month student in **4.1 months.** ⚠️"

Compute per-label coverage against the per-day plan and flag thin labels in red. This single view drives the content roadmap.

### 4.3 Solution Performance (question quality analytics)
The client called this "solution performance." It means: *is this question any good?* Per question, track:

- **p-value** — % answering correctly. Below 0.15 or above 0.95 → flag as non-discriminating.
- **Discrimination index** — do high performers get it right more than low performers? A negative discrimination index almost always means **the answer key is wrong.** Surface these loudly.
- **Mean time taken** vs. its timer. If 80% of students time out, the timer is wrong or the question is broken.
- **Distractor analysis** — % choosing each option. An option nobody ever picks is dead weight; an option picked more than the key is a red flag.
- **Explanation helpfulness** — one-tap 👍/👎 on the explanation screen. Cheap to collect, high signal.
- **Report-a-problem** queue — student-submitted flags land in an admin inbox with the question and the student's answer attached.

Each of these needs a **direct action** from the analytics row: edit, retire, or dismiss-flag. Analytics that don't lead to an action get ignored.

### 4.4 Student Performance (admin view)
Search any student → same report the supervisor sees, plus: subscription history, payment history, notification delivery log, session-by-session raw answers, and device/link access log. Used for support ("I never got my message") and abuse investigation.

### 4.5 Packages & Pricing
CRUD over Package. Fields per §3.3. A package bundles one or more tests, a duration, a price, and a `questions_per_day`. Admin can preview the public pricing page as it will render.

**Pricing edge cases to specify before coding:**
- What happens to existing subscribers when a package price changes? (Recommendation: subscriptions store a **price snapshot**; changes never touch active subs.)
- Renewal: auto-renew or manual? Auto-renew requires a saved payment token and a cancellation flow — decide now, because it shapes the payments integration.
- Proration on upgrade (1-month → 12-month mid-cycle).
- VAT (15% KSA) — inclusive or exclusive display, and a compliant e-invoice (ZATCA Fatoora). This is a legal requirement in Saudi, not an afterthought. Confirm the client's ZATCA obligations early.

### 4.6 Discount Codes
CRUD per §3.3, plus a **redemption report**: per code — views, redemptions, revenue, and — the one that matters — retention of the cohort who used it. A code that brings 200 signups who all churn in month one is a loss.

### 4.7 Suspension & Moderation
Suspend a user with a required `reason` + `note`, immediately invalidating all their live magic links. Suspension is reversible and logged. Define the policy the admin is enforcing (link sharing, account sharing, abuse of the report-a-problem channel, chargebacks). 

**Anti-sharing signal:** magic links are per-student and single-purpose; if one link is opened from 6 IPs/devices, flag it. Don't auto-ban — false positives (family wifi, mobile carrier NAT) are common. Flag for human review.

**Full audit log** across all admin actions — who changed what, when, previous value. Non-optional in a product handling minors' data and money.

### 4.8 Cohort Analytics — by School, City & Region

**Purpose:** admin-only. Answers three separate questions that shouldn't be conflated:
- *Commercial* — where are my students, where should I sell, which schools convert and retain?
- *Content* — does one city's cohort fail Geometry at a rate that suggests a curriculum gap I can build product for?
- *Delivery* — is the product working equally well everywhere?

**Screens:**

- **Geography overview** — table + optional map. Rows: region → city → school (expandable). Columns: active students, subscription revenue, Wathb completion rate, mean accuracy, Δ vs. platform mean, top weakness area, churn rate.
- **School detail** — the roster (linking to individual student reports), the school's area/label accuracy profile against the platform baseline, growth over time, and which discount codes brought these students in.
- **Comparison view** — pick 2–5 schools or cities, overlay their accuracy-by-area profiles. This is where the genuinely useful insight lives: *"Al-Khobar cohorts underperform the platform mean on Data Analysis by 14 points but beat it on Algebra"* is a content roadmap and a sales pitch in one line.

**Reuse, don't rebuild.** The per-school report is the §5.2 student report with the aggregation key swapped from `student_id` to `school_id`. Build the reporting layer to take a **cohort filter** (`{student_id | school_id | city_id | region_id | discount_code_id | package_id | cohort_month}`) and every one of these views is the same query. Do this once, in Phase 2, and school/city analytics costs almost nothing to add later.

**Four guardrails — please read these before building:**

1. **Minimum cohort size, enforced in the reporting layer.** The same `MIN_SAMPLE_FOR_REPORTING` discipline from §5.2, one level up. A school with 3 students is not a data point; showing "Al-Faisaliyah: 41% accuracy" off three teenagers is a number someone will screenshot. Recommend `MIN_COHORT = 15` students **and** `MIN_ANSWERS = 500` before any school-level percentage renders. Below the floor, show the roster and the raw counts — never a rate.

2. **Never rank schools, and never expose this outside admin.** A league table of Saudi schools by aptitude score is a reputational and legal landmine, and it is not yours to publish — your sample is self-selected (the students motivated enough to buy daily practice), which makes any school comparison statistically indefensible as a claim about the *school*. Keep it admin-only, keep it out of the API responses for student/supervisor roles (enforce at the query layer, not the UI), and put it in writing that this data is never marketed. If a school buys a B2B licence they can see *their own* cohort and the anonymised platform baseline — nobody else's.

3. **Selection bias is the whole caveat.** Every school number measures *your subscribers at that school*, not the school. Label it that way in the UI itself — "17 subscribed students at this school" not "this school" — so nobody on the team forgets and repeats it to a client as fact.

4. **Minors + institution + location is a sensitive combination.** Under PDPL this raises the stakes on the §9.5 privacy review. School is arguably not necessary to deliver the service, which makes it harder to justify as required data. Recommendation: make school **optional and skippable**, ask for it with an honest reason ("so we can compare your progress to students preparing for the same test"), and never gate onboarding on it.

**The best data comes from not asking.** Three attribution paths, in order of quality:
- **B2B/bulk enrollment** — a school or instructor buys N seats; every student on that contract is attributed automatically, verified, zero typing. Highest quality by far.
- **Discount code** — extend `owner_label` (§3.3) with an optional `school_id` / `city_id`. An instructor's or school's code attributes the student on redemption with no onboarding step at all.
- **Self-declared autocomplete** — the fallback. Search-as-you-type against the canonical registry, "I can't find my school" → free-text suggestion that lands in an **admin review queue**, never directly into the schools table. This is the valve that keeps the registry clean.

**Note the B2B door this opens.** Once schools are canonical entities with cohort dashboards, "school buys 200 seats and gets a principal's dashboard" is a natural product — likely a better business than consumer subscriptions, with a fraction of the WhatsApp cost per student. That's a strategy conversation, not a v1 build. But model schools cleanly now so the option stays open, and don't build the school-admin role until someone has actually asked to pay for it.

---

## 5. Supervisor

Deliberately **read-only and small.** A parent has ~90 seconds of attention. An instructor with 30 students needs triage, not depth.

### 5.1 Supervisor dashboard
- **Parent view (1–3 students):** one card per student — Wathb streak, questions answered this week vs. target, composite score trend arrow, top strength, top weakness, next test date countdown.
- **Instructor view (4+ students):** sortable table — name, streak, completion %, composite score, Δ vs. last week, weakest area. Sort by "needs attention" by default. Rows expand into the full student report.

### 5.2 Student report (shared component with student & admin views)
1. **Total questions answered** — lifetime, this week, vs. daily target. Progress toward the 1,000–3,000/year milestone (a strong retention mechanic — show it).
2. **Accuracy by area** — horizontal bar chart, one bar per Area, RTL. Color-coded. This is the "strength and weakness" view.
3. **Drill-down to Label** — tap an Area, see its Labels. *Odd-one-out 42%, Verbal analogy 78%.* This is the level at which advice becomes actionable.
4. **Trend line** — composite accuracy over 8 weeks. Answers the only question a parent really has: *is it working?*
5. **Speed** — mean time per question vs. the target timer, per area. A student can be accurate and still fail the real test on pace. This is a genuinely differentiated insight; feature it.
6. **Consistency** — a GitHub-style contribution heatmap of daily Wathb completion. Instantly legible to a non-analytical parent.
7. **Sample of recent mistakes** — 3 recent wrong answers with explanations, so a parent can actually sit with their child.

**Statistical honesty requirement:** do not render a percentage for an area with fewer than ~20 answers. Show "collecting data — 7 of 20 answers" instead. A parent who sees "Geometry 33%" based on 3 questions will panic or, worse, act on noise. Set a `MIN_SAMPLE_FOR_REPORTING` constant and enforce it in the reporting layer, not the UI.

### 5.3 Weekly WhatsApp notification (supervisor)
Short template message + magic link to the full report. Content: name, questions answered, Δ vs. last week, one strength, one weakness, streak. Fewer than 5 lines. Supervisor can set the day/time and can mute.

---

## 6. Student

### 6.1 Onboarding
1. Landing → choose package → discount code → pay → account created against **mobile number** (the WhatsApp identity). Mobile is the primary key of the user's life here; email is optional.
2. **WhatsApp opt-in** — explicit, logged, timestamped. Required by Meta policy and by KSA PDPL. Capture and store the consent artifact.
3. **Goal setup** — target test (Qiyas GAT), track (scientific/humanities — this gates Algebra), test date, target score.
4. **School (optional, skippable)** — autocomplete against the canonical registry (§3.4); city and region derive from the pick. Fallback: pick a city directly. Skipping must be one tap and must never block onboarding — a graduate retaking the GAT has no school, and pretending otherwise costs you the signup.
5. **Notification window** — see §6.2.
6. **Placement Wathb** — 10–15 questions spread across all areas, to seed the weakness profile. Without this, the first two weeks of "adaptive" selection are just random, and the first weekly report is meaningless. This is the highest-leverage screen in onboarding.
7. **Invite supervisor** (optional, skippable, re-promptable later).

### 6.2 Notification window — the 2-hour slot model
The student picks a **2-hour slot** (e.g. 12:00–14:00), not an exact time. The system schedules the actual send **inside** that slot. This exists for a real reason: it gives the scheduler the freedom to alternate send times day-to-day and halve WhatsApp costs (§7). The student never sees the machinery.

UI: a simple slot picker — Morning 8–10, Late morning 10–12, Midday 12–14, Afternoon 14–16, Late afternoon 16–18, Evening 18–20, Night 20–22. Plus a timezone (default Asia/Riyadh) and a "skip Fridays" toggle (culturally relevant; make weekend days configurable per market, not hardcoded).

### 6.3 The Wathb (daily bundle)
- **Size:** default 5, configurable per package (`questions_per_day`).
- **Selection:** weighted toward weakness — see §6.4.
- **Timer:** per-question, set by admin, visible as a calm circular countdown. On expiry the question auto-submits as `timed_out` and advances. **This is the pace-training feature — do not let students pause or go back.** Mirroring real test pressure is the point.
- **No back button, no skip** — or if skip is allowed, it re-queues the question at the end. Decide before build. Recommendation: no back, no skip, at v1.
- **Interruption handling:** the student's phone will ring mid-Wathb. Persist answers server-side per question, not at the end. If they return within N minutes, resume where they left off with the timer honest about elapsed time; after N minutes, close the Wathb as partial and count only what was answered. Specify N (recommendation: 30 min).
- **Explanations screen:** after all 5, a review of each — their answer, the key, and the explanation. Never show correctness *during* the bundle; it breaks the test-simulation and lets a wrong answer poison the next question's focus.
- **Completion:** streak update, an encouraging line, and the updated weakness profile — "your Geometry is up 6 points this week."

### 6.4 Question selection engine
The core IP. Specify it explicitly rather than leaving it to implementation.

**Inputs:** student's per-label accuracy + sample size, per-label recency, difficulty ladder position, questions already seen, track eligibility, package's test scope.

**Algorithm (v1 — deterministic and debuggable, not ML):**
```
For each eligible label:
    weakness_weight = 1 - accuracy(label)        # low accuracy → high weight
    confidence      = min(1, n_answered(label) / MIN_SAMPLE)
    coverage_weight = 1 / (1 + n_answered(label)) # under-sampled → boost
    recency_penalty = decay if seen today/yesterday
    score = (weakness_weight * confidence + coverage_weight * (1 - confidence))
            * recency_penalty * label_curriculum_weight

Sample labels ∝ score, but enforce:
  - ≥ 1 question from a STRENGTH label per bundle   (morale — an all-weakness bundle is demoralizing and drives churn)
  - ≥ 1 question from an under-sampled label        (exploration — you cannot fix what you never measure)
  - ≤ 3 questions from any single label            (variety)
  - difficulty within ±1 of the student's ladder position for that label
Then pick an unseen question at the target difficulty from each chosen label.
```

**Explicit design decisions to make:**
- **Exploration vs. exploitation.** Pure weakness-targeting is a trap: a student who is bad at Geometry gets only Geometry, never re-tests Verbal, and the Verbal number silently goes stale. The `coverage_weight` and the mandatory strength question are the counterweight. Tune the ratio; don't drop it.
- **Spaced repetition.** "Never repeat" and "learn from mistakes" are in tension. Recommendation: questions answered **wrong** re-enter the pool after 21 days, flagged `is_review`, and count separately in the "unique questions answered" tally so the 1,000–3,000 promise stays honest.
- **Bank exhaustion.** When a label runs dry, the engine must degrade gracefully (borrow from a sibling label, or serve review items) and **fire an admin alert**, not throw.
- **Cold start.** Before the placement Wathb, weight = uniform coverage. After it, confidence is still low for ~2 weeks; that's what the `confidence` term handles.

### 6.5 Weekly student report + coaching
Same report as §5.2, plus **advice**. The client asked for "training to advise to do better." Keep v1 rule-based and specific:

> "Your Odd-One-Out accuracy is 44% — your weakest area. You average 71 seconds on these against a 45-second target. Slow down on the first read: identify the *category* the three shared words belong to before looking at the fourth."

Rules map (label × accuracy band × speed band) → a curated advice string written by a subject expert. A hand-written library of ~60 strings will outperform generated text, be reviewable, and cost nothing at runtime. Store advice strings as admin-editable data.


---

## 7. Notification & Magic Link Engine

This is the operational heart of the product and the part most likely to be built wrong. Treat it as its own service.

### 7.1 Passwordless magic links

**Requirement:** every notification carries a unique link; tapping it grants access with no login.

**Design:**
```
MagicLink {
  id, token_hash, student_id (or supervisor_id),
  purpose: 'wathb' | 'weekly_report' | 'supervisor_report' | 'renewal' | 'link_invite',
  target_id,                 // e.g. the wathb_id
  expires_at,                // purpose-specific TTL
  max_uses, uses,
  first_used_at, last_used_at,
  ip_log[], user_agent_log[],
  revoked_at
}
```

**Rules:**
- Store only a hash of the token; the raw token exists in the URL and nowhere else in the database.
- Token ≥ 128 bits of entropy from a CSPRNG. Never sequential, never derived from user id.
- **Scoped, not a session.** A `wathb` link opens *that Wathb only*. It must not grant access to billing, profile, or subscription cancellation. This is the whole security model — the link is a capability, not a login. If a link leaks (screenshot in a group chat, forwarded to a friend), the blast radius is one bundle.
- **TTL per purpose:** Wathb link expires at the end of the day's slot window + a grace period (recommendation: 6h). Report links: 7 days. Renewal/payment links: 1h and single-use.
- Tapping the link exchanges it for a **short-lived scoped session cookie** so the token isn't re-sent on every subsequent request and doesn't sit in browser history for the whole session.
- **Revoke on suspend**, on subscription expiry, and on mobile-number change.
- Anything sensitive — changing the mobile number, cancelling a subscription, viewing payment history — requires **step-up auth**: send a fresh OTP. Convenience is for practice; friction is for money and identity.

**The obvious failure mode to design against:** WhatsApp on a shared family phone. The Wathb link opening straight into practice is fine. The same tap reaching "cancel subscription" is not.

### 7.2 WhatsApp cost model — verified against current Meta rules

The client's instinct is right and the mechanism is worth stating precisely, because the details determine whether it works at all.

**Current rules (verify at build time — Meta revises these):**
- <cite index="7-1">Since July 1, 2025 Meta charges per delivered **template** message; rates depend on the template's category and the recipient's country code.</cite>
- <cite index="7-1">Since November 1, 2024, Meta does not charge for **non-template** messages, and non-template messages can only be sent inside an open customer service window.</cite>
- <cite index="7-1">Since July 1, 2025, Meta does not charge for **utility templates** delivered inside an open customer service window.</cite>
- <cite index="9-1">The customer service window opens when the **user** contacts the business</cite>, and <cite index="6-1">the 24-hour timer resets every time the customer sends another message — so an active conversation can stay free indefinitely as long as the user keeps replying inside each 24-hour period.</cite>

**⚠️ The single most important correction to the plan as described:** the window is opened by the **user sending a message** — *not* by the business sending one, and *not* by the student tapping a link. A tap on a URL is invisible to Meta. If the student only ever taps the link and never messages back, **no window ever opens and every message is billed at full template rate.** The alternating schedule alone saves nothing.

**The fix:** the daily message must be a template with a **Quick Reply button** — "ابدأ وثبة اليوم / Start today's Wathb". Tapping a quick-reply button sends an inbound message from the user, which opens the 24-hour window. Then:

```
Day 1  13:00  Utility template + quick-reply button        → PAID
Day 1  13:00:04  student taps button (inbound)             → window opens until Day 2 13:00
Day 2  12:00  free-form message with link                  → FREE  (inside window)
Day 2  12:00:06  student taps                              → window opens until Day 3 12:00
Day 3  ??:??  must send before 12:00 to stay free — outside the 12:00–14:00 slot
Day 3  13:00  Utility template                             → PAID   (cycle resets)
```

**Insight worth acting on:** the width of the slot sets the cost ratio. Each day's send must be *earlier* than the previous day's inbound to stay inside the window, so a slot of N one-hour positions gives **1 paid message per N days**, not 1 in 2.
- 2-hour slot (12:00 / 13:00 / 14:00 → 3 positions) → **~33% paid**, not 50%.
- 3-hour slot → ~25% paid. 4-hour slot → ~20% paid.

Consider offering the student a wider slot ("anytime this afternoon") as the *default*, with a narrow slot as an explicit preference. The default choice is a real line item on the P&L.

**The scheduler should be reactive, not a fixed sawtooth calendar.** The rule:
```
next_send = last_inbound_at + 24h - SAFETY_MARGIN   (recommend 30–60 min)
if next_send falls inside the student's slot:
      send free-form (or utility template) → FREE
else:
      send utility template at slot ceiling → PAID, resets the cycle
```
This self-corrects when the student is slow to tap, and degrades to "one paid template a day" for a disengaged student — which is exactly when you want to be paying for reach anyway.

**Category discipline:** the daily Wathb message is **Utility** (an expected, transactional reminder for a service the user subscribed to), never Marketing. <cite index="6-1">Marketing templates cannot be sent inside a service window at all</cite> and are billed regardless. Renewal and win-back pushes *are* Marketing — budget and rate-limit them separately. Getting a template miscategorised at approval will silently multiply the bill; check the approved category of every template after approval, not just at submission.

**⚠️ Roadmap risk — flag to the client now:** <cite index="7-1">Meta has announced pricing updates for service and utility messages launching August 1, 2026 and October 1, 2026.</cite> The free-service-window economics this design depends on may change within weeks. Build the notification layer behind a **channel abstraction** (`NotificationChannel` interface) so WhatsApp can be swapped or supplemented with SMS or a PWA push without touching the scheduler. Do not hardcode WhatsApp anywhere above the adapter.

### 7.3 Scheduler architecture
- Per-student daily job, computed at a nightly planning pass and enqueued with a delay: `plan_day → generate_wathb → mint_magic_link → enqueue_send`.
- Idempotency key = `(student_id, date)`. A duplicate daily message is a trust-destroying bug; make it structurally impossible.
- **Store every timestamp in UTC; render in the student's tz.** Riyadh has no DST, which will lull the team into a false sense of security until the first Egyptian or Jordanian student signs up.
- Handle: student paused, subscription expired, suspended, on Friday-skip, already completed today's Wathb manually, quiet hours.
- **Retry & fallback ladder:** template fails → retry ×2 with backoff → after N consecutive undelivered days, mark the number suspect and surface it in the admin console. Undelivered notifications are the #1 support ticket in this category of product; make the delivery log a first-class admin screen.

### 7.4 Notification catalogue

| Trigger | To | Category | Content |
|---|---|---|---|
| Daily Wathb | Student | Utility (template or free-form) | 1 line + link |
| Wathb not started by slot end | Student | free-form (only if window open) | Gentle nudge — **max 1/day, never if window closed** |
| Weekly report | Student | Utility | Streak, Δ, one piece of advice + link |
| Weekly report | Supervisor | Utility | Student name, questions, Δ, strength/weakness + link |
| Streak milestone (7/30/100) | Student | free-form if window open | Celebration |
| Subscription expiring in 7d / 1d | Student + payer | Utility | Renewal link |
| Payment failed | Payer | Utility | Fix-payment link |
| Supervisor invite | Supervisor | Utility | Accept link |
| Suspension notice | User | Utility | Reason + appeal contact |

**Frequency cap:** never more than 2 messages/day to a student, never more than 1/week to a supervisor unless they opt in. The fastest way to destroy this business is a WhatsApp quality-rating downgrade from users hitting "block." Monitor the WABA quality rating as a **production alert**, not a monthly report.

**Opt-out:** every message must honour STOP/إيقاف, and opt-out must be instant and permanent per Meta policy. Store it, respect it, surface it in the admin console so support understands why a student "stopped getting messages."

---

## 8. Screen Inventory — for Claude Design

Build **mobile-first, Arabic RTL-first.** The student never sees a desktop. The admin never sees a phone. Design them as two different products.

### 8.1 Student (mobile web, opened from WhatsApp — PWA, no app store)
| # | Screen | Notes |
|---|---|---|
| S1 | Landing / packages | Public, marketing, Arabic. Price cards, 1/6/12-month toggle |
| S2 | Checkout + discount code | Mada/Apple Pay first — card-only checkout will halve conversion in KSA |
| S3 | Goal setup | Test, track, test date, target score. Progress-stepper |
| S3b | School picker | Search-as-you-type, RTL, tolerant of AR/EN and partial names. "Can't find it" → suggest. Prominent **Skip**. |
| S4 | Notification slot picker | 2-hour slots grid + timezone + skip-days |
| S5 | WhatsApp opt-in | Explicit consent copy |
| S6 | Placement Wathb intro | "15 questions, ~12 minutes, so we know where to start" |
| S7 | **Wathb question** | The hero screen. Timer ring, stem, options, progress dots. Zero chrome. |
| S8 | Wathb explanations | Per-question: your answer / correct / why. 👍👎 on explanation. Report-a-problem. |
| S9 | Wathb complete | Streak, score, one insight, weakness delta |
| S10 | My performance | The §5.2 report, student-toned |
| S11 | Weekly report | Landing target of the weekly link |
| S12 | Invite supervisor | Enter mobile, send |
| S13 | Account | Subscription, slot, pause, cancel — **step-up auth gate** |
| S14 | Expired / paused state | Renewal CTA |
| S15 | Link expired / invalid | Must be friendly and offer "send me a fresh link" — this screen will be hit constantly |

**S7 is the screen to get right.** Timer must feel like pace, not panic — a thin ring that only turns amber in the last 25%. No red until the final 5 seconds. Big tap targets. Arabic numerals per locale convention. Works on a 5-year-old Android on 3G — the whole Wathb should be delivered in one payload and answer submissions queued if the connection drops. Design an offline state.

### 8.2 Supervisor (mobile web)
| # | Screen |
|---|---|
| V1 | Dashboard — parent card view / instructor table view |
| V2 | Student report (shared component) |
| V3 | Notification preferences |
| V4 | Accept invite |

### 8.3 Admin (desktop web)
| # | Screen |
|---|---|
| A1 | Overview — active subs, MRR, Wathb completion rate, **bank health**, alert feed |
| A2 | Test & taxonomy tree editor |
| A3 | Question bank list (dense, filterable) |
| A4 | Question editor + live RTL preview |
| A5 | Bulk import wizard (parse → validate → confirm) |
| A6 | Review queue |
| A7 | Solution performance (p-value, discrimination, distractors, flags) |
| A8 | Problem-report inbox |
| A9 | Students list + student detail (performance, subs, payments, delivery log, link access log) |
| A10 | Packages |
| A11 | Discount codes + redemption report |
| A12 | Suspensions & audit log |
| A13 | Notification delivery log + WABA quality/cost dashboard |
| A14 | Advice-string library (label × band → text) |
| A15 | Admin users & roles |
| A16 | Geography overview — region → city → school rollup table |
| A17 | School detail — roster, accuracy profile vs. baseline, acquisition source |
| A18 | Cohort comparison — overlay 2–5 schools/cities by area |
| A19 | School registry admin — verify, merge duplicates, review student suggestions |

**Design system notes for Claude Design:** Arabic type is the design. Pick a real Arabic face (IBM Plex Sans Arabic, Almarai, or Tajawal) and set line-height generously — Arabic diacritics and descenders need more leading than Latin. Mirror every icon, chevron, and progress direction. Numbers, math, and charts stay LTR inside an RTL layout — this is the single most common bug in Arabic products; specify it in the component library, don't leave it to each developer. Build one `<Bidi>` primitive and use it everywhere.

---

## 9. Technical Spec — for Claude Code

### 9.1 Suggested stack
| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind (RTL plugin) | One codebase, SSR for magic-link landings, PWA for students |
| Backend | Next API routes or a separate NestJS service | Split the worker out from day one |
| DB | PostgreSQL | Relational integrity matters here; the analytics are all SQL |
| Cache/Queue | Redis + BullMQ | Scheduler, retries, idempotency keys |
| Analytics | Postgres materialised views → later ClickHouse if needed | Don't over-build at v1 |
| WhatsApp | Cloud API direct, or a BSP (360dialog / Twilio / Unifonic for KSA) | Behind a `NotificationChannel` adapter |
| Payments | Moyasar / Tap / HyperPay (Mada + Apple Pay) | Stripe alone is a mistake for KSA |
| Files | S3-compatible + CDN | Question images, geometry figures |
| Hosting | KSA/GCC region | PDPL data-residency — confirm requirement with counsel |

### 9.2 Core tables
```sql
users(id, mobile_e164 UNIQUE, name, role, locale, timezone, status, whatsapp_opt_in_at, created_at)
students(user_id PK, track, target_test_id, target_score, test_date, notif_slot_start, notif_slot_end,
         skip_days[], city_id /* fallback only, null when school known */)

regions(id, country_code, name_ar, name_en)
cities(id, region_id, name_ar, name_en, aliases[], is_active)
schools(id, city_id, name_ar, name_en, aliases[], moe_code, type, gender, stage,
        is_verified, merged_into_id, created_by, created_at)
school_enrollments(id, student_id, school_id, grade, academic_year, started_at, ended_at)
school_suggestions(id, student_id, raw_text, resolved_school_id, status, reviewed_by, reviewed_at)
supervisors(user_id PK, type)
student_supervisors(student_id, supervisor_id, accepted_at, revoked_at)

tests(id, name_ar, name_en, is_active)
sections(id, test_id, name_ar, name_en, weight, sort)
areas(id, section_id, name_ar, name_en, applies_to_tracks[], sort)
labels(id, area_id, name_ar, name_en, default_time_limit_s, sort)

passages(id, label_id, body, status)
questions(id, label_id, area_id, section_id, test_id, passage_id, type, difficulty,
          time_limit_s, status, source, current_version_id, stem_hash, created_by)
question_versions(id, question_id, version, stem, stem_image_url, options JSONB,
                  correct_key, explanation, created_at, created_by)

packages(id, name_ar, name_en, test_ids[], duration_months, price_halalas, questions_per_day,
         is_active, visibility)
subscriptions(id, student_id, package_id, price_snapshot, starts_at, ends_at, status,
              discount_code_id, payment_ref)
discount_codes(id, code UNIQUE, type, value, max_redemptions, redemptions_used,
               per_user_limit, valid_from, valid_to, package_ids[], owner_label,
               attributes_school_id, attributes_city_id)  -- auto-attribution, no onboarding step
redemptions(id, code_id, student_id, subscription_id, redeemed_at)

wathbs(id, student_id, scheduled_for, bundle_type, status, delivered_at, opened_at,
       completed_at, magic_link_id)
wathb_questions(wathb_id, question_version_id, position)
answers(id, wathb_id, student_id, question_version_id, label_id, selected_key,
        is_correct, time_taken_ms, timed_out, is_review, answered_at,
        school_id, city_id, region_id)   -- SNAPSHOT at answer time, resolved from the
                                         -- enrollment active on answered_at. Do NOT join
                                         -- live to school_enrollments in reports: a transfer
                                         -- would retroactively rewrite last term's numbers.

magic_links(id, token_hash UNIQUE, subject_id, subject_type, purpose, target_id,
            expires_at, max_uses, uses, revoked_at)
magic_link_access(id, magic_link_id, ip, user_agent, accessed_at)

notifications(id, user_id, kind, channel, template_name, category, wa_message_id,
              scheduled_for, sent_at, delivered_at, read_at, replied_at,
              was_billable, cost_estimate, status, error)
wa_sessions(user_id, window_opened_at, window_expires_at, last_inbound_at)

student_label_stats(student_id, label_id, n_answered, n_correct, accuracy,
                    mean_time_ms, difficulty_level, last_served_at)  -- materialised, refreshed on answer
question_stats(question_version_id, n_served, n_correct, p_value, discrimination,
               mean_time_ms, timeout_rate, distractor_dist JSONB)   -- nightly job

cohort_label_stats(cohort_type, cohort_id, label_id, n_students, n_answered, n_correct,
                   accuracy, mean_time_ms, period)  -- materialised nightly;
                   -- cohort_type ∈ {school, city, region, discount_code, package, platform}
                   -- one table serves every cohort view in §4.8

audit_log(id, actor_id, action, entity_type, entity_id, before JSONB, after JSONB, at)
```

`student_label_stats` is the table the selection engine reads on every bundle generation. Keep it denormalised and updated on answer write — do not compute accuracy from `answers` at request time.

### 9.3 Key API surface
```
POST /api/auth/magic/:token            → exchange for scoped session
POST /api/auth/otp/request|verify      → step-up for sensitive actions

GET  /api/wathb/today                  → bundle (scoped session, purpose=wathb)
POST /api/wathb/:id/answer             → { question_version_id, key, time_taken_ms } — per question, not batched
POST /api/wathb/:id/complete           → returns explanations + deltas
POST /api/questions/:id/report         → student problem flag

GET  /api/report/student/:id           → shared by student/supervisor/admin, role-scoped
GET  /api/report/weekly/:id
GET  /api/report/cohort?type=school|city|region&id=...   → ADMIN ONLY. Same shape as the
                                        student report with the aggregation key swapped.
                                        Returns 403 for student/supervisor roles — enforce
                                        in the query layer, not the controller.

GET  /api/schools/search?q=             → public autocomplete, canonical rows only
POST /api/schools/suggest               → student-submitted → admin review queue
GET  /api/admin/schools                 → registry
POST /api/admin/schools/:id/merge       → { into_id } repoints enrollments + answer snapshots
POST /api/admin/schools/:id/verify

POST /api/admin/questions/import       → multipart, returns validation report
POST /api/admin/questions/import/:job/commit
GET  /api/admin/bank-health
GET  /api/admin/question-stats
POST /api/admin/users/:id/suspend

POST /webhooks/whatsapp                → inbound + status callbacks (opens wa_session)
POST /webhooks/payments
```

### 9.4 Background jobs
| Job | Cadence | Purpose |
|---|---|---|
| `plan_day` | 03:00 per tz | Generate tomorrow's Wathb per active student, mint links, enqueue sends |
| `send_notification` | scheduled | Chooses template vs. free-form based on `wa_sessions` |
| `nudge` | slot end | One nudge, only if window open |
| `weekly_report` | weekly per user | Student + supervisor |
| `refresh_question_stats` | nightly | p-value, discrimination, distractors |
| `bank_health_check` | nightly | Coverage per label → admin alerts |
| `refresh_cohort_stats` | nightly | Rebuild `cohort_label_stats` for every cohort above the floor |
| `expire_links` | hourly | |
| `subscription_lifecycle` | hourly | Expiry warnings, grace, deactivation |

### 9.5 Non-functional
- **Locale:** every user-facing string in `ar` + `en` from day one. RTL is not a theme, it's the default layout direction.
- **Performance budget:** Wathb question screen interactive in < 1.5s on 3G. Bundle payload < 150KB excluding images. Question images pre-optimised to WebP at build/upload.
- **Accessibility:** the timer must not be the only signal (screen-reader announcements at 50%/25%). Min contrast AA. Large tap targets.
- **Timer integrity:** authoritative timing is **server-side** (`served_at` → `answered_at`). The client timer is UI only. Otherwise the first clever student will freeze it with devtools, and your difficulty data becomes garbage.
- **Privacy/PDPL:** students are minors. Explicit guardian consent, data-minimisation, an export/delete path, and a defined retention period. Get this reviewed by counsel before launch, not after.
- **Rate limiting** on magic-link exchange (brute force), OTP, and report-a-problem.

---

## 10. Open Questions to Settle Before Build

These are decisions the spec cannot make for you. Each one changes the code.

1. **Auto-renew or manual renewal?** Determines the payments integration and the entire lifecycle job.
2. **Who pays — student or parent?** The described flow has the student subscribing, but a 16-year-old doesn't own a Mada card. A "supervisor pays, student practises" flow may be the *primary* one, not an edge case. This affects onboarding order fundamentally.
3. **What happens on a missed day?** Does the Wathb roll over, stack, or vanish? Vanishing protects the streak mechanic and the bank; stacking destroys both. Recommend: vanish, streak breaks, questions return to the pool.
4. **Can a student ask for extra practice on demand?** Strong retention feature, but it breaks the daily cost model and the yearly bank projection. If yes, cap it and make the on-demand link student-initiated (which conveniently opens a free window).
5. **Skip and back — allowed?** Recommend no for both.
6. **Passage bundles** — own Wathb, or mixed? Recommend own.
7. **Composite score** — is there a single headline number (an estimated GAT score)? Parents will demand one. Predicting an actual Qiyas score from practice accuracy is a **claim you must be able to defend**; if you publish "Estimated score: 82," you own that promise. Recommend a percentile-against-cohort or a neutral index instead, at least until you have real outcome data to calibrate against.
8. **Content origin.** Where do 3,000+ questions come from? Authored, licensed, or scraped? Scraped Qiyas material is both a legal risk and a quality risk. The bank *is* the product — budget for it as the largest line item, not as data entry.
9. **Cohort size vs. discrimination index.** Item statistics need volume. With 50 students, question analytics are noise. Set the minimum-n threshold and hide the metrics below it.
10. **Data residency** — KSA region required, or GCC acceptable?
11. **Where does the school registry come from?** Is the Ministry of Education school list obtainable as data, or does the registry get built organically from student suggestions? This is the difference between clean cohort analytics in month one and a merge backlog in month six. Answer before Phase 1.
12. **Is school data justified under PDPL?** It is not strictly necessary to deliver daily practice, which weakens the legal basis for collecting it about minors. Optional + skippable + honest purpose statement is the defensible position. Confirm with counsel alongside the §9.5 review.
13. **B2B or not?** If schools buying seats is on the roadmap, that changes onboarding (bulk invite, roster import, no individual checkout), pricing, and the WhatsApp cost model materially. Decide the *direction* now even if you build it later — it's cheap to leave the door open and expensive to knock it through afterwards.

---

## 11. Build Sequence

**Phase 0 — Foundations (weeks 1–3)**
Taxonomy + question bank + question editor + bulk import. *Nothing else matters if the admin can't load 3,000 questions.* Build this first and start content production in parallel with the rest of the build.

**Phase 1 — The loop (weeks 4–7)**
Magic links, Wathb generation (uniform random at first), question screen, timer, explanations, answer persistence. Manually trigger sends. Prove the core experience works on a real phone in a real hand.

**Phase 2 — Intelligence (weeks 8–10)**
`student_label_stats`, the weighted selection engine, placement Wathb, the student report. **Build the report against a cohort filter, not a `student_id`** (§4.8) — this is the one decision that makes school/city analytics nearly free in Phase 6 instead of a rewrite.

*Also in Phase 0:* seed `regions` and `cities`, and stand up the `schools` registry + autocomplete. It's a day of work early and a migration later.

**Phase 3 — Delivery (weeks 11–13)**
WhatsApp integration, template approvals, the reactive scheduler, `wa_sessions`, delivery log, cost dashboard. Budget more time than feels reasonable — template approval is an external dependency with its own queue and its own opinions.

**Phase 4 — Money (weeks 14–16)**
Packages, checkout, Mada/Apple Pay, discount codes, subscription lifecycle, VAT/ZATCA invoicing.

**Phase 5 — Stakeholders (weeks 17–18)**
Supervisor dashboards, weekly reports, invites.

**Phase 6 — Operations (weeks 19–20)**
Solution performance analytics, bank health, problem-report inbox, suspensions, audit log, advice library, **cohort analytics by school/city/region (§4.8) + school registry merge tooling**.

> Phases 3 and 4 are where external dependencies live (Meta template approval, payment gateway onboarding, ZATCA). Start those applications during Phase 0 — the paperwork is slower than the code.

---

## 12. How to Use This Document

**For Claude Design:** work from §8. Start with S7 (Wathb question), S10 (performance report), and A3/A4 (question bank + editor) — these three carry the product. Give it §3 for the taxonomy vocabulary and the Arabic/RTL notes at the end of §8.3 as hard constraints.

**For Claude Code:** work from §9. Build Phase 0 first (§11). Give it §3 for the domain model, §6.4 for the selection engine (it is specified precisely enough to implement and test directly), and §7 for the notification service. §7.2 in particular should be read before a single line of the scheduler is written.
