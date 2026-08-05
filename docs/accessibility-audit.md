# Accessibility audit

**Scope**: student app (`src/`), admin app (`admin/src/`), supervisor app
(`supervisor/src/`), and the shared design-system tokens.
**Commit audited**: `0339556` (4 August 2026)
**Standard**: WCAG 2.1 AA

This is a static audit — source inspection plus computed contrast ratios. It
has **not** been run against a screen reader or an automated engine (axe,
Lighthouse) in a real browser. Findings below are ordered by severity; the
"Verified" column says how each one was established.

---

## Already correct

Worth stating, because these are the ones usually missed:

| Item | Status |
|---|---|
| `lang="ar" dir="rtl"` on the root `<html>` | ✅ all three apps |
| Focus indicators | ✅ **no `outline: none` anywhere** — browser focus rings intact |
| Contrast on the dark ground the apps actually use | ✅ every token pair passes AA (see §3) |
| Timer announcements (NFR-014) | ✅ `role="status"` + `aria-live` on the question timer |
| Option tap targets | ✅ `minHeight: 48px` in `QuestionCard` |

---

## 1. Form labels are not associated with their inputs — **high**

**Verified**: `grep -c htmlFor` across all three apps returns **0**, against
**22** `<label>` elements.

Every label is a visually-adjacent `<label>` with no `htmlFor`, and no input
carries a matching `id`:

```jsx
<label style={labelStyle}>التصنيف</label>
<select value={labelId} onChange={...} style={fieldStyle}>
```

A screen reader announces that `<select>` as an unnamed combo box. The user
hears the options but never learns the field is "التصنيف". This affects every
form in the product: the question editor, goal setup, package editing,
geography, campaign send, bulk import.

**Fix**: give each control an `id` and each label an `htmlFor`, or wrap the
control in its `<label>`. Mechanical, but it touches ~22 sites across the
three apps.

**Worst instance** — the correct-answer radios in `QuestionEditor.jsx` carry
only a `title`, which most screen readers do not announce as a name:

```jsx
<input type="radio" checked={correctKey === o.key}
       onChange={() => setCorrectKey(o.key)} title="الإجابة الصحيحة" />
```

Four radios in a row all announcing the same thing, with no group name. This
should be a `<fieldset>` with a `<legend>`, each radio labelled by its option
key.

## 2. Table rows and cells are click targets but not keyboard targets — **high**

**Verified**: grep for `onClick` on non-interactive elements.

| File | Element |
|---|---|
| `admin/src/pages/QuestionBank.jsx:104` | `<td onClick={() => onEdit(q.id)}>` |
| `admin/src/pages/Students.jsx:106` | `<td onClick={() => onOpenStudent(...)}>` |
| `supervisor/src/pages/Dashboard.jsx:160` | `<tr onClick={() => onOpenStudent(...)}>` |
| `admin/src/pages/ReviewQueue.jsx` | `<span onClick={() => onEdit(q.id)}>` |

None has `tabIndex`, `role="button"`, or a key handler. A keyboard-only user
**cannot open a student record in the supervisor dashboard at all** — the row
is the only route in. Same for opening a question from the bank.

**Fix**: put a real `<button>` (or `<a>`) inside the cell carrying the action,
rather than making the cell itself clickable. That gets focus, Enter/Space and
the right role for free.

## 3. `--mist` fails AA on light grounds — **medium now, high if the admin is re-themed**

Computed contrast ratios (WCAG relative luminance):

| Foreground / background | Ratio | AA (4.5) | Large (3.0) |
|---|---|---|---|
| `--sand` on `--indigo` | 14.69 | ✅ | ✅ |
| `--mist` on `--indigo` | 6.34 | ✅ | ✅ |
| `--mist` on `--indigo-raised` | 5.65 | ✅ | ✅ |
| `--coral` on `--indigo` | 5.89 | ✅ | ✅ |
| `--graphite` on `--sand` | 9.09 | ✅ | ✅ |
| **`--mist` on `--sand`** | **2.32** | ❌ | ❌ |
| **`--mist` on `--paper`** | **2.62** | ❌ | ❌ |
| **`--lime-print` on `--sand`** | **3.04** | ❌ | ✅ |
| **`--lime-print` on `--paper`** | **3.44** | ❌ | ✅ |

All three apps currently render on `--indigo`, where `--mist` passes at
6.34:1 — so **today this is mostly latent**. Two things make it worth fixing
now rather than later:

**a. The design system sanctions the failing pair.** `colors.css` declares:

```css
--text-on-light-muted:    var(--mist);
```

That alias is a WCAG AA failure by construction. Anyone following the token
names into a light surface inherits a 2.32:1 label.

**b. The admin console is light-themed in the design.** `Admin.dc.html` uses
`background:var(--paper)` **62 times** and `--sand-deep` 13 times, against
`--indigo` 8 times — paper cards on a sand ground, indigo reserved for chrome.
The implemented admin is the inverse: indigo ground, 0 light surfaces.

So if the admin is ever aligned to the design's theme — which is a live
question from `docs/design-gap-analysis.md` — **all 123 `var(--mist)` label
uses in the admin app drop to 2.32:1 simultaneously.** The contrast bug and
the theme divergence are the same decision.

**Fix**: darken `--mist` for light grounds, or introduce a distinct
`--mist-on-light` at ≥4.5:1 and repoint `--text-on-light-muted` at it.
`--lime-print` is already correctly scoped as a large-text/graphical accent,
but should be documented as never-for-body-text.

> Note: this affects the shared design system, so it wants fixing in the
> Claude Design project too, not only in the three local copies.

## 4. Question artwork was invisible to screen readers — **fixed in this commit**

Introduced by me earlier the same day, in the ADM-032 image work. Question
figures rendered as:

```jsx
<img src={questionImage} alt="" />
```

`alt=""` means *decorative — skip me*. For a geometry figure or a chart to
read off, the picture **is** the question: a screen-reader user got the stem
and no figure, i.e. an unanswerable item with no indication anything was
missing. An image-only option rendered as a nameless button.

**Fixed here**: the stem image now announces `صورة السؤال` (overridable via a
new `questionImageAlt` prop), and an option image with no text falls back to
`الخيار <key>` so the button is never nameless. Applied in `QuestionCard`
(student + admin copies) and the explanation review screen.

**Still open**: this is a floor, not a ceiling. Real alt text has to come from
the author. The question editor should capture an `alt` field per image and
`QuestionVersion` should persist it — the schema already carries
`stemImageUrl` and per-option `imageUrl` and could carry the text beside them.
Recommended as the proper follow-up.

## 5. Tables have no header association — **medium**

**Verified**: `grep -c 'scope='` across all apps returns **0**.

No `<th>` in any app carries `scope="col"`. In the wider admin tables — the
question bank, solution performance (7 columns), delivery log, subscriptions —
a screen reader cannot reliably tell a user which column a cell belongs to.

**Fix**: add `scope="col"` to every `<th>`. One-line-per-table.

## 6. ARIA coverage is thin — **low, informational**

Across all three apps: **2** `aria-label`, **1** `aria-live`, **1** `role`.

That is not automatically wrong — semantic HTML beats ARIA, and the apps do
use real `<button>`s in most places. But combined with §1 and §2 it indicates
the gaps are unlabelled controls rather than over-ARIA'd ones. Icon- and
emoji-only buttons (the 👍/👎 explanation feedback, the taxonomy reorder
handles) should carry `aria-label`.

---

## Summary

| # | Finding | Severity | State |
|---|---|---|---|
| 1 | 22 labels, 0 `htmlFor`; unlabelled radio group | High | Open |
| 2 | Rows/cells clickable but not keyboard-reachable | High | Open |
| 3 | `--mist` at 2.32:1 on light; `--text-on-light-muted` sanctions it | Med → High on re-theme | Open |
| 4 | Question artwork hidden by `alt=""` | High | **Fixed** |
| 5 | No `scope` on any `<th>` | Medium | Open |
| 6 | Sparse `aria-label` on icon-only controls | Low | Open |

**Recommended order**: §2 (a keyboard user is currently locked out of two core
flows) → §1 → §5 → §3 (decide alongside the admin theme question) → §6.

**Not yet done**: no automated engine has been run and no screen-reader pass
has been made. An axe or Lighthouse run in a real browser would likely surface
more, particularly around heading hierarchy and landmark regions, which this
static pass did not assess systematically.
