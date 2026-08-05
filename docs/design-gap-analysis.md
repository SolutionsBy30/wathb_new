# Design ↔ implementation gap analysis

**Design source**: Claude Design project `f109eb81-20b9-47cd-8a7b-f67609338379`
**Design analysed**: full 33-file export, received 5 August 2026
**Implementation analysed**: `0ffeca3` (5 August 2026)

## Provenance

`DesignSync` could not authorise in this environment (`/design-login` needs an
interactive terminal; Claude Code on the web has none), so the project was
exported by hand and uploaded as a zip. All 33 files are present.

An earlier draft of this document was written against a 19 July cache covering
only 6 of the 9 prototype files. **The full export was diffed against that
cache and every design file is byte-identical**:

| File | Live vs 19-July cache |
|---|---|
| `Admin.dc.html` | identical |
| `Student.dc.html` | identical |
| `Supervisor.dc.html` | identical |
| `Wathb Admin Console.html` | identical |
| `wathb-data.js` | identical |
| `_ds/` bundle (tokens, styles, assets, fonts) | identical |
| `support.js` | changed (64 → 66 KB) — the Claude Design **runtime**, not the design |

So the design has not moved since 19 July, and the analysis below is confirmed
rather than provisional. The three files the cache lacked — `Admin Login`,
`Student Login`, `Landing` — are covered in §5.

Screens were enumerated from the `show*` flags that drive the prototypes'
`<sc-if>` switches, which is how the `.dc.html` files route between views.

---

## 1. Design tokens — already aligned

The `_ds` token files were diffed against all three apps' copies.

| Token file | Result |
|---|---|
| `colors.css` | **byte-identical** |
| `spacing.css` | **byte-identical** |
| `typography.css` | **byte-identical** |
| `motion.css` | identical values; differs only by stripped `/* @kind other */` authoring comments |
| `fonts.css` | **deliberate divergence — see below** |

### The one real token divergence: `fonts.css`

The design system self-hosts every font subrange. The apps self-host the
Arabic subrange but pull Outfit and the Latin subrange from the Google Fonts
CDN via `@import url("https://fonts.googleapis.com/css2?...")`.

This is worth revisiting on its own merits rather than as design drift:

- It is a **third-party request on every page load**, from a product whose
  users are in KSA. That is a latency cost and a data-sharing question.
- The design system already ships the woff2 files needed to remove it
  (`Outfit-Light/Regular-Medium.woff2`, `IBMPlexSansArabic-*-latin.woff2`)
  and they are in the snapshot.
- Removing it makes the apps render identically offline and in a locked-down
  network, which the self-hosted Arabic path already assumes.

Recommendation: adopt the design system's self-hosted `fonts.css` verbatim and
drop the `@import`. Cost is bundle size only; the fonts are already on disk.

---

## 2. Admin — design has 15 screens, the app has 20

### 2.1 Present in both

| Design flag | App screen |
|---|---|
| `showAdminOverview` | `Overview.jsx` |
| `showAdminStudents` | `Students.jsx` |
| `showAdminStudentDetail` | `StudentDetail.jsx` |
| `showAdminSupervisors` | `Supervisors.jsx` |
| `showAdminTaxonomy` | `Taxonomy.jsx` |
| `showAdminBank` | `QuestionBank.jsx` |
| `showAdminQuestionEditor` | `QuestionEditor.jsx` |
| `showAdminSolutionPerf` | `SolutionPerformance.jsx` |
| `showAdminCohortGeo` | `Geography.jsx` |
| `showAdminCohortSchool` | `Geography.jsx` |
| `showAdminCohortCompare` | `Geography.jsx` |
| `showAdminNotifLog` | `DeliveryLog.jsx` |
| `showAdminPackages` | `Packages.jsx` |
| `showAdminSubscriptions` | `Subscriptions.jsx` |
| `importStageUpload/Validate/Confirm` | `BulkImport.jsx` |

### 2.2 In the design, missing from the app — **the one real implementation gap**

**`showAdminQuestionAnalysis` — per-question analysis drill-down.**

The design has a detail screen reached from Solution Performance
(`→ رجوع لأداء الأسئلة`) that the app has no equivalent of. The app's
`SolutionPerformance.jsx` is a flat table and stops there.

The design screen shows, per question:

- **توزيع الإجابات** — distractor distribution: for each option, the percentage
  and the count of students who chose it, with the correct option marked.
  This is the part with real diagnostic value: it is how you find a
  miskeyed answer or a distractor that is accidentally defensible.
- `analysisQ.discrimination` with a colour band, `analysisQ.meanTimeS` against
  the configured `analysisQ.timerS`, and `analysisTimeoutRate`
- `analysisHelpfulYes` / `analysisHelpfulNo` — explanation feedback counts
- `analysisReportCount` — problem reports raised against the question
- `analysisInsights` — generated observations
- `analysisEditQuestion` — jump straight into the editor

**Almost all of this data already exists server-side**: `QuestionStats`
carries p-value/discrimination/`nServed`, `Answer.explanationRating` carries
the 👍/👎, and problem reports are already an admin inbox. The distractor
distribution is a `GROUP BY selectedKey` over `answers` for the version.
So this is mostly an assembly job, not new measurement.

Assessment: **worth building.** It is the highest-value missing screen because
it closes the loop on question quality, and the alternative today is reading a
flat table and guessing.

### 2.3 In the app, missing from the design — **design needs updating**

Seven screens exist in the product with no design counterpart:

| App screen | Arabic | Origin |
|---|---|---|
| `ReviewQueue.jsx` | قائمة المراجعة | ADM-027 approve/reject `in_review` |
| `ProblemReports.jsx` | بلاغات المشاكل | STU-012 admin inbox |
| `DailyTips.jsx` | نصيحة اليوم | admin-controlled daily advice |
| `AuditLog.jsx` | سجل التدقيق | ADM-085 |
| `Campaign.jsx` | الإشعارات | ADM-083 bulk/filtered send |
| `GeographyRegistry.jsx` | — | region/city CRUD |
| `Login.jsx` | — | *cannot assess — `Admin Login.dc.html` not in snapshot* |

### 2.4 Navigation structure diverges

The design uses a **flat** admin nav. The app groups its 20 screens into four
sections — المحتوى / المستخدمون / الأعمال / النظام.

This divergence is the app's, and it is defensible: a flat list of 20 items is
worse than four groups of five. **Recommendation: update the design to adopt
the grouping, not the app to flatten.** Flagged because a naive "make the app
match the design" pass would regress this.

---

## 3. Student — design has 10 screens, the app has 15

### 3.1 Present in both

`showHome` → `Home.jsx` · `showQuestion` → `Question.jsx` ·
`showAnswered` → `Explanations.jsx` · `showComplete` → `Complete.jsx` ·
`showDashboard`/`showDashboardList`/`showDashboardDetail` → `Performance.jsx` ·
`showProfile` → `Profile.jsx`

### 3.2 In the design, missing from the app

**`showTestPicker` — a dedicated full screen, "اختر نوع الوثبة".**

The design routes test selection to its own screen: a back link to Home, a
heading, and a `wd-card-grid` of full-width test cards.

The 4 August implementation put this **inline on Home as a chip row** instead.

This matters more than it looks, because the request that drove that work was
*"reflect that in leap when user start a new leap select the test"* — i.e.
test choice is meant to be a deliberate step in starting a leap, which is
exactly what a dedicated screen expresses and a chip row does not. The design
had already solved this.

Assessment: **the design's approach is better here.** A card grid also scales
to a student whose package covers several tests, where a chip row starts to
crowd Home.

**`showWathbDetail` — a past-leap detail view.**

The design has a per-leap drill-down. The app now has `LeapHistory.jsx`
(a list) but **no detail view** — rows do not open into anything.

Note this lands directly on the 4 August request: *"leap history should show
all leaps with their date and test type, **inside a leap report**"*. The list
is built; the "leap report" the row should open into is the design's
`showWathbDetail`, and it is not built. **This is an outstanding item from
that request, not a new idea.**

### 3.3 In the app, missing from the design

| App screen | Origin |
|---|---|
| `MyTests.jsx` | per-test enable/disable + goals (4 Aug) |
| `LeapHistory.jsx` | leap history list (4 Aug) |
| `Pricing.jsx` | packages + upgrade |
| `GoalSetup.jsx` | ONB-010 |
| `NotificationSlotSetup.jsx` | ONB-012 |
| `InviteSupervisorPrompt.jsx` | ONB-013 |
| `WeeklyReport.jsx` | S11 weekly report landing |
| `LinkExpired.jsx` | STU-030 |
| `Login.jsx` | *cannot assess — `Student Login.dc.html` not in snapshot* |

---

## 4. Supervisor — design has 4 screens, the app has 8

### 4.1 Present in both

`showSupDashboard` → `Dashboard.jsx` · `showSupReport` → `StudentReport.jsx` ·
`showSupNotifications` → `Preferences.jsx` · `showSupInvite` → `AcceptInvite.jsx`

### 4.2 In the app, missing from the design

| App screen | Origin |
|---|---|
| `PendingInvites.jsx` | SUP-007 browsable pending invites |
| `PayForStudent.jsx` | SUP-008 pay on behalf |
| `LinkExpired.jsx` | STU-030 |
| `Login.jsx` | supervisor OTP login |

Note `PayForStudent` gained conditional visibility on 4 August (hidden once
the student has an active subscription). The design has neither the screen nor
that rule.

---

## 5. Login and landing — the three files the cache lacked

### 5.1 `Admin Login.dc.html` — one gap

Design: email + password, `showForm` / `showError` / `showSuccess`, and a
**"نسيت كلمة المرور؟"** link. The app's `admin/src/pages/Login.jsx` has the
email/password form and the error state but **no forgot-password affordance**
(`grep "نسيت"` → 0).

Note this is not merely a missing link: there is no password-reset flow behind
it server-side either. An admin who forgets their password today has no
self-service route back in. Small screen, real feature.

### 5.2 `Student Login.dc.html` — **the design is wrong here, do not follow it**

Design flow: `showPhone` → `showOtp` → `showSuccess`, and then, if the student
has no active subscription, `showPayment` → a plan picker → `showPaymentForm`
→ `showPaymentSuccess`.

The app matches the shape exactly — phone → OTP, then `goPricing('اشتراكك غير
فعّال أو منتهٍ …')` when there is no active plan.

**It diverges on the payment step, and correctly so.** The design's
`showPaymentForm` renders our own card fields:

```html
<label>رقم البطاقة</label>
<input value="{{ cardNumber }}" placeholder="0000 0000 0000 0000" ...>
```

The implementation never touches a card number: `startCheckout` redirects to
Paymob's hosted checkout and the browser returns via `/checkout/return`.

Collecting a raw PAN in our own form would pull Wathb into **PCI-DSS SAQ D** —
the heaviest merchant compliance tier — where the hosted-redirect approach
keeps it in SAQ A. For a KSA education product taking card payments this is
not a style preference; it is the difference between a routine integration and
an audited cardholder-data environment.

**Action: fix the design, not the app.** The design's payment step should show
a "المتابعة إلى بوابة الدفع" handoff, not card inputs.

### 5.3 `Landing.dc.html` — one divergence that is deliberate

Design: nav (المميزات / الأسعار / تسجيل الدخول), a hero
("طريقك للوصول لنسبة 100%" · "كل يوم وثبة. وثبة واحدة في النهاية."), a
three-audience section, features, inline pricing, footer.

The design's login menu offers **three** routes:
دخول / تسجيل الطالب · دخول ولي الأمر / المشرف · **دخول الإدارة**

The app offers the first two only — `grep "دخول الإدارة"` → 0.

**This is intentional.** It was an explicit product request on 28 July
("remove 'admin login from landing page'"), and it is the right call: the
admin console is staff-only and does not belong on a public marketing page.

**Recorded here so nobody "fixes" it back by matching the design.** The design
should drop the third link.

## 6. Summary

**Design is behind the product, not ahead of it.** 18 of the app's 43 screens
have no design counterpart, and every one of them post-dates the design's last
change. The tokens are already shared verbatim, so this is a screen-inventory
gap, not a visual-language gap.

### Update the design with (18 screens + 3 corrections)

Admin: Review Queue · Problem Reports · Daily Tips · Audit Log · Campaign ·
Geography Registry · the grouped 4-section nav
Student: My Tests · Leap History · Pricing/upgrade · Goal Setup ·
Notification Slot Setup · Invite Supervisor Prompt · Weekly Report ·
Link Expired
Supervisor: Pending Invites · Pay For Student (with the active-subscription
hide rule) · Link Expired

Corrections where the **design is wrong and the app is right** — these must
not be "fixed" by making the app match:

- **Student Login payment step** — replace the inline card form with a
  handoff to the hosted gateway (§5.2). Following the design here would put
  Wathb in PCI-DSS SAQ D.
- **Landing** — drop the دخول الإدارة link (§5.3); removed from the app by
  explicit product request on 28 July.
- **Admin nav** — adopt the grouped four-section structure (§2.4).

### Update the app with (3 items, all already designed)

1. **Question analysis drill-down** (`showAdminQuestionAnalysis`) — distractor
   distribution, explanation feedback, problem-report count. Data mostly
   exists server-side.
2. **Leap detail / "leap report"** (`showWathbDetail`) — the view a leap
   history row should open into. Outstanding from the 4 August request.
3. **Admin forgot-password** (§5.1) — needs a server-side reset flow too, not
   just the link.

### Reconsider

4. **Test picker as a dedicated screen** rather than chips on Home — the
   design's version better matches "select the test when starting a leap".
5. **`fonts.css`** — drop the Google Fonts `@import` and self-host, as the
   design system already does. See also `docs/accessibility-audit.md` §3: the
   `--mist` contrast failure and the admin light/dark theme divergence are a
   single decision.

### No longer blocked

The full 33-file export has been received and verified byte-identical to the
19 July cache (except the Claude Design runtime), so every row above is
confirmed. Writing the 18 missing screens **back** into the Claude Design
project still requires `DesignSync` authorisation, which this environment
cannot provide — that half remains manual.
