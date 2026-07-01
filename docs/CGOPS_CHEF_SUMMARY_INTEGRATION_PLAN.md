# CGOPS Dashboard ↔ Weekly Summary — Incremental Integration Architecture

_Last reviewed: 2026-06-30_

> **Status: INCREMENTAL INTEGRATION STRATEGY.**
> We are **not** doing a full data integration yet — but we **are** beginning to
> platform-enable Weekly Summary through CGOPS, starting with **authentication
> and application access** (Phase 1), then a **basic secure capability contract**
> (Phase 2). Operational data is added **one capability at a time** as CGOPS
> matures (Phase 3+): when CGOPS has a reliable feed (e.g. sales), that field is
> exposed to Weekly Summary and the corresponding upload step is retired;
> everything CGOPS does not yet provide **continues to be collected manually**
> via the guided upload workflow. Connecting the apps does **not** wait for all
> data integrations. The goal is to chip away safely while preserving the
> long-term platform architecture described here.

> **Naming transition:** the application historically called **"Chef Summary"** is
> becoming **"Weekly Summary."** It is evolving beyond chefs to serve **Executive
> Chefs, Beverage Managers, General Managers, and potentially other departments.**
> This document uses **Weekly Summary** for the product; code-level identifiers
> that still say "chef" (e.g. the `weekly_chef_summary` table, `ChefSummary*`
> components, the `food_sales_labour_push` column) are left unchanged until a
> deliberate code rename — they are called out verbatim where referenced.

---

## 0. Purpose & strategic direction

Today every weekly package input is assembled by a manager exporting a report
from a source system (Push, Silverware, Optimum Control, QSR, Sage P&L) and
uploading the file into the guided workflow. CGOPS Dashboard is intended to
become the operational data hub that already receives/normalizes much of this
data day-to-day.

The **eventual** goal is for Weekly Summary to **pull suggested weekly values
from CGOPS so managers confirm or override them**, instead of re-uploading reports
CGOPS already holds — and, ultimately, to assemble the week from daily
observations captured in CGOPS rather than reconstructing it after the fact.

We get there **incrementally**. Rather than waiting for full CGOPS data maturity
before connecting anything, the apps are joined **now at the platform layer**
(login, permissions, application access — see §2), a **basic secure capability
contract** is stood up next, and data capabilities are then switched on **one at
a time** as each CGOPS feed becomes reliable. The
[roadmap](#15-strategic-roadmap) sequences this as five phases.

Long-term roles:

- **CGOPS Dashboard** = the operational platform: **login, permissions, and
  application access layer** for the app suite, and the operational data hub.
  Upstream provider of normalized operational data and, later, the consumer of
  the final published weekly package.
- **Weekly Summary** = the weekly package **system of record**. It owns the final
  numbers, the financial calculations, the review, the narrative, the approval,
  and the published package.

---

## 1. Guiding principles

1. **CGOPS values are _suggestions_.** Once integration exists, nothing imported
   is final until a manager confirms or overrides it.
2. **Weekly Summary owns the package.** Import never auto-publishes or silently
   mutates a confirmed value.
3. **Don't duplicate business logic.** CGOPS sends normalized _inputs_; Weekly
   Summary keeps its own derived calculations (food cost %, need-to-save, sales
   reconciliation, etc.).
4. **Build a reusable pattern**, not a CGOPS-specific hack — a generic
   "prefill provider" contract so future app-to-app feeds plug in the same way.
5. **Do not rebuild Weekly Summary inside CGOPS — and do not merge the
   codebases.** The two apps stay separate; the only couplings are the auth/access
   layer and the data contract.
6. **Connect the apps before the data.** Authentication/access integration does
   not wait for data integrations; data capabilities are enabled **one at a
   time** as each CGOPS feed becomes reliable, and manual upload remains the path
   for everything else.

Preferred data-integration architecture (per capability, as each matures): **CGOPS
exposes a weekly prefill capability. Weekly Summary calls it** (server-side) when
a weekly package is started or refreshed, and stores the suggested values plus
source metadata, confirmation status, and any overrides.

---

## 2. Incremental integration strategy

The integration proceeds in five phases (detailed in the
[roadmap](#15-strategic-roadmap)); the defining property is that **each phase is
useful on its own and none waits for full CGOPS data maturity**:

1. **Phase 1 — Authentication/access integration.** CGOPS becomes the login,
   permissions, and application access layer.
2. **Phase 2 — Basic API/capability contract.** A minimal, secure, versioned
   contract between the two apps — even before it carries much data.
3. **Phase 3 — Field-by-field prefill integration.** Data capabilities switched
   on one at a time as CGOPS feeds become reliable.
4. **Phase 4 — Daily workflow commentary integration.** Daily CGOPS observations
   assemble into the weekly package.
5. **Phase 5 — Final weekly package publication back to CGOPS.**

### 2.1 Phase 1 — CGOPS as the login, permissions & access layer

Weekly Summary **remains a separate application** (separate codebase, separate
deploy), but users reach it **through CGOPS** — target address
**`cgops.ca/weekly-summary`** (or **`cgops.ca/chefs`**), served via CGOPS routing
(reverse proxy or sub-app mount; either keeps the codebases separate).

- **CGOPS owns identity:** login, sessions, permissions, and which users can see
  the Weekly Summary app at all.
- **Weekly Summary trusts CGOPS identity:** on entry, CGOPS passes a signed,
  short-TTL identity token (user id, name, role/permission claims, location
  scope). Weekly Summary validates the signature and establishes its session from
  it — replacing today's **PIN + `localStorage` login** (`src/lib/auth.tsx`,
  `AUTHENTICATION_NOTES.md`), which is the weakest part of the current app and
  makes Phase 1 a security upgrade in its own right.
- **Role mapping:** CGOPS roles/permissions map onto Weekly Summary's existing
  `users`/`roles`/`permissions` tables (a mapping table, same spirit as the
  location map in §9), so Weekly Summary's internal permission checks keep
  working unchanged.
- **No data flows yet.** Phase 1 changes who signs you in and where the app
  lives — nothing about how the weekly package is filled.

### 2.2 Phase 2 — basic secure API/capability contract

Stand up the **plumbing** of the provider contract (§7) before it carries
operational data: the versioned endpoint shape, service-to-service auth (§8),
location mapping (§9), and fiscal-key alignment (§10) — proven end-to-end with a
trivial or empty payload (`fields: []` is a valid response by design). This
de-risks the framework separately from any individual feed.

### 2.3 Phase 3 — one capability at a time

Each data capability is enabled **independently**, gated only on its own
readiness — never on the whole platform:

| CGOPS capability, once reliable | Weekly Summary fields it unlocks | Upload step it retires (kept as fallback) |
|---|---|---|
| **Sales** (Push API, hourly/real-time) | `food_sales_labour_push` | Push Profit Center XLSX upload (Step 1) |
| **Labour** | `labour_spent_gross`, `overtime_amount` (+ DT) | Same Push XLSX (Steps 1/3) |
| **Discounts** | `boh_promo_amount` | Silverware Discounts CSV (Step 5) |
| **Speed of service** | `qsr_expo_time`, `window_time` | QSR CSV (Step 6) |
| **P&L baseline** | `recap_*` fields | Sage P&L upload (Step 17 baseline) |
| **Audit scores** | `last_audit_score_pct` | Prior-week prefill (Step 16) |
| **Guest feedback** | future optional field | — (new capability) |
| **Daily comments** (Phase 4) | narrative sections | End-of-week reconstruction |

The worked example: **once CGOPS has reliable sales, expose sales to Weekly
Summary and remove that upload step** — the field arrives as a suggested value
(confirm/override per §12–13), the upload zone becomes the fallback, and nothing
else changes. Then repeat for discounts, labour, daily comments, etc.

**Anything CGOPS does not yet provide, Weekly Summary keeps collecting
manually.** Optimum Control data stays a Weekly Summary upload permanently (§3).

### 2.4 Per-capability readiness gates

What each phase/capability needs before it switches on — these gate **only their
own row**, not the program:

| Readiness item | Gates |
|---|---|
| **Authentication / SSO** in CGOPS | Phase 1 (and everything after) |
| **Stable capability contract framework** | Phase 2 (and all Phase 3 feeds) |
| **Mature location & fiscal calendar services** | Phase 2 key alignment |
| **Enterprise data dictionary entry** for a field | That field's Phase 3 enablement |
| **Push API integration** (hourly/real-time sales) | Sales prefill |
| **Labour integration** | Labour/OT prefill |
| **Discount integration** | Discount prefill |
| **Daily Guided Workflow + daily operational comments** | Phase 4 |

---

## 3. Ownership boundaries

Clear separation of what each system owns in the target architecture:

| **CGOPS owns** | **Weekly Summary owns** |
|---|---|
| Sales data | Optimum Control upload |
| Labour data | Food cost calculations |
| Discounts | Weekly financial calculations |
| Guest feedback | Weekly review |
| Daily operational comments | Action plans |
| Daily workflow | AI-generated weekly narrative |
| Authentication, permissions & application access (Phase 1) | Final approval |
| Operational integrations | Published weekly package |
| Enterprise operational data | |

Read this as: **CGOPS is the source of operational truth; Weekly Summary is the
system of record for the assembled, reviewed, approved weekly package.** Neither
rebuilds the other.

---

## 4. Daily workflow vision (Phase 4 — the long-term architecture)

The strategic end-state is that **managers provide operational commentary through
CGOPS every day**, rather than reconstructing the week afterward. For example:

- Daily **sales** comments
- Daily **discount** comments
- Daily **staffing** notes
- Daily **operational** notes

CGOPS captures these as they happen through its Daily Guided Workflow. **Weekly
Summary then assembles the accumulated daily observations automatically into the
weekly package.**

The consequence is a fundamental shift in what the weekly process _is_:

> The weekly package becomes a **review-and-approval workflow**, not a
> data-collection exercise.

Managers stop re-entering a week's worth of numbers and notes at week-end; instead
they review what CGOPS already gathered day by day, adjust where needed, add the
Weekly-Summary-owned financial analysis and action plans, and approve. This is the
destination the contract and pre-fill mechanics below are ultimately building
toward — pre-fill of point-in-time metrics is the first step; daily-observation
assembly is the mature form.

---

## 5. Input-by-input mapping (target pre-fill design)

_This is the Phase 3 target. Each row switches on **individually** when its CGOPS
capability is reliable (§2.3–2.4); until then that row is collected manually._
Each row maps a Weekly Summary workflow step to its future CGOPS pre-fill
potential. Field names are the actual `GuidedFieldUpdates` /
`weekly_chef_summary` keys (`GuidedWeeklyPackage.tsx:934`). Confidence reflects how
directly CGOPS is expected to hold a normalized equivalent — **to be confirmed
against the CGOPS enterprise data dictionary.**

| Step (section) | Weekly Summary field(s) | Manual method (today, and the fallback) | Future CGOPS source | Confidence | Required transformation | Confirmation? | Fallback if CGOPS missing |
|---|---|---|---|---|---|---|---|
| **1. Budget & Sales** | `food_sales_labour_push` | Push Profit Center Report (XLSX, `BOH` sheet) | **Push** food sales (ultimately Push/Silverware; Sage-aligned; labour denominator) | **High** | Weekly Push sales total — a source-specific measure, **not** merged with OC sales | **Yes** | Keep XLSX upload (`parseProfitCenterReport`) |
| **11 / reconciliation** | `food_sales_oc` | OC food-cost CSV (the **Optimum Control upload**) | **Optimum Control upload — owned by Weekly Summary, NOT provided by CGOPS** | **N/A** | OC weekly sales — a *distinct* measure that may differ from Push/Silverware; **never collapsed into `food_sales_labour_push`** | n/a | OC upload (`parseFoodCostReport`) — stays in Weekly Summary |
| **11 / reconciliation** | `week_variance_amount` (+ variance %) | Derived | **Calculated inside Weekly Summary** | **N/A (derived)** | `food_sales_labour_push − food_sales_oc`; % vs. ops tolerance → **operational control flag** for OC product-mapping quality | n/a (manager reviews flag) | Computed in Weekly Summary regardless of CGOPS |
| **1. Budget & Sales** | `budget_food_sales_period`, `labour_budget_pct` | Typed by manager | Budget feed if CGOPS holds budgets | **Low–Med** | Period budget → number; budget % whole-number | **Yes** | Manual entry (unchanged) |
| **1 / 3. Sales & Labour** | `labour_spent` | Push Profit Center Report | Normalized weekly labour $ | **High** | `labour_total − transfers` is a Weekly Summary calc; CGOPS sends **gross labour $**, Weekly Summary subtracts transfers | **Yes** | Keep XLSX upload |
| **3. Overtime** | `overtime_amount` (+ doubletime) | Push Profit Center Report | OT/DT if normalized | **Medium** | Weekly OT $ (and DT $ if present) | **Yes** | Keep XLSX upload; default 0 |
| **2. Labour Transfers** | `labour_transfer_*`, `sous_vac_days` | Manual (wage × days) | — (manager judgement) | **N/A** | — | n/a (stays manual) | Unchanged |
| **5. Discounts** | `boh_promo_amount` | Silverware Discounts CSV | Normalized promo/discount totals (CGOPS discount integration) | **Medium** | Sum the same 4 BOH reason categories; **item-level ignore stays a manager action** | **Yes** | Keep CSV upload (`parseDiscountsReport`) |
| **6. Speed of Service** | `qsr_expo_time`, `window_time` | QSR Speed-of-Service CSV | QSR metrics if normalized | **Medium** | Seconds → `m:ss` string (reuse `formatSecondsAsTime`) | **Yes** | Keep CSV upload |
| **(future) Guest feedback** | _new optional field_ | Not captured today | Guest feedback (CGOPS-owned) | **Low–Med** | Aggregate to a score/flag + note | **Yes** | Omit section; no regression |
| **8. COGS checklist** | `cogs_*`, `cogs_petty_cash_amount` | Manual confirmations (OC tasks) | — (operational checklist) | **N/A** | — | n/a | Unchanged |
| **9. Purchases** | `purchases_*_amount` | OC General Ledger CSV | GL purchases if CGOPS ingests accounting | **Low–Med** | Map GL categories → 5 Weekly Summary categories | **Yes** | Keep CSV upload (`parsePurchasesReport`) |
| **10. Usage Review** | `usage_review_items` (JSON) | Two OC Usage CSVs | — (Optimum Control upload; Weekly-Summary-owned) | **N/A** | — | n/a | Unchanged (OC) |
| **11. Final Food Cost** | `final_food_cost_items`, `usage_amount`, `ideal_usage_amount`, `waste_amount` | OC food-cost CSV | — (Optimum Control upload; Weekly-Summary-owned) | **N/A** | — | n/a | Unchanged (OC) |
| **16. Audit** | `last_audit_score_pct` | Prefilled from prior week, edited | Audit/inspection feed if in CGOPS | **Low–Med** | Latest score % | **Yes** | Existing prior-week prefill |
| **17. Recap** | `recap_sales_*`, `recap_fc_*`, `recap_labour_*` | Derived from Sage P&L upload | CGOPS-normalized P&L baseline (WTD/PTD/QTD/YTD) | **Medium–High** | Provide actual/budget per horizon; Weekly Summary still computes %/variance | **Yes** | Existing `pl_uploads` baseline (`needToSave.ts`) |
| **All steps** | `fiscal_year`, `period_number`, `week_number`, `location_id` | Selected when starting package | CGOPS fiscal calendar + location registry (readiness gates, §2.4) | **High** | Resolve via location map + fiscal alignment (§9–10) | Implicit | Weekly Summary `fiscal_calendar` + `locations` |

**Realistically pre-fillable from CGOPS once mature (high/medium):** Push food
sales, gross labour $, overtime/doubletime, promo/discount totals,
speed-of-service times, P&L recap baselines, fiscal/location metadata, and
(future) guest feedback. **Optimum Control data — `food_sales_oc`, usage, final
food cost — is owned by Weekly Summary and stays a Weekly Summary upload; it is
not a CGOPS feed.** Manager-judgement steps (transfers, COGS checklist,
team/facilities/features) also stay manual.

---

## 6. What stays in Weekly Summary (anti-duplication boundary)

CGOPS sends **normalized inputs at the granularity Weekly Summary needs**, never
Weekly-Summary-specific derived KPIs. The dividing line:

| CGOPS provides (inputs) | Weekly Summary keeps (logic + ownership) |
|---|---|
| Push weekly sales $, gross labour $, OT/DT $ | Food cost % / theoretical % / labour % = usage·labour ÷ push sales (`GuidedWeeklyPackage.tsx:5608`) |
| Promo/discount total $ | Item-level "ignore this discount" decisions |
| Speed-of-service seconds | `m:ss` formatting, expo/window derivation choices |
| Push sales (source measure) | **Optimum Control upload** → `food_sales_oc`; the sales reconciliation `week_variance_amount = push − OC`, variance % vs. tolerance, and the control flag for OC product-mapping quality |
| P&L actuals & budgets per horizon | Need-to-save, QTD roll-up (`needToSave.ts`) |
| Fiscal calendar mapping, location registry | The canonical `weekly_chef_summary` row, financial calcs, review, action plans, AI narrative, approval & publish |

Rule of thumb: if removing a number from the contract would force CGOPS to know a
Weekly Summary business rule, it doesn't belong in the contract.

**Food sales specifically (do not collapse):**
- `food_sales_labour_push` is **provided by CGOPS** (ultimately from
  Push/Silverware).
- `food_sales_oc` comes from the **Optimum Control upload** owned by Weekly
  Summary — **not** from CGOPS.
- `week_variance_amount` is **calculated inside Weekly Summary**
  (`GuidedWeeklyPackage.tsx:5637`).
- The variance is an **operational control for OC product-mapping quality**: a
  small tolerance is expected noise; excessive variance flags item-linking/setup
  issues to investigate. Do **not** reintroduce a separate Silverware upload — no
  such upload exists in Weekly Summary; the Silverware-origin figure arrives via
  the CGOPS-provided `food_sales_labour_push`.

---

## 7. The data contract (Phase 2 plumbing, Phase 3 payload)

A versioned, read-only **weekly prefill** capability. CGOPS owns the endpoint;
Weekly Summary is the client. JSON over HTTPS. The full field-by-field provider
contract lives in **`docs/CGOPS_PREFILL_CONTRACT_HANDOFF.md`** (kept as the
standing spec to hand to the CGOPS team once the §2 capability-contract framework
exists).

### 7.1 Request (Weekly Summary → CGOPS)

```
GET /v1/weekly-prefill
  ?cgops_location_id={id}        # resolved via location map (§9)
  &fiscal_year={int}
  &period_number={int}
  &week_number={int}
  &week_ending_date={YYYY-MM-DD} # Sunday; lets CGOPS align its own calendar (§10)
```

### 7.2 Response (CGOPS → Weekly Summary)

A flat list of typed, self-describing **field suggestions**. Each suggestion is
independent so partial availability is first-class (a missing field is simply
absent, not an error).

```jsonc
{
  "contract_version": "1.0",
  "key": {
    "cgops_location_id": "cg-0421",
    "fiscal_year": 2026, "period_number": 8, "week_number": 2,
    "week_ending_date": "2026-06-21"
  },
  "generated_at": "2026-06-30T14:00:00Z",
  "fields": [
    {
      "field_key": "food_sales_labour_push",   // matches Weekly Summary field name
      "value": 72889.00,
      "unit": "currency",                       // currency | percent | seconds | time_mmss | integer | text
      "confidence": "high",                     // high | medium | low
      "source_system": "push",                  // push | silverware | optimum_control | qsr | accounting | audit | cgops
      "source_ref": "profit_center:2026-06-21", // upstream provenance for the audit trail
      "as_of": "2026-06-23T02:00:00Z"
    }
    // ...labour_spent_gross, overtime_amount, boh_promo_amount, qsr_expo_time, recap baselines, etc.
  ],
  "unavailable": ["purchases_bakery_amount"]    // optional: explicitly-known gaps
}
```

Design notes:

- **`field_key` is the integration vocabulary**, deliberately aligned to Weekly
  Summary's field names so mapping is 1:1. A small adapter on the Weekly Summary
  side translates any naming differences and applies `unit` transforms (e.g.
  `seconds`→`m:ss`).
- **Units are explicit.** Percent values follow the whole-number convention
  (`24.43`, not `0.2443`).
- **`labour_spent_gross`** is sent, not `labour_spent` — Weekly Summary subtracts
  transfers itself (anti-duplication, §6).
- **Food sales stays two separate measures** — `food_sales_labour_push` (CGOPS)
  and `food_sales_oc` (Weekly Summary's OC upload). CGOPS supplies only the former.
- **Provenance (`source_system`, `source_ref`, `as_of`)** is mandatory.
- The contract is **additive and versioned** (`contract_version`).

---

## 8. Authentication

Service-to-service, **never from the browser**, built on the CGOPS Auth/SSO
capability delivered in Phase 1 (§2.1). Mirrors how Weekly Summary already
isolates secrets in edge functions (`generate-chef-summary` reads
`OPENAI_API_KEY` server-side).

- Add a Weekly Summary **edge function `fetch-cgops-prefill`**. The browser calls
  it with the user's session (same pattern as `${VITE_SUPABASE_URL}/functions/v1/...`).
  The function authorizes the user, then calls CGOPS server-to-server.
- **CGOPS→edge auth:** OAuth2 client-credentials (preferred) or a signed
  short-TTL service JWT, issued via CGOPS SSO. Secrets live only in the edge
  function's environment. Optionally add an HMAC signature for defense in depth.
- **Scope:** read-only weekly-prefill, limited to mapped locations.
- **Auditability:** every fetch logs `requested_by`, key, and CGOPS response
  status.

```
Browser (user session) → WS edge fn fetch-cgops-prefill → (client-creds/SSO) → CGOPS /v1/weekly-prefill
                                   │
                                   └─ upsert suggestions into weekly_prefill
```

---

## 9. Location mapping

`locations` today has `id` (uuid) and a unique `code` (e.g. `BTB`) but **no
external id** (`create_core_tables.sql:42`). When integration begins, add an
explicit map rather than assuming codes line up:

```sql
CREATE TABLE location_external_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id),
  external_system text NOT NULL,          -- 'cgops'
  external_location_id text NOT NULL,     -- CGOPS's id
  created_at timestamptz DEFAULT now(),
  UNIQUE (external_system, external_location_id),
  UNIQUE (location_id, external_system)
);
```

- The edge function resolves `location_id` → `external_location_id` before calling
  CGOPS, and back again on response.
- A location with no mapping row simply gets **no pre-fill** (clean fallback to
  manual). An admin screen surfaces unmapped locations.
- Generic `external_system` keeps the table reusable for future integrations.
- CGOPS's **mature location service** (§2) is the authoritative source of
  `external_location_id`s.

---

## 10. Weekly key & fiscal alignment

Canonical weekly key everywhere: **`location_id + fiscal_year + period_number +
week_number`** (the existing `weekly_chef_summary` unique constraint).

The risk is calendar drift. Until CGOPS's **mature fiscal calendar service** (§2)
is authoritative and shared, Weekly Summary owns the calendar:

- Weekly Summary **owns** the fiscal calendar (`fiscal_calendar`, Sunday
  week-ending) and passes **both** the fiscal key **and** the resolved
  `week_ending_date` in the request.
- CGOPS aligns its data to that `week_ending_date` and echoes the key back.
- On mismatch it returns `fields: []` — Weekly Summary falls back to manual with a
  "no CGOPS data for this week" notice.

---

## 11. Data model additions (Weekly Summary side)

Keep suggestions, provenance, confirmation, and overrides **out of the main
`weekly_chef_summary` row** so the audit trail is clean and the package row keeps
holding only final values.

```sql
CREATE TABLE weekly_prefill (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id),
  fiscal_year int NOT NULL,
  period_number int NOT NULL,
  week_number int NOT NULL,
  field_key text NOT NULL,                 -- e.g. 'food_sales_labour_push'

  -- as received from CGOPS
  suggested_value numeric,                 -- or suggested_text for text fields
  suggested_text text,
  unit text,
  confidence text,
  source_system text,
  source_ref text,
  source_as_of timestamptz,
  fetched_at timestamptz DEFAULT now(),

  -- manager disposition
  status text NOT NULL DEFAULT 'suggested', -- suggested | confirmed | overridden | dismissed | missing
  final_value numeric,                      -- value actually written to the package
  final_text text,
  override_reason text,
  decided_by uuid REFERENCES users(id),
  decided_at timestamptz,

  UNIQUE (location_id, fiscal_year, period_number, week_number, field_key)
);
```

- **Refresh semantics:** re-fetching updates `suggested_*` / `fetched_at` but
  **never** overwrites a `confirmed`/`overridden` row's `final_*`. If a refreshed
  suggestion differs from a confirmed value, flag it for re-review.
- The package row (`weekly_chef_summary`) is written **only** from `final_value`
  once a field is `confirmed`/`overridden` — preserving Weekly Summary as owner.

---

## 12. UI changes in Weekly Summary

Each pre-fillable field in the guided workflow gains a lightweight "source"
treatment; the existing upload UI stays as the fallback path.

- **Source badge per field:** `Suggested · CGOPS` (with confidence + `as_of`
  freshness), `Confirmed`, `Overridden`, or `Manual`.
- **Confirm / Override controls:** a suggested value renders pre-filled but
  visually distinct (e.g. amber outline) with **Confirm** and **Edit/Override**.
  Confirming writes it to the package; editing flips status to `overridden` and
  optionally captures `override_reason`.
- **"Import from CGOPS" / "Refresh" action** at the start of a package and on each
  relevant step.
- **Diff indicator:** when a refreshed suggestion differs from a confirmed value,
  show old→new and let the manager re-confirm or keep theirs.
- **Graceful absence:** if CGOPS returns nothing for a field, the step looks
  exactly as it does today (upload zone), no error.
- **Provenance tooltip:** `source_system` + `source_ref`.

In the mature daily-workflow end-state (§4), this same UI becomes the
**review-and-approval** surface: most fields arrive pre-filled from accumulated
daily CGOPS observations, and the manager's job is to confirm, adjust, add
financial analysis/action plans, and approve.

---

## 13. Override / audit trail

Captured by the `weekly_prefill` columns above:

- Original suggestion is **retained** (`suggested_*`) even after override.
- `status`, `final_*`, `override_reason`, `decided_by`, `decided_at` record the
  decision and who made it.
- `source_*` / `fetched_at` record upstream provenance and freshness.
- Yields a per-field, per-week answer to "was this CGOPS or the manager, what did
  CGOPS say, what did the manager do, and when."

---

## 14. Failure handling

The integration is **strictly additive** — the manual upload flow remains the
guaranteed path, so no failure can block a manager from finishing a package.

| Failure | Behaviour |
|---|---|
| CGOPS endpoint down / timeout | Edge fn returns "prefill unavailable"; UI shows manual upload; short retry w/ backoff, then give up gracefully |
| Partial data | Per-field; present fields pre-fill, absent fields fall back to manual |
| Location unmapped | No pre-fill; admin notice to add a `location_external_map` row |
| Fiscal week mismatch | `fields: []` + "no CGOPS data for this week" notice |
| Stale data | `as_of` shown; manager decides; `Refresh` re-fetches |
| Auth failure | Logged; treated as "unavailable"; never surfaces the secret |
| Contract version unknown | Edge fn ignores unrecognized fields, processes known ones |
| Refresh conflicts with confirmed value | Flagged for re-review; confirmed `final_*` never auto-overwritten |

---

## 15. Strategic roadmap

Five phases, each shippable on its own. The point is to **chip away safely**:
connect the apps early, add data only as each CGOPS capability becomes reliable,
and preserve the long-term platform architecture throughout.

| Phase | Focus | What happens | Exit criteria |
|---|---|---|---|
| **Phase 1** | **Authentication/access integration** | CGOPS becomes the login, permissions, and application access layer (§2.1). Users reach Weekly Summary at `cgops.ca/weekly-summary` (or `cgops.ca/chefs`); CGOPS identity replaces the PIN + `localStorage` login; CGOPS roles map onto Weekly Summary's `users`/`roles`/`permissions`. **No data flows.** Weekly Summary stays a separate app. | A user signs into CGOPS once and uses Weekly Summary with the right permissions, no separate PIN |
| **Phase 2** | **Basic API/capability contract** | The versioned contract plumbing (§7), service-to-service auth (§8), location map (§9), and fiscal-key alignment (§10) go live end-to-end — even with an empty/trivial payload (`fields: []` is valid by design). | A round-trip prefill call succeeds for a pilot location; framework proven independent of any feed |
| **Phase 3** | **Field-by-field prefill integration** | Capabilities switch on one at a time per §2.3 as each CGOPS feed becomes reliable — e.g. sales first: `food_sales_labour_push` arrives as a suggested value, the Push XLSX upload step is retired to a fallback. Then discounts, labour, speed of service, P&L baselines, audit scores. Managers confirm/override everything; manual upload continues for whatever CGOPS doesn't yet provide. | Each enabled capability replaces its upload step, with confirm/override and manual fallback intact |
| **Phase 4** | **Daily workflow commentary integration** | CGOPS's Daily Guided Workflow captures daily sales/discount/staffing/operational comments (§4); Weekly Summary assembles the accumulated daily observations into the weekly package. The weekly process becomes review-and-approval, not data collection. | Narrative sections arrive pre-assembled from daily comments; managers review, adjust, approve |
| **Phase 5** | **Final weekly package publication back to CGOPS** | On approval/publish, Weekly Summary emits the final package (the `weekly_chef_summary` record + `weekly_actions`) to CGOPS for executive/portfolio reporting. CGOPS consumes it; it does not rebuild the package. | CGOPS executive views read published Weekly Summary packages |

Guardrails that hold across all phases:
- The codebases are **never merged** and business logic is never duplicated —
  coupling is limited to the auth/access layer and the versioned contract.
- Weekly Summary's manual path is never removed; integration is additive.
- Imported values are always suggestions requiring confirmation.
- Weekly Summary remains the system of record and the owner of financial calcs,
  review, action plans, AI narrative, approval, and the published package.
- The prefill mechanism generalizes to a reusable `PrefillProvider` pattern
  (`weekly_prefill.source_system` + `location_external_map.external_system` are
  already provider-agnostic), so CGOPS is simply the first provider.

---

## Appendix — anchor references

| Concern | Where |
|---|---|
| Pre-fillable fields / step outputs | `src/components/GuidedWeeklyPackage.tsx` (`GuidedFieldUpdates` @ 934; `STEP_META` @ 21) |
| Derived metrics that stay in Weekly Summary | `GuidedWeeklyPackage.tsx:5608`, `GuidedWeeklyPackage.tsx:5637`, `src/lib/needToSave.ts` |
| Existing report parsers (manual fallbacks) | `GuidedWeeklyPackage.tsx:250/302/525/701/754/834`, `src/lib/csvParser.ts`, `src/lib/excelParser.ts` |
| Edge-function + secret pattern | `supabase/functions/generate-chef-summary/index.ts`, calls @ `…/functions/v1/…` |
| Weekly key & uniqueness | `supabase/migrations/20260518161752_add_unique_constraint_weekly_chef_summary.sql` |
| Locations schema (needs external map) | `supabase/migrations/20260511231355_create_core_tables.sql:42` |
| Provider contract (standing spec) | `docs/CGOPS_PREFILL_CONTRACT_HANDOFF.md` |
| Companion process audit | `docs/CHEF_SUMMARY_AUDIT.md` |
