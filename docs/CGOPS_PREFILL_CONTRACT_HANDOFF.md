# CGOPS Weekly Prefill — Provider Contract (Handoff for CGOPS repo)

Consumer: **Chef Summary**. Provider: **CGOPS Dashboard**.
Contract version: **1.0**. Transport: **HTTPS + JSON**. Access: **read-only**.

Chef Summary calls this once when a weekly package is started or refreshed,
stores the returned values as **suggestions**, and a chef confirms or overrides
each one. Nothing here is final until a chef acts on it. This doc is the exact
consumer expectation — reconcile the provider side against it.

---

## 1. Endpoint

```
GET /v1/weekly-prefill
```

Query parameters (all required except `week_ending_date` which is required for
calendar alignment):

| Param | Type | Notes |
|---|---|---|
| `cgops_location_id` | string | CGOPS's own location id (Chef Summary resolves it, see §7) |
| `fiscal_year` | integer | e.g. `2026` |
| `period_number` | integer | 1–13 |
| `week_number` | integer | week within period |
| `week_ending_date` | string `YYYY-MM-DD` | **Sunday** week-ending; CGOPS aligns its data to this (see §8) |

### Auth
Server-to-server only (Chef Summary calls from a backend function; the credential
is never in a browser). Expected: **OAuth2 client-credentials** (preferred) or a
**signed short-TTL service JWT** in `Authorization: Bearer …`. Scope: read-only
weekly prefill, limited to mapped locations. Auth failure is treated by the
consumer as "unavailable" (no hard error to the chef).

---

## 2. Request payload

None — it's a `GET`. All inputs are the query params in §1.

---

## 3. Response payload

```jsonc
{
  "contract_version": "1.0",
  "key": {
    "cgops_location_id": "cg-0421",
    "fiscal_year": 2026,
    "period_number": 8,
    "week_number": 2,
    "week_ending_date": "2026-06-21"
  },
  "generated_at": "2026-06-30T14:00:00Z",   // ISO 8601 UTC
  "fields": [
    {
      "field_key": "food_sales_labour_push", // from the fixed list in §4
      "value": 72889.00,                      // JSON type per §4
      "unit": "currency",                     // per §4
      "confidence": "high",                   // high | medium | low  (§6)
      "source_system": "push",                // §7 metadata
      "source_ref": "profit_center:2026-06-21",
      "as_of": "2026-06-23T02:00:00Z"         // ISO 8601 UTC
    }
    // …one object per available field
  ],
  "unavailable": ["purchases_bakery_amount"]  // optional; see §5
}
```

Rules:
- Every element of `fields[]` must carry all of: `field_key`, `value`, `unit`,
  `confidence`, `source_system`, `source_ref`, `as_of`.
- `key` must echo the request key exactly.
- Unknown/extra `field_key`s are ignored by the consumer (forward-compatible).
- Percent values use the **whole-number convention**: `24.43` means 24.43%, not
  `0.2443`.
- Currency is a plain JSON number in dollars (2 decimals), negatives as normal
  numbers (`-12.5`), not parenthesized strings.

---

## 4. Exact `field_key` list — unit and value type

`value type` = JSON type. `unit` = semantic unit the consumer expects.
"Confirm?" = chef confirmation required before it lands in the package (always
yes for every field below).

| field_key | unit | value type | Meaning | Confirm? |
|---|---|---|---|---|
| `food_sales_labour_push` | currency | number | Weekly (WTD) food/POS sales total | yes |
| `labour_spent_gross` | currency | number | **Gross** weekly labour $ (consumer subtracts transfers itself → do NOT net transfers) | yes |
| `overtime_amount` | currency | number | Weekly overtime $ | yes |
| `boh_promo_amount` | currency | number | Weekly promo/discount total for the 4 BOH reason categories | yes |
| `qsr_expo_time` | seconds | number (integer) | Expediter avg bump time, **in seconds** (consumer formats to `m:ss`) | yes |
| `window_time` | seconds | number (integer) | Window time, **in seconds** (consumer formats to `m:ss`) | yes |
| `last_audit_score_pct` | percent | number | Latest audit/inspection score % | yes |
| `budget_food_sales_period` | currency | number | Period food-sales budget | yes |
| `labour_budget_pct` | percent | number | Labour budget % | yes |
| `purchases_bakery_amount` | currency | number | GL purchases — Bakery | yes |
| `purchases_dairy_amount` | currency | number | GL purchases — Dairy | yes |
| `purchases_meat_seafood_amount` | currency | number | GL purchases — Meat & Seafood | yes |
| `purchases_other_food_amount` | currency | number | GL purchases — Other Food | yes |
| `purchases_produce_amount` | currency | number | GL purchases — Produce | yes |
| `recap_sales_wtd_actual` | currency | number | P&L baseline: sales actual, week-to-date | yes |
| `recap_sales_wtd_budget` | currency | number | P&L baseline: sales budget, WTD | yes |
| `recap_sales_ytd_actual` | currency | number | P&L baseline: sales actual, year-to-date | yes |
| `recap_sales_ytd_budget` | currency | number | P&L baseline: sales budget, YTD | yes |
| `recap_fc_wtd_pct` | percent | number | Food cost %, WTD | yes |
| `recap_fc_ptd_pct` | percent | number | Food cost %, period-to-date | yes |
| `recap_fc_ytd_pct` | percent | number | Food cost %, YTD | yes |
| `recap_fc_ytd_budget_pct` | percent | number | Food cost budget %, YTD | yes |
| `recap_fc_ytd_variance_amount` | currency | number | Food cost YTD variance $ | yes |
| `recap_labour_wtd_pct` | percent | number | Labour %, WTD | yes |
| `recap_labour_ptd_pct` | percent | number | Labour %, PTD | yes |
| `recap_labour_ytd_pct` | percent | number | Labour %, YTD | yes |
| `recap_labour_ytd_budget_pct` | percent | number | Labour budget %, YTD | yes |
| `recap_labour_ytd_variance_amount` | currency | number | Labour YTD variance $ | yes |

Notes:
- **`labour_spent_gross` is the only non-passthrough key**: it is intentionally
  gross. The consumer computes final `labour_spent = gross − chef transfers`.
- Every other `field_key` matches a Chef Summary field name 1:1.
- **Unit values in use:** `currency`, `percent`, `seconds`. (Reserved for future:
  `integer`, `text`, `time_mmss`.)
- **Optional/future (send only if trivially available; consumer ignores today):**
  `doubletime_amount` (currency/number) and guest-feedback signals
  `guest_feedback_score` (integer) / `guest_feedback_note` (text). Not required
  for v1.0.

---

## 5. Missing vs. unavailable

- **Missing** = the `field_key` is simply **absent** from `fields[]`. Consumer
  falls back to its existing manual upload for that field. No error, no UI noise.
- **Unavailable** = the `field_key` is listed in the top-level `unavailable[]`
  array. Same effect as missing, but the consumer can show "CGOPS reports no data
  for this field this week" instead of just silence. Use this when CGOPS knows a
  source report wasn't run/received.
- A field must never appear in **both** `fields[]` and `unavailable[]`.
- Returning `fields: []` (with or without `unavailable`) is valid and means "no
  prefill this week" → consumer uses fully manual flow.

---

## 6. Confidence labels

`confidence` ∈ `"high" | "medium" | "low"`. It does not change whether
confirmation is required (always required); it only drives UI emphasis/warnings.
Expected mapping:
- `high` — directly normalized from the authoritative source (e.g. Push sales).
- `medium` — derived/aggregated or format-variant-sensitive.
- `low` — best-effort; encourage the chef to scrutinize.

---

## 7. Source metadata shape

Per field, all required:

| key | type | meaning |
|---|---|---|
| `source_system` | string enum | `push` \| `silverware` \| `qsr` \| `accounting` \| `audit` \| `cgops` |
| `source_ref` | string | upstream provenance handle (report id / natural key), stored for audit |
| `as_of` | string ISO 8601 UTC | freshness of the underlying data (shown to chef; drives "stale?" prompts) |
| `confidence` | string enum | see §6 |

---

## 8. Location + fiscal key requirements

**Location**
- Request carries `cgops_location_id` (CGOPS's own id). Chef Summary maintains the
  CGOPS↔ChefSummary mapping on its side; CGOPS only needs to key by its own id.
- If CGOPS cannot resolve the id → return `fields: []` (consumer treats as no
  prefill).

**Fiscal / weekly key**
- Canonical weekly key: `location + fiscal_year + period_number + week_number`.
- Chef Summary **owns the fiscal calendar** and additionally sends
  `week_ending_date` (Sunday). CGOPS must **align its data to `week_ending_date`**
  rather than to its own period math, and echo the full `key` back.
- If CGOPS can't map that week → return `fields: []`.

---

## 9. UI confirmation / override expectations (consumer side — informational)

So the provider understands how values are used:
- Each field renders as a **suggestion** (badge: `Suggested · CGOPS`, with
  `confidence` and `as_of`), pre-filled but visually distinct, with **Confirm**
  and **Override/Edit**.
- Confirm → value written to the package as-is. Override → chef edits; original
  suggestion retained; optional `override_reason`.
- **Refresh** re-fetches; a suggestion that changed vs. an already-confirmed value
  is flagged for re-review and **never auto-overwrites** the confirmed value.
- Absence of a field degrades gracefully to the existing manual upload.
- Provider implication: values must be **stable and idempotent** for a given key
  (same key → same value unless the underlying data genuinely changed), and
  `as_of` must reflect real data freshness.

---

## 10. Data the consumer stores per imported field

Chef Summary persists one `weekly_prefill` row per
`(location_id, fiscal_year, period_number, week_number, field_key)`:

| column | source |
|---|---|
| `suggested_value` / `suggested_text` | response `value` |
| `unit` | response `unit` |
| `confidence` | response `confidence` |
| `source_system` | response `source_system` |
| `source_ref` | response `source_ref` |
| `source_as_of` | response `as_of` |
| `fetched_at` | consumer clock at fetch |
| `status` | `suggested` \| `confirmed` \| `overridden` \| `dismissed` \| `missing` |
| `final_value` / `final_text` | chef's confirmed/overridden value (written to package) |
| `override_reason` | chef, optional |
| `decided_by` / `decided_at` | chef + timestamp |

Only `final_*` (once `confirmed`/`overridden`) is written into the
`weekly_chef_summary` package row — Chef Summary remains the owner of final
values.

---

## 11. Failure handling (consumer behavior — for provider awareness)

| Situation | Consumer does |
|---|---|
| Endpoint down / timeout | Short retry w/ backoff, then "prefill unavailable"; manual flow proceeds |
| Partial data | Per-field fallback to manual for absent fields |
| `fields: []` | Fully manual week |
| Unknown `field_key` | Ignored |
| Auth failure | Treated as unavailable; secret never surfaced |
| Refresh conflicts w/ confirmed value | Flag for re-review; never auto-overwrite |

The integration is strictly additive — a provider outage can never block a chef
from completing a weekly package.
