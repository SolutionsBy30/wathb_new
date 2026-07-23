% Software Requirements Specification — Wathb Daily Practice Platform
% Prepared from the Wathb prototype (Student, Supervisor & Admin web apps) and the product build spec
% Version 1.1 — Draft

---

# 1. Introduction

## 1.1 Purpose

This Software Requirements Specification (SRS) defines the functional and non-functional requirements of **Wathb** (وثب), a subscription platform that delivers a small daily bundle of standardized-test practice questions to a student over WhatsApp, adapts each day's bundle toward the student's measured weak areas, and reports progress to parents, instructors, and administrators.

The document is derived from a working, Arabic-first, right-to-left (RTL) prototype comprising a public landing site, passwordless student login, a student practice app, a supervisor console, and a full administrator console, together with the product build specification that accompanies them. It is intended to be complete enough to guide implementation, testing, and acceptance.

## 1.2 Product scope

Wathb serves the Saudi standardized-test market. The prototype ships two tests — **Qiyas GAT / Qudurat (قدرات)** and **Tahsili (تحصيلي)** — but the taxonomy, question bank, packages, and reporting are data-driven so additional tests can be added by an administrator without code changes.

The core value loop is:

> A student receives a daily WhatsApp message → taps a passwordless link → answers a short, per-question-timed bundle of questions (a *Wathb*) → sees explanations immediately after the bundle → performance updates the student's strength/weakness profile → the next day's bundle is re-weighted → weekly reports are sent to the student and any linked supervisor.

The volume target is roughly 1,000–3,000 unique questions answered per student per year (about five per day), which sets hard requirements on question-bank size, the anti-repetition logic of the selection engine, and administrator tooling for content health.

## 1.3 Definitions, acronyms, and abbreviations

| Term | Meaning |
|---|---|
| **Wathb (وثب / وثبة)** | A single daily bundle/session of practice questions. Also the product name; UI copy distinguishes "today's Wathb". |
| **Qudurat / GAT** | Qiyas General Aptitude Test (اختبار القدرات). Sections: Verbal (لفظي), Quantitative (كمي). |
| **Tahsili** | Qiyas achievement test (اختبار التحصيلي). Sections in the prototype: Science, Common. |
| **Section → Area → Label** | The three-level content taxonomy under a Test that makes the strength/weakness report meaningful. |
| **Supervisor** | A parent or tutor who monitors one or more linked students (read-only), distinguished only by a relationship type. |
| **Magic link** | A single-purpose, passwordless, capability-scoped URL delivered by WhatsApp that grants access to one specific action (a Wathb, a report, a renewal). |
| **PDPL** | Saudi Personal Data Protection Law. |
| **ZATCA / Fatoora** | Saudi tax authority e-invoicing regime; 15% VAT applies. |
| **RTL / Bidi** | Right-to-left / bidirectional layout. Numbers, math, and charts render LTR inside an RTL layout. |
| **WABA** | WhatsApp Business Account. |

### 1.3.1 Performance metrics — plain-language Arabic definitions

The following three metrics appear throughout the administrator, supervisor, and student interfaces. Because the audience includes parents, tutors, and content authors with no statistical background, the UI shall use the plain-language Arabic wording below rather than the technical English term.

**p-value → «نسبة الإجابة الصحيحة» (مؤشر سهولة السؤال)**

> النسبة المئوية للطلاب الذين أجابوا على السؤال إجابةً صحيحة.
> ببساطة: كم طالباً من كل مئة حلّوا هذا السؤال صح؟
> كلما ارتفعت النسبة كان السؤال **أسهل**، وكلما انخفضت كان **أصعب**.
> مثال: نسبة 90% تعني أن السؤال سهل جداً ولا يفرّق بين الطلاب، ونسبة 10% تعني أنه صعب جداً أو أن صياغته غير واضحة.
> النطاق الصحّي المفضّل: بين 30% و85% تقريباً.

**Discrimination index → «مؤشر التمييز» (قدرة السؤال على التفريق بين المستويات)**

> يقيس ما إذا كان الطلاب المتفوقون يجيبون على هذا السؤال بشكل صحيح أكثر من الطلاب الأقل مستوى.
> ببساطة: هل هذا السؤال يميّز الطالب القوي من الضعيف فعلاً؟
> • **قيمة موجبة مرتفعة** = سؤال جيد؛ المتفوقون يحلّونه والضعاف يخطئون فيه.
> • **قيمة قريبة من الصفر** = السؤال لا يفرّق بين المستويات؛ لا يضيف معلومة عن الطالب.
> • **قيمة سالبة** = إشارة خطر؛ الطلاب الأقوى يخطئون فيه أكثر من الضعاف، وهذا غالباً يعني أن **مفتاح الإجابة خاطئ** أو أن صياغة السؤال مربكة، ويجب مراجعته فوراً.

**Composite index → «المؤشر المركّب» (المستوى العام للطالب)**

> رقم واحد يلخّص مستوى الطالب العام، ويُحسب بدمج دقّته في جميع المجالات مع وزن كل مجال في الاختبار.
> ببساطة: لو أردنا وصف مستوى الطالب برقم واحد، فهذا هو الرقم.
> فائدته أنه يجيب على سؤال ولي الأمر الأهم: **هل المستوى يتحسّن أم يتراجع؟** — ولذلك يُعرض دائماً مصحوباً بمقدار التغيّر عن الأسبوع الماضي (↑ أو ↓).
> ملاحظة مهمة: المؤشر المركّب **ليس** درجة قياس متوقّعة، وإنما مقياس داخلي لتتبّع التقدّم.

## 1.4 Intended audience

Product managers, UX/UI designers, front-end and back-end engineers, QA engineers, data/analytics engineers, DevOps, and the compliance/legal reviewers responsible for PDPL and ZATCA obligations.

## 1.5 References

- Wathb product build specification (`wathb-product-spec.md`) — domain model, selection engine, notification engine, screen inventory, technical stack.
- Prototype source: `Landing.dc.html`, `Student Login.dc.html`, `Admin Login.dc.html`, `Student.dc.html`, `Supervisor.dc.html`, `Admin.dc.html`, `wathb-data.js` (seed data), `support.js` (runtime).

---

# 2. Overall Description

## 2.1 Product perspective

Wathb is a new, self-contained system organized into three role-specific front ends over a shared back end and data model:

1. **Student app** — responsive web / PWA, opened primarily from a WhatsApp link on mobile.
2. **Supervisor console** — responsive web, read-only, scaled for both a parent with a few students and a tutor with dozens.
3. **Administrator console** — desktop web, the content, analytics, and operations cockpit.

A **WhatsApp notification and magic-link engine** is the operational heart connecting the system to users. All three front ends share one reporting component (the student report), rendered with a different aggregation scope per role.

## 2.2 Product functions (summary)

- Public marketing/landing site with package and pricing display.
- Self-service signup and passwordless login for **both students and supervisors**, by mobile number + one-time passcode (OTP), with package selection and checkout for students.
- **A free, feature-limited package** alongside the paid packages.
- The daily Wathb loop: test selection, per-question timed answering with no back/skip, immediate post-bundle explanations, and completion feedback.
- **No question is ever repeated within a single Wathb**, and a question already answered is not served again to the same student except as a deliberately scheduled spaced-review item.
- **Each Wathb concentrates on one section at a time** (for example Verbal *or* Quantitative) and weights its questions toward the student's weakest labels **within that section**, so a bundle produces a focused, coherent practice session rather than a scattered mix.
- Adaptive, weakness-weighted question selection with anti-repetition and exploration guarantees.
- Student self-service: performance dashboard, subscription management, test activation, supervisor invitations, and notification-window settings.
- Supervisor dashboards, shared student report, notification preferences, and invite acceptance.
- Administrator content tooling: test/taxonomy tree editor, question bank + editor, guided bulk Excel import, and review workflow.
- Administrator analytics: platform overview with alerts, solution/question-quality analytics, per-student reports, and cohort analytics by school/city/region.
- Administrator business tooling: packages, pricing, subscriptions, manual activation for wire transfers, and invoicing.
- Administrator operations: notification/delivery log, manual and bulk messaging, geography registry management, and (per spec) suspension, audit log, and school-registry maintenance.

## 2.3 User classes and characteristics

| User class | Device | Access model | Characteristics |
|---|---|---|---|
| **Student** | Mobile / desktop | Passwordless OTP + scoped magic links | A minor in most cases; short attention; Arabic-first. |
| **Supervisor — Parent (ولي أمر)** | Mobile / desktop | Passwordless OTP + scoped magic links | Typically a few students; limited attention; wants "is it working?". |
| **Supervisor — Instructor (مشرف)** | Mobile / desktop | Passwordless OTP + scoped magic links | Potentially dozens of students; needs triage and sorting. |
| **Administrator** | Desktop | Email + password | Power user; spends most time in the question bank. |
| **Support sub-role (per spec)** | Desktop | Email + password | View-only + resend link + extend subscription; no destructive powers. |

Parent and Instructor are the same role with the same permissions and the same interface; they differ only by a stored **relationship type** (ولي أمر / مشرف) used for labeling and message wording. A student may have multiple supervisors and a supervisor may have multiple students (many-to-many). Linking is initiated by student invitation and is explicitly consented and revocable by the student.

## 2.4 Operating environment

- **Student & Supervisor:** web, used mostly on mobile but fully usable on desktop — **responsive design is required** — Arabic RTL.
- **Administrator:** desktop web browser, Arabic RTL.
- **Messaging channel:** WhatsApp Business via the **Meta Cloud API**, accessed behind a channel abstraction.
- **Payments:** **Paymob**, plus **manual wire transfer** activated by an administrator.
- **Suggested stack (from spec):** Next.js + TypeScript + Tailwind (RTL) front end; Node/NestJS worker; PostgreSQL; Redis + BullMQ for scheduling/queues; S3-compatible storage + CDN for images; hosting in a KSA/GCC region for data residency.

## 2.5 Design and implementation constraints

- **Arabic RTL is the default layout direction, not a theme.** Content language follows the test's configured language (§3.6).
- **Bidi rule:** numbers, math, currency, and charts render LTR inside RTL text. A shared `<Bidi>` primitive is required.
- **Server-authoritative timing.** The client countdown is UI only; authoritative question timing is measured server-side (served-at → answered-at).
- **Statistical-honesty threshold** for per-area reporting is enforced in the reporting layer, not the UI: no per-area percentage renders below the minimum answer sample.
- **Compliance:** PDPL (minors' data, guardian consent, data minimization, export/delete, retention); ZATCA/Fatoora e-invoicing with 15% VAT, **implemented behind an activation switch** so the platform can operate with internally generated invoices until ZATCA integration is switched on; Meta/WhatsApp template, category, and opt-out policies.
- **Cohort analytics are admin-only** and must be enforced at the query layer, never exposed to student/supervisor roles, and never used to rank schools.

## 2.6 Assumptions and dependencies

- WhatsApp remains the primary delivery channel; Meta pricing/window rules apply and may change (announced updates for Aug 1 2026 and Oct 1 2026), so the notification layer is built behind an adapter.
- A sufficiently large, original question bank is sourced and maintained; the bank is treated as the largest product cost.
- The canonical school/city/region registry is seeded and maintained by administrators.
- Several product decisions are open (see §9) and affect implementation: renewal model, who pays, missed-day behavior, and whether a headline "estimated score" is published.

---

# 3. Functional Requirements

Requirements are grouped by module and identified as `MODULE-nnn`. "Prototype" marks behavior demonstrated in the current build; "Spec" marks behavior defined in the build specification for the full product. Unless noted, requirements are mandatory.

## 3.1 Public site, signup & onboarding (prefix ONB)

**ONB-001** The system shall present a public, Arabic RTL landing page describing the product with sections for features (المميزات) and pricing (الأسعار). *(Prototype)*

**ONB-002** The landing page shall offer three role entry points: student login/register (دخول / تسجيل الطالب), supervisor/guardian login (دخول ولي الأمر / المشرف), and admin login (دخول الإدارة). *(Prototype)*

**ONB-003** The landing page shall display active packages as price cards showing name, price in SAR, and duration in months, including the free package. *(Prototype)*

**ONB-004** The system shall provide **self-service signup for both students and supervisors**. A supervisor may register independently, without waiting for a student invitation, and then link to a student.

**ONB-005** The system shall authenticate both students and supervisors passwordlessly by Saudi mobile number (default country code +966) plus an OTP verification code, with client-side validation of the mobile number and a resend/edit-number affordance. *(Prototype: student)*

**ONB-006** On successful OTP verification, if a student has no active subscription, the system shall require package selection — free or paid — before proceeding. *(Prototype)*

**ONB-007** The system shall accept payment via card / Mada through **Paymob** during onboarding, validate card entry, and confirm successful subscription. *(Prototype: card/Mada; Spec: Paymob integration)*

**ONB-008** The system shall additionally support **wire (bank) transfer** as a payment method: the student selects wire transfer, receives the transfer instructions and a reference, and the subscription remains pending until an administrator confirms receipt and activates the account manually (§3.12).

**ONB-009 (Spec)** Onboarding shall capture explicit, timestamped WhatsApp opt-in consent and store the consent artifact, as required by Meta policy and PDPL.

**ONB-010 (Spec)** Onboarding shall capture the student goal: target test, test date, and target score.

**ONB-011 (Spec)** Onboarding shall offer an optional, one-tap-skippable school picker with search-as-you-type against the canonical registry, deriving city and region from the selected school; a "can't find my school" path shall submit a suggestion to an admin review queue rather than writing directly to the registry.

**ONB-012 (Spec)** Onboarding shall present a notification-window slot picker (2-hour slots), timezone (default Asia/Riyadh), and a configurable skip-days toggle. This step shall be hidden or disabled for free-package students, who receive no daily notification (§3.13).

**ONB-013 (Spec)** Onboarding shall run a placement Wathb (10–15 questions spread across areas) to seed the initial weakness profile, and shall optionally prompt to invite a supervisor.

**ONB-014** The system shall support a configurable **default OTP fallback value (`1928`)** used when the WhatsApp channel is not yet configured or is unavailable, so that signup, login, and testing can proceed. This fallback shall be controlled by an environment/configuration flag, shall be recorded in the audit log whenever used, and **shall be disabled automatically once the WhatsApp channel is live in production** (see NFR-005a).

## 3.2 Student — the daily Wathb loop (prefix STU)

**STU-001** The student home screen shall show the current Wathb streak (سلسلة الوثبات), lifetime totals (total answered, correct, wrong), and this-week progress, and shall present today's Wathb or, when already completed, a message that a new Wathb arrives tomorrow. *(Prototype)*

**STU-002** The student shall be able to choose which test the Wathb draws from (Qudurat / Tahsili) among the tests the student has activated, and — subject to package limits — start an additional practice Wathb. *(Prototype)*

**STU-003** Each question shall display the stem, four/five answer options, a progress indicator, and a visible circular per-question countdown timer. *(Prototype)*

**STU-004** The per-question time limit shall be determined by the question, falling back to the label/section/global default. The timer shall change to an alert color in the final seconds (≤10s in the prototype). *(Prototype)*

**STU-005** On timer expiry the question shall auto-submit as *timed out* and advance; the student shall not be able to pause, go back, or skip within a bundle. *(Prototype; no-back/no-skip per Spec recommendation)*

**STU-006** Correctness shall not be revealed during the bundle. *(Prototype)*

**STU-007** **No question shall appear more than once within the same Wathb.** The bundle is assembled from distinct questions, and a question the student has already answered shall not be served again except as a deliberately scheduled spaced-review item (§3.15).

**STU-008** **Each Wathb shall be drawn from a single section** of the selected test (for example Verbal or Quantitative), and shall concentrate on the student's weakest labels within that section, so the session is focused rather than mixed across sections. The section chosen for a given day is determined by the selection engine (§3.15).

**STU-009 (Spec)** Answers shall be persisted server-side per question (not batched at the end) so an interruption can resume; after a defined idle window (recommended 30 minutes) the Wathb is closed as partial and only answered questions count.

**STU-010** After the final question, the system shall present a per-question review screen showing, for each question: the student's answer, the correct answer, and the mandatory explanation. *(Prototype)*

**STU-011** The review screen shall show, per question, the student's time versus the cohort average time, and the cohort's accuracy for that question. *(Prototype)*

**STU-012 (Spec)** The review screen shall allow a one-tap 👍/👎 rating of each explanation and a "report a problem" action that routes the flag, with the student's answer attached, to an admin inbox.

**STU-013** On completion the system shall show a summary (e.g., "clean Wathb"), update the streak, and present per-label performance for the bundle compared to the student's previous performance (delta). *(Prototype)*

## 3.3 Student — performance dashboard & profile (prefix STU)

**STU-020** The student dashboard shall let the student pick an activated test and view, for it: accuracy (الدقة), mean time (متوسط الوقت), covered areas (المجالات المشمولة), and a Wathb history log (سجل الوثبات) with per-Wathb question review. *(Prototype)*

**STU-021** The performance analysis view shall include: accuracy by area (الدقة حسب المجال) as an RTL horizontal bar chart; an 8-week composite-index trend line; a consistency heatmap of daily Wathb completion; speed versus target per area; and a sample of recent mistakes with explanations. *(Prototype)*

**STU-022** The system shall not render a percentage for any area with fewer than the minimum sample of answers (MIN_SAMPLE = 20); instead it shall show a "collecting data — X of 20" state. *(Prototype)*

**STU-023 (Spec)** The student report shall include rule-based coaching advice keyed on (label × accuracy band × speed band) drawn from an admin-editable advice library.

**STU-024** The profile/account area shall show the current subscription (package, price, renewal date, status) and allow renewal, package selection, and payment with confirmation. *(Prototype)*

**STU-025** The profile shall let the student activate/deactivate the tests included in the plan (تفعيل الاختبارات). *(Prototype)*

**STU-026** The profile shall list linked supervisors with their relationship type, allow the student to revoke a supervisor's access (إلغاء الوصول), and allow the student to invite a new supervisor by mobile number, selecting the relationship type (ولي أمر / مشرف), with confirmation that the invite was sent. *(Prototype)*

**STU-027** When a student invites a supervisor whose mobile number is **not yet registered**, the system shall send that number a WhatsApp **invitation message** containing a magic link that leads to supervisor signup and, on completion, automatically establishes the pending link. If the number is already registered, the invitation appears as a pending invite in that supervisor's console (§3.4).

**STU-028** The profile shall let the student configure notification settings: the daily Wathb send time/window, the weekly report day, and the weekly report time, with save confirmation. *(Prototype)*

**STU-029 (Spec)** Sensitive account actions (mobile-number change, subscription cancellation, viewing payment history) shall require step-up authentication via a fresh OTP.

**STU-030 (Spec)** The system shall present friendly expired/paused states with a renewal CTA, and a friendly "link expired/invalid" screen offering "send me a fresh link".

## 3.4 Supervisor console (prefix SUP)

**SUP-001** The supervisor console shall be read-only with respect to student performance data. *(Prototype)*

**SUP-002** Parents and tutors shall use the **same console with the same capabilities**; the system shall store a **relationship type** (ولي أمر / مشرف) per student–supervisor link, used for display labels and message wording only, not for permissions.

**SUP-003** The console shall present each linked student with streak, questions answered this week versus target, composite-index trend arrow, top strength, top weakness, and next-test countdown. The presentation shall adapt to the number of linked students — a card layout for a few students and a sortable, filterable table for many — defaulting to a "needs attention" ordering, with each entry opening the full student report. *(Prototype)*

**SUP-004** The supervisor shall be able to open the shared **student report** (§3.3) for any linked student, including total/correct/wrong, accuracy by area, 8-week composite trend, speed versus target, consistency, a sample of recent mistakes, and coach advice. *(Prototype)*

**SUP-005** The student report rendered to a supervisor shall obey the same MIN_SAMPLE = 20 suppression as the student view. *(Prototype)*

**SUP-006** The supervisor shall be able to set notification preferences: weekly report day, send time, and a mute toggle, with save confirmation. *(Prototype)*

**SUP-007** The supervisor shall be able to view and act on a pending student link-invitation (accept / reject), with confirmation. *(Prototype)*

**SUP-008 (Spec)** A supervisor shall be able to pay on behalf of a student; the payer relationship shall be supported in subscription and payment flows.

## 3.5 Administrator — overview & alerts (prefix ADM)

**ADM-001** The admin console shall present an overview (نظرة عامة) with headline KPIs: active subscriptions, monthly recurring revenue (SAR), Wathb completion rate, and a bank-health score. *(Prototype)*

**ADM-002** The overview shall present an alerts feed covering at minimum: labels approaching content exhaustion, questions with a negative discrimination index (possible wrong key), non-discriminating questions (correct-answer rate at extremes), and magic-link sharing anomalies flagged for human review. *(Prototype)*

**ADM-003** The admin console shall provide grouped navigation: Overview; Content (test & taxonomy, question bank, question performance); Users (students, supervisors, geography & schools); Business (subscriptions, packages); System (notification log). *(Prototype)*

## 3.6 Administrator — test & taxonomy builder (prefix ADM)

**ADM-010** The admin shall manage a tree of Test → Section → Area → Label, with actions to add a test, add a section, add an area, and add a label, and to expand/collapse nodes. *(Prototype)*

**ADM-011** The admin shall set a default per-node time limit (المهلة الافتراضية) that is inherited down the tree, and shall be able to override the time limit at the question level. *(Prototype)*

**ADM-012** Each **test shall carry a language setting** chosen at creation. All naming and content beneath that test — sections, areas, labels, question stems, options, and explanations — shall be authored and displayed in the test's language, and the interface shall apply the matching text direction (RTL for Arabic, LTR for English). A single test does not mix languages for its taxonomy names; a separate test is created for a different language.

**ADM-013 (Spec)** Nodes shall support a composite-index weight, drag-to-reorder, and soft-delete/retire (a label with attached questions cannot be hard-deleted; its questions must be reassigned or retired with it, stated explicitly in the UI).

## 3.7 Administrator — question bank & editor (prefix ADM)

**ADM-020** The question bank shall present a dense, filterable table with filters for test, label (كل التصنيفات), and status (published / in_review / draft), showing per row the question code, difficulty, times served, correct-answer rate, and status. *(Prototype)*

**ADM-021** The question editor shall provide fields for stem, answer options, correct key, difficulty (1–5), and explanation, alongside a live RTL student-eye preview. *(Prototype)*

**ADM-022** The explanation field shall be a hard validation: a question cannot be published without an explanation ("الشرح إلزامي قبل النشر"). *(Prototype)*

**ADM-023** The admin shall be able to create a new question and to edit an existing one from the bank. *(Prototype)*

**ADM-024 (Spec)** Editing a published question shall create a new version; historical answers shall remain bound to the version answered, so analytics do not silently change meaning.

**ADM-025 (Spec)** On save and on import, the system shall hash the normalized stem and fuzzy-match against the bank to detect duplicates.

**ADM-026 (Spec)** A bank-health widget shall compute, per label, published-question coverage against the per-day plan and flag thin labels (months-of-runway) in red. *(Prototype: `bankHealth` dataset drives the overview alert.)*

**ADM-027 (Spec)** A review queue shall list `in_review` questions for a second reviewer to approve/reject with a comment.

## 3.8 Administrator — bulk import (prefix ADM)

**ADM-030** The bulk import shall be **destination-first**: before uploading, the administrator selects the target **Test → Section → Area → Label** in the wizard. Every question in the uploaded file is imported into that selected destination. *(Revised)*

**ADM-031** Because the destination is chosen in the wizard, the Excel template shall **not** contain test, section, area, or label columns. It shall carry only the per-question fields: stem, options, correct key, explanation, difficulty, and optional time limit. This keeps the template narrow and removes the most common source of import error (mistyped or mismatched taxonomy names). *(Revised)*

**ADM-032** The import wizard shall offer a downloadable blank template matching the selected destination and a drag-and-drop / file-picker upload. *(Prototype)*

**ADM-033** The import shall run as **select destination → parse → validate → confirm**, presenting a per-row validation report (row number, question text, status/error) before committing, with an option to upload another file. *(Prototype/Revised)*

**ADM-034 (Spec)** The import shall never partial-commit a bad file; per-row errors (missing correct answer, missing explanation, duplicate stem hash) must be fixable before commit.

## 3.9 Administrator — solution/question performance analytics (prefix ADM)

**ADM-040** The question-performance view shall list questions sortable by: flagged-first, correct-answer rate (hardest first), discrimination (weakest first), and times served. *(Prototype)*

**ADM-041** Per question, the view shall display the correct-answer rate, the discrimination index, mean time, and the option-choice distribution (distractor analysis), with the correct option marked. *(Prototype)*

**ADM-042** A question analysis/detail view shall show the discrimination index with a plain-language explanation of its meaning (§1.3.1), the full answer distribution, explanation-helpfulness counts (👍/👎), the count of problem reports, a correct-answer-rate history chart over time, and a list of students who answered (student, result, time taken, date). *(Prototype)*

**ADM-043** Each analytics row shall offer a direct action to edit the question. *(Prototype: edit; Spec: also retire / dismiss-flag.)*

**ADM-044 (Spec)** Student-submitted problem reports shall land in an admin inbox with the question and the student's answer attached.

## 3.10 Administrator — students & student detail (prefix ADM)

**ADM-050** The students list shall be filterable by school and city and sortable by name, subscription end date, and performance (composite index), showing per row name, school, composite index, streak, completed questions, and subscription end date. *(Prototype)*

**ADM-051** From the list, the admin shall open a student detail that renders the shared **student report** (accuracy by area, composite trend, speed, consistency, recent mistakes, advice). *(Prototype)*

**ADM-052 (Spec)** The admin student detail shall additionally show subscription history, payment history, notification-delivery log, session-by-session raw answers, and device/link access log, for support and abuse investigation.

## 3.11 Administrator — geography, schools & cohort analytics (prefix ADM)

**ADM-060** The geography view shall present a region → city → school rollup, filterable by school and city, with columns for number of students, completion rate, accuracy, average streak, top performer, and delta versus the platform mean. *(Prototype)*

**ADM-061** A school-detail view shall present the student roster (highest performers first) with grade, and the school's accuracy-by-area profile versus the relevant baseline. *(Prototype)*

**ADM-062** The system shall provide a school/city comparison view overlaying accuracy-by-area profiles for multiple schools. *(Prototype)*

**ADM-063** The administrator shall be able to **manage the geography registry directly**: create, rename, edit, activate/deactivate, and delete **regions** and **cities**, and assign each city to its region. Cities shall support alias entries so that variant spellings (for example Dammam / الدمام / Ad-Dammam) resolve to a single canonical row.

**ADM-064** The administrator shall be able to manage the **school registry**: create and edit schools, assign each to a city, verify a school, merge duplicate schools (repointing enrollments and answer snapshots rather than orphaning them), and review student-suggested schools before they enter the canonical registry.

**ADM-065 (Spec)** Cohort analytics shall be admin-only, enforced at the query layer (403 for student/supervisor roles), shall never rank schools, and shall be labeled as measuring subscribed students at a school (selection-bias caveat), never the school itself.

**ADM-066 (Spec)** The reporting layer shall accept a cohort filter (`student_id | school_id | city_id | region_id | discount_code_id | package_id | cohort_month`) so every report and cohort view is one parameterized query.

## 3.12 Administrator — subscriptions, packages & invoicing (prefix ADM)

**ADM-070** The subscriptions view shall list student subscriptions with status (active / pending / suspended), package, price, and renewal date. *(Prototype)*

**ADM-071** The packages view shall provide CRUD over packages, showing per package the subscriber count, revenue (SAR), market share, included tests, **duration in months**, price, and active state, with the ability to toggle a package active/inactive. *(Prototype/Revised)*

**ADM-072 (Spec)** Package fields shall include name, included tests, **duration in months**, price in SAR, questions-per-day, active flag, visibility (public / link-only), and the feature-limit flags that define the free tier (§3.13).

**ADM-073** The administrator shall be able to **manually activate, extend, or deactivate a subscription**, with a required note. This is the mechanism by which a wire-transfer payment (ONB-008) is confirmed and the student's account is activated. Every manual activation is written to the audit log with the acting administrator, the amount, and the reference.

**ADM-074** The system shall **generate an invoice for every paid subscription regardless of ZATCA integration status**. When ZATCA/Fatoora integration is **disabled**, the system issues an internally numbered, VAT-itemized invoice (15%) as a PDF, sequentially numbered and retrievable by the student and the administrator. When ZATCA integration is **enabled**, the same invoice is additionally produced in the compliant e-invoice format and submitted through the ZATCA/Fatoora process, carrying the required fields, QR code, and clearance/reporting status. Enabling or disabling ZATCA integration shall be an administrative configuration switch and shall not require a code change.

**ADM-075 (Spec)** A subscription shall store a price snapshot so a later package price change never alters active subscriptions; the system shall define auto-renew versus manual renewal and proration on upgrade.

**ADM-076 (Spec)** Discount codes shall be manageable (code, type percent/fixed/free-days, value, redemption limits, validity window, applicable packages, owner/campaign label with optional school/city attribution) with a redemption report including views, redemptions, revenue, and cohort retention.

## 3.13 Free package — limited tier (prefix FRE)

**FRE-001** The system shall offer a **free package** available at signup without payment. Its duration and availability shall be administrator-configurable (§3.12).

**FRE-002** A free-package student shall **not receive the daily WhatsApp notification**. The student may still open the app and start the day's Wathb on their own initiative. Notification-window configuration shall be hidden or disabled for this tier.

**FRE-003** A free-package student shall be limited to **one Wathb per day**, with no additional or on-demand practice bundles.

**FRE-004** The **Wathb report shall be partially visible** to a free-package student: a defined portion is shown in full and the remainder is visually blurred/locked, with a clear upgrade call-to-action revealing what the paid tier unlocks. The blurred content shall not be present in the API response in readable form — the restriction is enforced server-side, not by CSS alone.

**FRE-005** A free-package student **shall receive the weekly report**, which serves as the tier's primary retention and conversion mechanism.

**FRE-006** A free-package student **shall not be able to add or invite a supervisor**. The invite affordance is shown in a locked state with an upgrade prompt rather than hidden entirely.

**FRE-007** All free-tier limits shall be driven by package feature flags stored on the package record, so the limits can be tuned by an administrator without a code change, and shall be enforced server-side at the API layer.

**FRE-008** On upgrade from free to a paid package, previously restricted content (full reports, history) shall become visible retroactively; no answer history is discarded when a student moves between tiers.

## 3.14 Administrator — notification log & manual messaging (prefix ADM)

**ADM-080** The notification log shall list notifications filterable by date, delivery status (delivered / failed), and Wathb status (completed / pending / unresolved / not-applicable), showing per row the student/supervisor, notification type, channel, delivery status, link-opened state, and Wathb status. *(Prototype)*

**ADM-081** The channel field shall distinguish a paid template message (قالب — مدفوع) from a free in-window message (رسالة مفتوحة — مجاني). *(Prototype)*

**ADM-082** The administrator shall be able to **send a notification manually to an individual user**, including the option to mint and attach a fresh magic link (for example, re-sending today's Wathb link, a report link, or a renewal link) when a student reports not receiving their message.

**ADM-083** The administrator shall be able to **send a bulk notification** to a filtered audience (for example by package, subscription status, school, city, region, or activity level) for announcements and promotional campaigns. Bulk sends shall: preview the recipient count before dispatch; use an appropriately categorized WhatsApp template (Marketing category where the content is promotional); respect every recipient's opt-out state and the frequency caps in NOT-010; be rate-limited; and be recorded in the audit log and the notification log with their cost estimate.

**ADM-084 (Spec)** The system shall provide a WABA quality/cost dashboard and shall raise a production alert on WABA quality-rating downgrades.

**ADM-085 (Spec)** The admin shall be able to suspend a user with a required reason and note (invalidating live magic links), reversible and logged, and the system shall maintain a full audit log of admin actions (actor, action, entity, before/after, timestamp).

## 3.15 Question selection engine (prefix SEL) — *Spec*

**SEL-001** The engine shall select, for each day, **one section** of the student's chosen test as the focus of that day's Wathb, favoring the section in which the student is weakest while rotating across sections over time so no section goes unmeasured.

**SEL-002** Within the selected section, for each eligible label the engine shall compute a selection score combining: a weakness weight (1 − accuracy), a confidence factor scaling with sample size toward MIN_SAMPLE, a coverage weight boosting under-sampled labels, a recency penalty for labels seen very recently, and the label's curriculum weight.

**SEL-003** The engine shall sample labels in proportion to score subject to hard constraints: at least one question from a strength label per bundle (morale), at least one from an under-sampled label (exploration), at most three from any single label (variety), and difficulty within ±1 of the student's ladder position for that label.

**SEL-004** **The engine shall guarantee that no question appears twice within a bundle** and that questions already answered by the student are excluded, except deliberately scheduled spaced-review items: questions answered wrong re-enter the pool after approximately 21 days, flagged as review and counted separately in the unique-questions tally so the yearly unique-question promise stays honest.

**SEL-005** Reading-comprehension passages shall be treated as atomic units; the engine shall never serve a passage question without its passage, and passage sets shall form their own bundle.

**SEL-006** On label exhaustion the engine shall degrade gracefully (borrow from a sibling label within the same section, or serve review items) and fire an admin alert rather than error.

**SEL-007** Before the placement Wathb the engine shall weight by uniform coverage (cold start); the confidence term shall govern the first weeks until samples accumulate.

**SEL-008** The package's test scope and the student's activated tests shall filter the candidate content.

## 3.16 Notification & magic-link engine (prefix NOT) — *Spec*

**NOT-001** Every notification shall carry a unique, single-purpose magic link; tapping it grants access with no login.

**NOT-002** A magic link shall be a scoped capability, not a session: a `wathb` link opens only that Wathb and must not reach billing, profile, or cancellation. Purposes include `wathb`, `weekly_report`, `supervisor_report`, `renewal`, and `link_invite`.

**NOT-003** Only a hash of the token shall be stored; the raw token exists solely in the URL. Tokens shall carry ≥128 bits of CSPRNG entropy, never sequential or derived from a user id.

**NOT-004** **A magic link shall be valid for 24 hours from issue.** After 24 hours the link expires and the user is shown a friendly "link expired" screen offering a fresh link. Single-use payment/renewal links may additionally be invalidated on first successful use. Tapping a valid link exchanges the token for a short-lived scoped session cookie.

**NOT-005** Links shall be revoked on suspension, on subscription expiry, and on mobile-number change. Sensitive actions require step-up OTP.

**NOT-006** The daily message shall be a Utility-category template carrying a quick-reply button; the student tapping it opens the 24-hour WhatsApp service window that makes subsequent same-window messages free.

**NOT-007** The scheduler shall be reactive: `next_send = last_inbound_at + 24h − safety_margin`; if that falls inside the student's slot, send free-form/utility (free), else send a utility template at the slot ceiling (paid, resetting the cycle). Wider slots reduce paid-message frequency.

**NOT-008** A nightly planning pass shall, per active paid student, plan the day, generate the Wathb, mint the magic link, and enqueue the send, keyed idempotently by `(student_id, date)` so a duplicate daily message is structurally impossible. Timestamps are stored in UTC and rendered in the student's timezone. Free-package students are excluded from daily sends (FRE-002).

**NOT-009** The scheduler shall handle paused, expired, suspended, skip-day, already-completed, and quiet-hours states, and shall apply a retry/fallback ladder, surfacing repeatedly undelivered numbers to the admin console.

**NOT-010** The system shall enforce frequency caps (≤2 messages/day to a student, ≤1/week to a supervisor unless opted in), honor STOP/إيقاف opt-out instantly and permanently, and support the notification catalogue (daily Wathb, nudge, weekly reports, streak milestones, renewal/expiry, payment-failed, supervisor invite, suspension notice) with correct WhatsApp categories.

**NOT-011** The system shall support **administrator-initiated messages**: individual manual sends with an optional freshly minted magic link (ADM-082), and bulk/promotional campaign sends to a filtered audience (ADM-083). Both paths pass through the same opt-out checks, frequency caps, categorization rules, rate limiting, and logging as automated messages.

**NOT-012** The notification layer shall sit behind a channel abstraction so the WhatsApp provider can be swapped or supplemented (for example with PWA push) without touching the scheduler.

---

# 4. Data / Domain Model

The system is relational; the following entities and key attributes are required.

| Entity | Key attributes / notes |
|---|---|
| **User** | `mobile_e164` (unique, the WhatsApp identity and primary key of the account), name, role, locale, timezone, status, `whatsapp_opt_in_at`. Email optional. Supports independent signup for both student and supervisor roles. |
| **Student** | target test, target score, test date, notification slot start/end, skip-days, fallback city. |
| **Supervisor** | supervisor profile; parent/tutor distinction is carried on the link, not the role. |
| **Student↔Supervisor** | many-to-many with `relationship_type` (ولي أمر / مشرف), `invited_at`, `accepted_at`, `revoked_at`, and an `invite_status` covering invitations sent to not-yet-registered numbers. |
| **Region / City / School** | canonical geography, fully admin-managed. Region: name, country. City: region, name, aliases, active flag. School: city, name, aliases, MoE code, type, gender, stage, `is_verified`, `merged_into_id`. |
| **SchoolEnrollment** | history of student↔school with grade, academic year, start/end. |
| **Test / Section / Area / Label** | admin-defined taxonomy. Test carries a `language` setting governing the language and text direction of all names and content beneath it. Nodes carry default timers, composite weights, and sort order. |
| **Passage** | reading-comprehension body with attached questions (atomic unit). |
| **Question / QuestionVersion** | versioned; stem, options (JSON), correct key, mandatory explanation, difficulty, timer, status (draft/in_review/published/retired), source, stem hash. |
| **Package** | tests, `duration_months`, price (SAR), questions-per-day, active, visibility, and **feature flags** (daily notification on/off, Wathbs per day, report visibility full/partial, weekly report on/off, supervisor linking allowed) that define the free tier. |
| **Subscription** | student, package, price snapshot, start/end, status (active/pending/paused/expired/suspended/refunded), payment method (card/Mada via Paymob, wire transfer), payment reference, `activated_by` (for manual activation), discount code. |
| **Invoice** | subscription, sequential number, issue date, line items, VAT amount (15%), total, PDF reference, `zatca_enabled` flag, ZATCA submission/clearance status and UUID/QR when integration is active. |
| **DiscountCode / Redemption** | code, type, value, limits, validity, applicable packages, owner/attribution. |
| **Wathb (Session)** | student, scheduled-for, **section focus**, bundle type, status, delivered/opened/completed timestamps, magic-link id. |
| **Answer** | Wathb, question version, label, selected key, is-correct, time-taken, timed-out, is-review, answered-at, and **snapshotted** school/city/region (resolved from the enrollment active at answer time — never joined live). |
| **MagicLink / MagicLinkAccess** | token hash, subject, purpose, target, 24-hour expiry, uses, revoked-at; access log of IP/user-agent/time. |
| **Notification / WA session** | kind, channel, template, category, WA message id, timestamps, billable flag, cost estimate, status/error, `initiated_by` (system / admin-manual / admin-bulk); per-user service-window state and opt-out state. |
| **student_label_stats** | materialized per-student-per-label accuracy, sample, mean time, difficulty level, last-served — read by the selection engine on every bundle. |
| **question_stats** | per-version correct-answer rate, discrimination, mean time, timeout rate, distractor distribution — refreshed nightly. |
| **cohort_label_stats** | materialized per cohort (school/city/region/discount/package/platform) — serves every cohort view. |
| **audit_log** | actor, action, entity, before/after, timestamp — including manual activations, manual/bulk sends, and any use of the OTP fallback. |

---

# 5. External Interface Requirements

## 5.1 User interfaces

- **Student & Supervisor:** responsive web, mobile-first but fully usable on desktop, Arabic RTL, large tap targets, a calm timer (amber only near expiry), zero chrome on the question screen, and an offline/queued-submission state for poor connectivity.
- **Administrator:** desktop, Arabic RTL, dense data tables with filters and sorts, split-view editors with live preview.
- **Bidi/i18n:** a shared `<Bidi>` primitive ensures numbers, math, currency, and charts render LTR within RTL layouts; every icon, chevron, and progress direction is mirrored. Content direction follows the test language (ADM-012).
- **Typography:** an Arabic face (e.g., IBM Plex Sans Arabic, bundled in the design system) with generous line height.
- **Metric wording:** all three performance metrics are surfaced using the plain-language Arabic wording of §1.3.1, with the technical term available on hover/help only.

## 5.2 Hardware interfaces

Target client hardware includes low-end Android devices on 3G; the Wathb payload target is <150 KB (excluding images) delivered in one payload.

## 5.3 Software interfaces

- **WhatsApp Business — Meta Cloud API** — template and free-form sending, inbound and status webhooks (open service window, delivery/read receipts).
- **Paymob** — card/Mada payment processing, with a payments webhook. Wire transfers are reconciled manually by an administrator (ADM-073).
- **ZATCA/Fatoora** — compliant e-invoice generation and submission, behind an activation switch (ADM-074).
- **Object storage + CDN** — question and geometry images (WebP).

## 5.4 Communications interfaces

- Inbound webhook `POST /webhooks/whatsapp` (opens the service window) and `POST /webhooks/payments`.
- Representative API surface: magic-link exchange and step-up OTP; `GET /api/wathb/today`, `POST /api/wathb/:id/answer` (per question), `POST /api/wathb/:id/complete`; role-scoped `GET /api/report/student/:id` (respecting free-tier partial visibility), weekly report, and admin-only `GET /api/report/cohort`; school search/suggest; admin geography CRUD; admin question import/commit, bank-health, question-stats, manual/bulk notification send, manual subscription activation, invoice retrieval, and suspend.

---

# 6. Non-Functional Requirements

## 6.1 Performance

**NFR-001** The Wathb question screen shall be interactive in under 1.5 seconds on 3G; the bundle payload shall be under 150 KB excluding images; question images shall be pre-optimized to WebP.

**NFR-002** Per-student report figures shall be read from materialized statistics (`student_label_stats`), not computed from raw answers at request time.

## 6.2 Localization, RTL & responsiveness

**NFR-003** The interface shall be Arabic RTL by default, with text direction following the configured test language for content. Numbers, math, and charts render LTR within RTL (enforced via the shared Bidi primitive).

**NFR-003a** The student and supervisor interfaces shall be **responsive across mobile, tablet, and desktop breakpoints**, with no functionality available on one form factor and missing on another.

## 6.3 Security

**NFR-004** Magic links are capability-scoped, single-purpose, hashed at rest, high-entropy, and expire 24 hours after issue; sensitive actions require step-up OTP.

**NFR-005** Rate limiting shall protect magic-link exchange, OTP requests, and problem reporting against brute force and abuse.

**NFR-005a** The default OTP fallback (ONB-014) is a **development and pre-launch convenience only**. It shall be gated behind an explicit configuration flag, shall never be enabled in a production environment once the WhatsApp channel is operational, shall be logged on every use, and shall be covered by a deployment check that fails the release if it is enabled in production.

**NFR-006** Cohort/analytics access control shall be enforced at the query layer, not only the UI; student/supervisor roles receive 403 for cohort endpoints.

**NFR-006a** Free-tier content restrictions (FRE-004) shall be enforced server-side; restricted content shall not be delivered to the client in a recoverable form.

**NFR-007** An anti-sharing signal shall flag a single link opened from many IPs/devices for human review rather than auto-banning.

## 6.4 Privacy & compliance

**NFR-008** As students are minors, the system shall obtain explicit guardian consent, minimize data, provide an export/delete path, define a retention period, and pass a PDPL review before launch. School data shall be optional, skippable, and collected with an honest purpose statement.

**NFR-009** Payments shall be VAT-compliant (15% KSA). Invoices shall be issued for every paid subscription whether or not ZATCA integration is active; when active, invoices shall additionally satisfy the ZATCA/Fatoora e-invoicing standard (ADM-074).

**NFR-010** WhatsApp messaging shall comply with Meta template, category (Utility vs Marketing), frequency, and opt-out policies; opt-out is instant and permanent and applies equally to automated, manual, and bulk sends.

## 6.5 Accuracy & statistical honesty

**NFR-011** The reporting layer shall enforce MIN_SAMPLE (per-area answers; 20 in the prototype) before rendering any per-area rate, showing a "collecting data" state otherwise.

**NFR-012** Question timing shall be authoritative server-side (served-at → answered-at); the client timer is presentational only.

**NFR-013** Wherever a performance metric is displayed to a non-technical audience, it shall be accompanied by its plain-language meaning per §1.3.1; a negative discrimination index shall always be surfaced to administrators as a probable answer-key error, not merely as a number.

## 6.6 Accessibility

**NFR-014** The countdown shall not be the only signal (screen-reader announcements at 50%/25%); contrast shall meet AA; tap targets shall be large.

## 6.7 Reliability & operations

**NFR-015** Daily sends shall be idempotent per `(student_id, date)`; the delivery log is a first-class admin screen; repeatedly undelivered numbers are surfaced for support.

**NFR-016** All timestamps stored in UTC, rendered in the user's timezone (no DST assumptions baked in).

---

# 7. Prototype vs. full-build coverage

The current prototype demonstrates, end-to-end with realistic Arabic data: the landing/pricing site; passwordless student login with package selection and checkout; the full student daily loop (test picker, timed questions, review with cohort comparison, completion, and per-label deltas); the student performance dashboard and profile (subscription, test activation, supervisor invite/revoke, notification settings); the supervisor console and shared report; and the complete admin console (overview + alerts, taxonomy tree, question bank + editor with mandatory-explanation validation, Excel import wizard, solution-performance analytics with distractor/discrimination/correct-answer-rate history, students list + report, geography/schools with comparison view, subscriptions, packages, and the notification/delivery log). It also enforces the per-area reporting threshold (MIN_SAMPLE = 20).

Features defined in this specification and required for the production system but not fully realized in the prototype include: the live WhatsApp/magic-link engine with 24-hour link validity and the reactive cost-optimized scheduler; administrator manual and bulk messaging; supervisor self-signup and WhatsApp invitations to unregistered supervisors; the free feature-limited tier with server-enforced partial reports; the adaptive single-section selection engine, placement Wathb, and in-bundle non-repetition guarantees; server-side answer persistence and interruption resume; destination-first bulk import; per-test language configuration; question versioning and duplicate detection; the review queue; admin-managed region/city registries and school merge tooling; wire-transfer payment with manual activation; invoice generation with switchable ZATCA integration; discount codes and the redemption report; auto-renew and proration; suspension, audit log, and step-up authentication; and the WABA quality/cost dashboard.

---

# 8. Assumptions and dependencies

The system assumes a maintained, sufficiently large, original question bank; an admin-maintained canonical school/city/region registry; WhatsApp via the Meta Cloud API as the primary channel under current Meta window/pricing rules (with an adapter to absorb change); and Paymob plus manual wire transfer for payments. Data residency in a KSA/GCC region is assumed pending legal confirmation. ZATCA integration may be switched on after launch without a code change.

---

# 9. Open issues to settle before build

These decisions materially change the implementation and remain open:

1. Auto-renew or manual renewal (shapes payments and lifecycle jobs).
2. Who pays — student or parent (may make "supervisor pays, student practises" the primary onboarding flow).
3. Missed-day behavior — roll over, stack, or vanish (recommended: vanish, streak breaks, questions return to pool).
4. On-demand extra practice for paid tiers — allowed and capped, or not (affects cost model and bank projection).
5. Skip/back — allowed or not (recommended: neither).
6. Passage bundles — own Wathb or mixed (recommended: own).
7. Headline composite index — whether to publish a single predicted score-style number (recommended: keep it a neutral internal index until calibrated against real outcomes).
8. Content origin — authored, licensed, or otherwise (the bank is the largest cost and a legal/quality risk if scraped).
9. Minimum volume before question-level statistics (correct-answer rate, discrimination) are shown to administrators as reliable — these metrics are noise at very low sample counts even though no cohort-size restriction applies to school reporting.
10. Data residency — KSA required or GCC acceptable.
11. Source of the school registry — Ministry of Education data or organic student suggestions.
12. PDPL justification for collecting school data about minors (recommended: optional + skippable + honest purpose).
13. Free-tier shape — exact duration, which portion of the report stays visible before the blur, and the conversion prompt wording.
14. Whether B2B (schools buying seats) is on the roadmap — affects onboarding, pricing, and the cost model even if built later.

---

*End of Software Requirements Specification.*
