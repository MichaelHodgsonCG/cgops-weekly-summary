# CGOPS Dashboard ↔ Chef Summary — Two-Way Integration Plan

_Last reviewed: 2026-06-30_

## 0. Purpose & guiding principles

Today every weekly Chef Summary input is assembled by a chef exporting a report
from a source system (Push, Silverware, Optimum Control, QSR, Sage P&L) and
uploading the file into the guided workflow. CGOPS Dashboard already
receives/normalizes some of the same operational data. This plan lets Chef
Summary **pull suggested weekly values from CGOPS so chefs confirm or override
them**, instead of re-uploading reports CGOPS already holds.

Roles are unchanged:

- **CGOPS Dashboard** = orchestration / data hub. It is the upstream provider of
  normalized operational data and, later, the consumer of the final published
  weekly summary.
- **Chef Summary** = weekly package **system of record**. It owns the final
  numbers, the narrative, and the published package.

Non-negotiable principles (from the goals):

1. **CGOPS values are _suggestions_.** Nothing imported is final until a chef
   confirms or overrides it. (Goal 3)
2. **Chef Summary owns the package.** Import never auto-publishes or silently
   mutates a confirmed value. (Goal 2)
3. **Don't duplicate business logic.** CGOPS sends normalized _inputs_; Chef
   Summary keeps its own derived calculations (food cost %, need-to-save, etc.).
   (Goal 4)
4. **Build a reusable pattern**, not a CGOPS-specific hack — a generic
   "prefill provider" contract so future app-to-app feeds plug in the same way.
   (Goal 5)
5. **Do not rebuild Chef Summary inside CGOPS.** The two apps stay separate; the
   only coupling is the contract in §3.

Preferred architecture (confirmed): **CGOPS exposes a weekly prefill endpoint.
Chef Summary calls it** (server-side) when a weekly package is started or
refreshed, stores the suggested values plus source metadata, confirmation
status, and any chef overrides.

---

## 1. Input-by-input audit and mapping

Each row maps a Chef Summary workflow step to its CGOPS pre-fill potential. Field
names are the actual `GuidedFieldUpdates` / `weekly_chef_summary` keys
(`GuidedWeeklyPackage.tsx:934`). Confidence reflects how directly CGOPS is
expected to already hold a normalized equivalent — **to be confirmed against the
CGOPS audit**, since this repo cannot see the CGOPS schema.

| Step (section) | Chef Summary field(s) | Currently manual upload | Possible CGOPS source | Confidence | Required transformation | Chef confirmation? | Fallback if CGOPS missing |
|---|---|---|---|---|---|---|---|
| **1. Budget & Sales** | `food_sales_labour_push` | Push Profit Center Report (XLSX, `BOH` sheet) | Normalized weekly POS/sales total | **High** | Sum to weekly total; map Push→canonical sales | **Yes** | Keep XLSX upload (`parseProfitCenterReport`) |
| **1. Budget & Sales** | `budget_food_sales_period`, `labour_budget_pct` | Typed by chef | Budget feed if CGOPS holds budgets | **Low–Med** | Period budget → number; budget % whole-number | **Yes** | Manual entry (unchanged) |
| **1 / 3. Sales & Labour** | `labour_spent` | Push Profit Center Report | Normalized weekly labour $ | **High** | `labour_total − transfers` is a CS calc; CGOPS sends **gross labour $**, CS subtracts transfers | **Yes** | Keep XLSX upload |
| **3. Overtime** | `overtime_amount` (+ doubletime) | Push Profit Center Report | OT/DT if normalized | **Medium** | Weekly OT $ (and DT $ if present) | **Yes** | Keep XLSX upload; default 0 |
| **2. Labour Transfers** | `labour_transfer_*`, `sous_vac_days` | Manual (wage × days) | — (chef judgement) | **N/A** | — | n/a (stays manual) | Unchanged |
| **5. Discounts** | `boh_promo_amount` | Silverware Discounts CSV | Normalized promo/discount totals | **Medium** | Sum the same 4 BOH reason categories; **item-level ignore stays a chef action** | **Yes** | Keep CSV upload (`parseDiscountsReport`) |
| **6. Speed of Service** | `qsr_expo_time`, `window_time` | QSR Speed-of-Service CSV | QSR metrics if normalized | **Medium** | Seconds → `m:ss` string (reuse `formatSecondsAsTime`) | **Yes** | Keep CSV upload |
| **(new) Guest feedback** | _new optional field_ | Not captured today | Guest review/feedback signals | **Low–Med** | Aggregate to a score/flag + note | **Yes** | Omit section; no regression |
| **8. COGS checklist** | `cogs_*`, `cogs_petty_cash_amount` | Manual confirmations (OC tasks) | — (operational checklist) | **N/A** | — | n/a | Unchanged |
| **9. Purchases** | `purchases_*_amount` | OC General Ledger CSV | GL purchases if CGOPS ingests accounting | **Low–Med** | Map GL categories → 5 CS categories | **Yes** | Keep CSV upload (`parsePurchasesReport`) |
| **10. Usage Review** | `usage_review_items` (JSON) | Two OC Usage CSVs | — (OC inventory specific) | **Low** | — | n/a | Unchanged (OC) |
| **11. Final Food Cost** | `final_food_cost_items`, `usage_amount`, `ideal_usage_amount`, `waste_amount`, `food_sales_oc` | OC food-cost CSV | — (OC inventory specific) | **Low** | — | n/a | Unchanged (OC) |
| **16. Audit** | `last_audit_score_pct` | Prefilled from prior week, edited | Audit/inspection feed if in CGOPS | **Low–Med** | Latest score % | **Yes** | Existing prior-week prefill |
| **17. Recap** | `recap_sales_*`, `recap_fc_*`, `recap_labour_*` | Derived from Sage P&L upload | CGOPS-normalized P&L baseline (WTD/PTD/QTD/YTD) | **Medium–High** | Provide actual/budget per horizon; CS still computes %/variance | **Yes** | Existing `pl_uploads` baseline (`needToSave.ts`) |
| **All steps** | `fiscal_year`, `period_number`, `week_number`, `location_id` | Selected when starting package | CGOPS fiscal calendar + location registry | **High** | Resolve via location map + fiscal alignment (§5–6) | Implicit | Chef Summary `fiscal_calendar` + `locations` |

**Summary of what's realistically pre-fillable now (high/medium):** weekly sales,
gross labour $, overtime/doubletime, promo/discount totals, speed-of-service
times, P&L recap baselines, and fiscal/location metadata. **Inventory-derived
steps (usage, final food cost) and chef-judgement steps (transfers, COGS
checklist, team/facilities/features) stay manual** — they are OC- or
chef-specific and are out of scope for CGOPS pre-fill.

---

## 2. What stays in Chef Summary (anti-duplication boundary)

CGOPS sends **normalized inputs at the granularity Chef Summary needs**, never
Chef-Summary-specific derived KPIs. The dividing line:

| CGOPS provides (inputs) | Chef Summary keeps (logic) |
|---|---|
| Weekly sales $, gross labour $, OT/DT $ | Food cost % / theoretical % / labour % = usage·labour ÷ push sales (`GuidedWeeklyPackage.tsx:5608`) |
| Promo/discount total $ | Item-level "ignore this discount" decisions |
| Speed-of-service seconds | `m:ss` formatting, expo/window derivation choices |
| P&L actuals & budgets per horizon | Need-to-save, QTD roll-up (`needToSave.ts`) |
| Fiscal calendar mapping, location registry | The canonical `weekly_chef_summary` row & package assembly |

Rule of thumb: if removing a number from the contract would force CGOPS to know a
Chef-Summary business rule, it doesn't belong in the contract.

---

## 3. The data contract

A versioned, read-only **weekly prefill** capability. CGOPS owns the endpoint;
Chef Summary is the client. JSON over HTTPS.

### 3.1 Request (Chef Summary → CGOPS)

```
GET /v1/weekly-prefill
  ?cgops_location_id={id}        # resolved via location map (§5)
  &fiscal_year={int}
  &period_number={int}
  &week_number={int}
  &week_ending_date={YYYY-MM-DD} # Sunday; lets CGOPS align its own calendar (§6)
```

### 3.2 Response (CGOPS → Chef Summary)

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
      "field_key": "food_sales_labour_push",   // matches Chef Summary field name
      "value": 72889.00,
      "unit": "currency",                       // currency | percent | seconds | time_mmss | integer | text
      "confidence": "high",                     // high | medium | low
      "source_system": "push",                  // push | silverware | qsr | accounting | audit | cgops
      "source_ref": "profit_center:2026-06-21", // upstream provenance for the audit trail
      "as_of": "2026-06-23T02:00:00Z"
    },
    { "field_key": "labour_spent_gross", "value": 13987.50, "unit": "currency",
      "confidence": "high", "source_system": "push", "source_ref": "profit_center:2026-06-21", "as_of": "..." },
    { "field_key": "overtime_amount", "value": 0, "unit": "currency", "confidence": "medium",
      "source_system": "push", "source_ref": "...", "as_of": "..." },
    { "field_key": "boh_promo_amount", "value": 72.44, "unit": "currency", "confidence": "medium",
      "source_system": "silverware", "source_ref": "...", "as_of": "..." },
    { "field_key": "qsr_expo_time", "value": 576, "unit": "seconds", "confidence": "medium",
      "source_system": "qsr", "source_ref": "...", "as_of": "..." }
    // ...recap baselines, audit score, etc.
  ],
  "unavailable": ["purchases_bakery_amount"]    // optional: explicitly-known gaps
}
```

Design notes:

- **`field_key` is the integration vocabulary**, deliberately aligned to Chef
  Summary's field names so mapping is 1:1 and obvious. A small adapter on the
  Chef Summary side translates any naming differences and applies `unit`
  transforms (e.g. `seconds`→`m:ss`).
- **Units are explicit** so the receiver never guesses. Percent values follow the
  Chef Summary whole-number convention (`24.43`, not `0.2443`).
- **`labour_spent_gross`** is sent, not `labour_spent` — Chef Summary subtracts
  transfers itself (anti-duplication, §2).
- **Provenance (`source_system`, `source_ref`, `as_of`)** is mandatory; it feeds
  the audit trail and the "where did this come from / how fresh is it" UI.
- The contract is **additive and versioned** (`contract_version`). New fields are
  added without breaking older clients; breaking changes bump the version.

---

## 4. Authentication

Service-to-service, **never from the browser** (the CGOPS credential must not ship
in client JS). This mirrors how Chef Summary already isolates secrets in edge
functions (`generate-chef-summary` reads `OPENAI_API_KEY` server-side).

- Add a Chef Summary **edge function `fetch-cgops-prefill`**. The browser calls it
  with the user's existing Supabase JWT (same pattern as
  `${VITE_SUPABASE_URL}/functions/v1/...`). The function authorizes the user, then
  calls CGOPS server-to-server.
- **CGOPS→edge auth:** OAuth2 client-credentials (preferred) or a signed
  short-TTL service JWT. The CGOPS client id/secret live only in the edge
  function's environment. Optionally add an HMAC signature over the request for
  defense in depth.
- **Scope:** the credential grants read-only access to the weekly-prefill
  capability and only for locations Chef Summary is mapped to.
- **Auditability:** every fetch logs `requested_by` (user), key, and CGOPS
  response status into the prefill table / a fetch log.

```
Browser (user JWT) → CS edge fn fetch-cgops-prefill → (client-creds) → CGOPS /v1/weekly-prefill
                                   │
                                   └─ upsert suggestions into weekly_prefill
```

---

## 5. Location mapping

`locations` today has `id` (uuid) and a unique `code` (e.g. `BTB`) but **no
external id** (`create_core_tables.sql:42`). Add an explicit map rather than
assuming codes line up:

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

- The edge function resolves `location_id` → `external_location_id` before
  calling CGOPS, and back again on response.
- A location with no mapping row simply gets **no pre-fill** (clean fallback to
  manual). An admin screen surfaces unmapped locations.
- Generic `external_system` keeps the table reusable for future app integrations
  (Goal 5).

---

## 6. Weekly key & fiscal alignment

Canonical weekly key everywhere: **`location_id + fiscal_year + period_number +
week_number`** (the existing `weekly_chef_summary` unique constraint).

The risk is calendar drift: CGOPS may not share Chef Summary's fiscal periods. To
avoid Chef Summary re-implementing CGOPS's calendar (and vice-versa):

- Chef Summary **owns** the fiscal calendar (`fiscal_calendar`, Sunday
  week-ending) and passes **both** the fiscal key **and** the resolved
  `week_ending_date` in the request.
- CGOPS aligns its data to that `week_ending_date` and echoes the key back.
- On mismatch (CGOPS can't resolve that week) it returns `fields: []` — Chef
  Summary falls back to manual with a "no CGOPS data for this week" notice.

---

## 7. Data model additions (Chef Summary side)

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

  -- chef disposition
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
  suggestion differs from a confirmed value, flag it for re-review rather than
  silently changing it.
- The package row (`weekly_chef_summary`) is written **only** from `final_value`
  once a field is `confirmed`/`overridden` — preserving Chef Summary as owner.

---

## 8. UI changes in Chef Summary

Each pre-fillable field in the guided workflow gains a lightweight "source"
treatment; the existing upload UI stays as the fallback path.

- **Source badge per field:** `Suggested · CGOPS` (with confidence + `as_of`
  freshness), `Confirmed`, `Overridden`, or `Manual`.
- **Confirm / Override controls:** a suggested value renders pre-filled but
  visually distinct (e.g. amber outline) with **Confirm** and **Edit/Override**.
  Confirming writes it to the package; editing flips status to `overridden` and
  optionally captures `override_reason`.
- **"Import from CGOPS" / "Refresh" action** at the start of a package and on each
  relevant step, calling `fetch-cgops-prefill`. Shows what was filled and what
  wasn't.
- **Diff indicator:** when a refreshed suggestion differs from a confirmed value,
  show old→new and let the chef re-confirm or keep theirs.
- **Graceful absence:** if CGOPS returns nothing for a field, the step looks
  exactly as it does today (upload zone), no error.
- **Provenance tooltip:** `source_system` + `source_ref` so a chef/auditor can see
  exactly where a number originated.

---

## 9. Override / audit trail

Captured by the `weekly_prefill` columns above; nothing else needed:

- Original suggestion is **retained** (`suggested_*`) even after override.
- `status`, `final_*`, `override_reason`, `decided_by`, `decided_at` record the
  chef's decision and who made it.
- `source_*` / `fetched_at` record upstream provenance and freshness.
- This yields a per-field, per-week answer to "was this CGOPS or the chef, what
  did CGOPS say, what did the chef do, and when."

---

## 10. Failure handling

The integration is **strictly additive** — the manual upload flow remains the
guaranteed path, so no failure can block a chef from finishing a package.

| Failure | Behaviour |
|---|---|
| CGOPS endpoint down / timeout | Edge fn returns "prefill unavailable"; UI shows manual upload; short retry w/ backoff, then give up gracefully |
| Partial data | Per-field; present fields pre-fill, absent fields fall back to manual |
| Location unmapped | No pre-fill; admin notice to add a `location_external_map` row |
| Fiscal week mismatch | `fields: []` + "no CGOPS data for this week" notice |
| Stale data | `as_of` shown; chef decides; `Refresh` re-fetches |
| Auth failure | Logged; treated as "unavailable"; never surfaces the secret |
| Contract version unknown | Edge fn ignores unrecognized fields, processes known ones |
| Refresh conflicts with confirmed value | Flagged for re-review; confirmed `final_*` never auto-overwritten |

---

## 11. Reverse direction — publishing the final weekly summary

The second half of the two-way integration (Goal/role: CGOPS later **consumes**
the final package). Chef Summary stays the producer:

- On package **publish**, Chef Summary emits a **Weekly Summary Published** event
  with the canonical key and the final, confirmed values (a webhook POST to a
  CGOPS receive endpoint, or a CGOPS-pull endpoint Chef Summary exposes —
  symmetric to §3).
- Payload = the published `weekly_chef_summary` record (+ `weekly_actions`),
  versioned the same way.
- CGOPS ingests it for portfolio roll-ups / executive views; it does **not**
  rebuild the package.
- This closes the loop: CGOPS feeds inputs upstream, Chef Summary owns assembly,
  CGOPS consumes the published result downstream.

---

## 12. A reusable provider pattern (future integrations)

Generalize so CGOPS is simply the **first** prefill provider (Goal 5):

- Define a `PrefillProvider` interface: `getWeeklyPrefill(key) → PrefillResponse`
  (the §3 contract). CGOPS is one implementation behind the
  `fetch-cgops-prefill` edge function; future systems add their own adapter +
  `external_system` value + mapping rows.
- `weekly_prefill.source_system` and `location_external_map.external_system`
  already make storage provider-agnostic.
- A small **capability registry** (which provider supplies which `field_key`s,
  with priority when two providers overlap) lets new feeds slot in without
  touching the workflow UI.

---

## 13. Phased roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Foundations** | Contract v1.0 spec agreed with CGOPS; `location_external_map` + `weekly_prefill` tables; `fetch-cgops-prefill` edge fn + auth handshake; **no UI** | Edge fn fetches & stores suggestions for one pilot location; nothing user-visible |
| **1 — High-confidence pre-fill** | Sales, gross labour, OT/DT + fiscal/location metadata; per-field badge + confirm/override UI; failure fallbacks | A chef completes Section 1 by confirming CGOPS values, with full manual fallback intact |
| **2 — Execution metrics** | Promo/discount totals, speed-of-service, (optional) guest-feedback signal; audit score | Sections 5/6/16 pre-fillable; item-level ignore still chef-driven |
| **3 — Recap baselines** | P&L WTD/PTD/QTD/YTD baselines from CGOPS; CS keeps %/variance/need-to-save math | Recap step pre-filled without a Sage P&L upload, percentages still computed in CS |
| **4 — Reverse publish** | "Weekly Summary Published" event → CGOPS consumes final package | CGOPS portfolio views read published Chef Summary data |
| **5 — Generalize** | `PrefillProvider` interface + capability registry; second provider as proof | A new upstream source adds a feed without workflow-UI changes |

Each phase is shippable on its own and never removes the manual path.

---

## Appendix — anchor references

| Concern | Where |
|---|---|
| Pre-fillable fields / step outputs | `src/components/GuidedWeeklyPackage.tsx` (`GuidedFieldUpdates` @ 934; `STEP_META` @ 21) |
| Derived metrics that stay in CS | `GuidedWeeklyPackage.tsx:5608`, `src/lib/needToSave.ts` |
| Existing report parsers (manual fallbacks) | `GuidedWeeklyPackage.tsx:250/302/525/701/754/834`, `src/lib/csvParser.ts`, `src/lib/excelParser.ts` |
| Edge-function + secret pattern | `supabase/functions/generate-chef-summary/index.ts`, calls @ `…/functions/v1/…` |
| Weekly key & uniqueness | `supabase/migrations/20260518161752_add_unique_constraint_weekly_chef_summary.sql` |
| Locations schema (needs external map) | `supabase/migrations/20260511231355_create_core_tables.sql:42` |
| Companion process audit | `docs/CHEF_SUMMARY_AUDIT.md` |
