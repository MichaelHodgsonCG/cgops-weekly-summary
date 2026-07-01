# Weekly Summary (formerly Chef Summary) Process — Audit & Data Flow

_Last reviewed: 2026-06-30_

> **Naming transition:** the application historically called **"Chef Summary"** is
> becoming **"Weekly Summary"** as it broadens beyond chefs to serve Executive
> Chefs, Beverage Managers, General Managers, and potentially other departments.
> This audit describes the **current** app, so it still references "chef"-era code
> identifiers verbatim (the `weekly_chef_summary` table, `ChefSummary*` components,
> the `food_sales_labour_push` column) — those are unchanged until a deliberate
> code rename. Read "chef" as "the manager completing the package."

This document audits how the weekly package ("Culinary Performance Summary")
is assembled: where each number comes from, what format it arrives in, how the
guided weekly package is structured, which steps are still manual, where we can
automate, and — for the dashboard initiative — the formatting and structural
constraints that any downstream consumer has to respect.

It is written from the code as it exists today (`src/lib/*`,
`src/components/GuidedWeeklyPackage.tsx`, `supabase/functions/*`,
`supabase/migrations/*`). File/line references are included so each claim can be
verified.

---

## 1. Source systems and data formats

Every input to a weekly package comes from one of five external systems. None of
them are integrated by API today — in all cases an operator runs a report,
exports a file, and uploads it into the guided workflow, which parses it
client-side in the browser.

| Source system | What it provides | Export path (as shown in-app) | File format | Parser |
|---|---|---|---|---|
| **Push** (labour + POS sales) | Daily/weekly **sales total, labour $ spent, overtime, doubletime** | `Push > Reports > Sales > Profit Center Report > Select Dates > Run > Download as Excel` | **XLSX** — must contain a sheet literally named **`BOH`** | `parseProfitCenterReport` (`GuidedWeeklyPackage.tsx:250`) |
| **Silverware** (POS) | **Discounts** by reason/item → BOH promo $. Also the **origin POS food-sales source** that feeds both Push and OC (see note below) | `Silverware > Loss Prevention > Discounts > Select Dates > Major Classes: FOOD-ADD-ONS, FOOD-APPS, FOOD-DESSERTS, FOOD-ENTREES > CSV` | **CSV** — two known variants (see §6) | `parseDiscountsReport` (`GuidedWeeklyPackage.tsx:302`) |
| **Optimum Control (OC)** (inventory / recipe costing) | **Usage** (over/under + group totals), **GL purchases**, **final food cost / variance**, COGS task checklist, transfer standards | `OC > Reports > …` (Usage Summary, General Ledger, Invoice Account Balances, Period-End variance) | **CSV** (wide, positional columns) | `parseUsageReport`, `parsePurchasesReport`, `parseFoodCostReport` (`GuidedWeeklyPackage.tsx:701`, `754`, `834`) |
| **QSR / Speed of Service** | Expediter / window / expo / pivot **bump times** by meal period | "Speed of Service Summary report (CSV)" | **CSV** — two known variants (header vs. headerless positional) | `parseSpeedOfServiceReport` (`GuidedWeeklyPackage.tsx:525`) |
| **Sage / accounting P&L** | Weekly **P&L line items** (sales, food cost, kitchen labour, supplies, EBITDA …) used as the recap/"need-to-save" baseline | Uploaded via the P&L upload page | **CSV or XLSX** — two layouts (multi-week "Week Ending" vs. single "As of") | `parseCSV` (`csvParser.ts:383`), `parseExcel` (`excelParser.ts:379`) |

Key takeaway: **the entire pipeline is export-file-driven.** There is no live
connection to any source system; correctness depends on operators picking the
right report, date range, and export option, and on the file matching the exact
shape the parsers expect.

### Food sales is three lineages, not one number — by design

**Silverware is the origin POS sales source**, and it feeds both **Push** and
**Optimum Control**. These are intentionally tracked as separate measures:

- **`food_sales_labour_push`** — Push food sales (from the Profit Center Report).
  Should match Silverware/Sage; used as the **labour-reporting denominator**.
  (Historically the column was `food_sales_silverware`, renamed in
  `20260617000001_rename_food_sales_silverware.sql`.)
- **`food_sales_oc`** — Optimum Control food sales (from the OC food-cost report,
  `parseFoodCostReport`). OC links sales to **products**, so if a menu item isn't
  linked to a product, OC sales can legitimately diverge from Silverware/Push/Sage.
- **`week_variance_amount`** = `food_sales_labour_push − food_sales_oc`
  (`GuidedWeeklyPackage.tsx:5637`) — an **intentional reconciliation/control
  metric**. A small tolerance is expected noise; **excessive variance is an
  operational flag** for item-linking / product-setup issues that need
  investigation. It is not a duplicate-field naming conflict and must not be
  collapsed.

### Format conventions the parsers assume

- **Currency/number cells** may include `$`, thousands commas, and parentheses or
  a leading `-` for negatives. `parseNumber`/`parseCurrency` strip symbols and
  treat `(1,234)` and `-1234` identically as negative
  (`chefSummaryParser.ts:86`, `csvParser.ts:55`, `GuidedWeeklyPackage.tsx:694`).
- **Percentages** are stored as **whole numbers** (e.g. `24.43`, not `0.2443`).
  Note an asymmetry: CSV percentages are taken at face value, but Excel numeric
  percentages are multiplied by 100 (`excelParser.ts:23`). Anything feeding the
  dashboard must follow the whole-number convention.
- **Week-ending dates** are always normalized to the **Sunday** of the week,
  regardless of the source date (`csvParser.ts:423`, `excelParser.ts:78`).
- **Free text** is sanitized — smart quotes, en/em dashes and stray control
  bytes are folded to ASCII (`chefSummaryParser.ts:124`).

---

## 2. The weekly package: structure

The guided workflow (`GuidedWeeklyPackage.tsx`) is the canonical assembly
process. It is organized as **11 sections / 17 steps** (`STEP_META`,
`GuidedWeeklyPackage.tsx:21`). For each step below: **[A]** = automated from an
uploaded file, **[M]** = manual entry/judgement, **[C]** = calculated/derived.

| # | Section | Step | Inputs & source | A/M/C |
|---|---|---|---|---|
| 1 | Sales & Labour | Budget & Sales Upload | Sales budget + labour budget % (typed); Profit Center Report from **Push** → sales, labour, OT | M + A |
| 2 | Sales & Labour | Labour Transfers | Vacation/management/other transfers (annual wage × days), reasons | M |
| 3 | Sales & Labour | Overtime | OT/doubletime pulled from Step-1 Push file; chef notes | A + M |
| 4 | Sales & Labour | Labour Review | Labour action plan narrative; uses P&L baseline | M + C |
| 5 | Sales & Execution | Discounts | Discounts CSV from **Silverware** → BOH promo $; chef can ignore items | A + M |
| 6 | Sales & Execution | Speed of Service | Speed-of-Service CSV from **QSR** → expo/window times | A |
| 7 | Sales & Execution | Sales & Execution Recap | P&L baseline + action plan narrative | C + M |
| 8 | COGs | COGs Checklist | **OC** task confirmations (incl. petty cash, brownie-on-us invoice) | M |
| 9 | Purchases | Purchases | GL report CSV from **OC** → purchases by category | A |
| 10 | Usage Review | Over/Under Usage Review | Two **OC** Usage CSVs (week + 4-week); confirm/comment per item | A + M |
| 11 | Final Food Cost | Final Food Cost Report | **OC** food-cost CSV → opening/closing/waste/ideal by category; usage recomputed with GL purchases | A + C |
| 12 | Final Food Cost | Food Cost Recap & Action Plan | FCAP top-10 paste from OC period-end variance; per-item plan | M + C |
| 13 | Team | Team Staffing & Notes | Ideal/current headcount, hiring, dev-path, MOTs | M |
| 14 | Facilities | R&M and Cleaning | R&M issues, cleaning focus | M |
| 15 | Features | Feature Items | Feature name/sold/notes | M |
| 16 | Audit | Last Audit Score | Score (auto-prefilled from prior week, editable) + comment | M (assisted) |
| 17 | Recap | Weekly Recap | WTD/PTD/QTD/YTD roll-up + AI summary generation | C + A |

### Derived/calculated values worth calling out

- **Actual / theoretical food cost %** = usage ÷ push sales and ideal-usage ÷
  push sales (`GuidedWeeklyPackage.tsx:5608`).
- **Labour cost %** = labour spent ÷ push sales; **labour spent** = Push labour
  total minus vacation/management/other transfers (`GuidedWeeklyPackage.tsx:1237`).
- **"Need to save" per week/day** — picks the worst-performing horizon (YTD →
  QTD → period) that is over budget and divides the dollar variance by fiscal
  weeks remaining (`needToSave.ts:182`). Fiscal weeks come from the
  `fiscal_calendar` table.
- **QTD roll-ups** combine the most recent P&L upload with prior-period closes
  (`needToSave.ts:430`).

---

## 3. Persistence (data model)

- **`weekly_chef_summary`** — one row per `location_id + fiscal_year +
  period_number + week_number` (unique constraint added in
  `20260518161752_add_unique_constraint_weekly_chef_summary.sql`). This is the
  primary record the dashboard should read.
- **`weekly_actions`** — "Actions for the Week Ahead" rows (delete-and-reinsert
  per week).
- **`pl_uploads` / `pl_line_items`** — parsed Sage P&L, the baseline source for
  recap and need-to-save.
- **`fiscal_calendar`** — period/week → end-date mapping driving all
  weeks-remaining math.
- Several columns hold **JSON-encoded text**, not relational data:
  `usage_review_items`, `final_food_cost_items`, `feature_items`. Consumers must
  `JSON.parse` these.

The migration history shows the schema has been extended incrementally as the
guided workflow grew (recap metric fields, speed-of-service notes, discount
review notes, COGS checklist, purchases, food-cost action plans, etc. — see
`supabase/migrations/2026061*`/`2026062*`).

---

## 4. Outputs

- **PDF export** (`chefSummaryExport.ts:284`) — the polished multi-page "Culinary
  Performance Summary": Tier-1 variance callouts, WTD/PTD/QTD trend tables, COGS
  by category, people/service page, "Actions for the Week Ahead", and a landscape
  Food Cost Action Plan. Variance color bands: green ≤ 0.5, amber ≤ 2.0, red
  beyond (`chefSummaryExport.ts:247`).
- **Excel export** (`exportChefSummaryToExcel`, `chefSummaryExport.ts:134`) — the
  legacy flat-grid template; this is also the shape `chefSummaryParser.ts` can
  re-import (legacy vs. current layouts auto-detected at
  `chefSummaryParser.ts:141`).
- **AI summaries** (`supabase/functions/generate-chef-summary`) — three voices
  (analyst / chef first-person / forward-looking actions) via **OpenAI
  `gpt-4o-mini`**. Two further functions (`generate-executive-summary`,
  `generate-executive-statements`) roll summaries up for leadership.
- **Dashboards** — `ChefSummaryDashboard`, `WeeklyExecutiveReport`,
  `PortfolioView`, `ComparisonView`, `TrendsView`, `RankingsView` all read
  `weekly_chef_summary`.

---

## 5. Manual steps (inventory)

Steps that today require human typing or judgement, ranked roughly by effort/risk:

1. **Budget inputs** — sales budget and labour budget % typed each week (Step 1).
2. **Labour transfers** — annual wage, days, destination, reason per entry (Step 2).
3. **All narrative fields** — labour/sales/food-cost summaries, action plans,
   hiring/dev-path/MOT notes, R&M, cleaning, audit comment, feature notes.
4. **COGS checklist** — confirmations plus the multi-step "brownie-on-us"
   intercompany invoice procedure and petty cash amount (Step 8).
5. **Discount item exclusions** — chef toggles which discounts don't count toward
   BOH promo (Step 5).
6. **Usage review** — confirm/comment on each flagged over/under item (Step 10).
7. **FCAP top-10** — copy-pasted from the OC "Total Variance Including Waste —
   Period End" report (Step 12).
8. **Audit score** — prefilled from the prior week but manually corrected (Step 16).
9. **Triggering AI summary generation** and reviewing/editing the output.
10. **Running and uploading all seven source reports** themselves — the
    export-and-upload cycle is manual for every source system.

---

## 6. Fragility / automation opportunities

**Brittle positional parsing.** Several parsers depend on fixed column indices
and exact label strings:
- The food-cost parser reads hard-coded OC columns (`row[53]`, `row[66..74]` —
  `GuidedWeeklyPackage.tsx:754`) and usage reads `row[35]`/`row[39]`.
- The Push parser requires a sheet named exactly `BOH` and rows literally labelled
  `Sales Total` / `Labor Total` (`GuidedWeeklyPackage.tsx:260`).
- The P&L parsers key on substrings like `Total Sales - Food`, `Cost Of Product`,
  `IHP Substandard Product` and require ≥12–13 columns.

Any change to an upstream export template silently drops a line item or throws.
The discount and speed-of-service parsers already carry **two format variants
each** plus heuristics for site-specific View names
(`GuidedWeeklyPackage.tsx:455`, `597`) — evidence that format drift is a recurring
maintenance cost.

**Highest-value automations:**
1. **Direct integrations** to replace export-file uploads — Push, Silverware, OC,
   and Sage all have the data; API/SFTP feeds would remove ~7 manual report pulls
   per location per week and eliminate the format-drift problem.
2. **Scheduled P&L ingestion** so recap/need-to-save baselines are always current
   without a manual upload.
3. **Eliminate the FCAP copy-paste** (Step 12) by parsing the same OC period-end
   variance report the operator is already copying from.
4. **Auto-carry the audit score** from the audit system rather than prefilling
   last week's number.
5. **Schema-tolerant parsing** — match columns by header name rather than fixed
   index, and surface a clear "this report's format changed" error instead of a
   silent miss.
6. **Standardize the AI layer** — all three edge functions call OpenAI
   `gpt-4o-mini`; consolidating providers/models is a clean future cleanup.

---

## 7. Dashboard ingestion — formatting & structural constraints

For feeding the Chef Summary into the dashboard, respect these constraints:

1. **Canonical record & key.** Read from `weekly_chef_summary`, keyed on
   `location_id + fiscal_year + period_number + week_number`. That tuple is unique
   and is what every existing view joins on. Note `location_id` is a **UUID**,
   distinct from the `location_code` (e.g. `BTB`) that appears in CSV exports.
2. **Percentages are whole numbers** (`24.43` = 24.43%). Do not re-multiply.
   Mind the CSV-vs-Excel ×100 asymmetry (`excelParser.ts:23`) if you ever ingest
   raw files rather than the stored row.
3. **Currency is a plain number**, already sign-corrected (parentheses →
   negative). No symbol stripping needed downstream.
4. **Dates are the Sunday week-ending**, ISO `YYYY-MM-DD`. Align the dashboard's
   week bucketing to Sunday or joins to `fiscal_calendar` will be off by a week.
5. **JSON-text columns** (`usage_review_items`, `final_food_cost_items`,
   `feature_items`) must be parsed, with empty/invalid JSON tolerated — the app
   already guards these with try/catch.
6. **WTD vs PTD vs QTD vs YTD** are distinct fields with different meanings; the
   AI prompts deliberately headline **WTD** for a weekly report
   (`generate-chef-summary/index.ts:28`). The dashboard should label horizons
   explicitly and not mix them.
7. **Variance semantics & color bands** — mirror the existing convention
   (green ≤ 0.5pt, amber ≤ 2.0pt, red beyond; "good is high" for sales, "good is
   low" for cost %) so the dashboard tells the same story as the PDF
   (`chefSummaryExport.ts:247`).
8. **Sparse/optional fields.** Many columns are nullable or zero-defaulted
   (legacy imports never captured weeks-remaining or need-to-save —
   `chefSummaryParser.ts:406`). Treat `0`/`null`/`—` as "not reported" rather than
   a real value.
9. **Derived metrics aren't all stored** — actual/theoretical food cost % and
   labour % are computed at export time from usage/ideal/labour ÷ push sales. If
   the dashboard needs them it should either read the stored fields where present
   or replicate the same formulas (`GuidedWeeklyPackage.tsx:5608`).
10. **Free text is pre-sanitized** to ASCII; the dashboard can render it directly
    but should still treat it as untrusted user input for display.

---

## Appendix — key files

| Area | File |
|---|---|
| Guided weekly workflow (all 17 steps, all report parsers) | `src/components/GuidedWeeklyPackage.tsx` |
| Sage P&L parsers | `src/lib/csvParser.ts`, `src/lib/excelParser.ts` |
| Chef-summary import/parse (legacy + current) | `src/lib/chefSummaryParser.ts` |
| Need-to-save / QTD baselines | `src/lib/needToSave.ts` |
| PDF + Excel export | `src/lib/chefSummaryExport.ts` |
| AI summaries (analyst/chef/actions) | `supabase/functions/generate-chef-summary/index.ts` |
| Executive roll-ups | `supabase/functions/generate-executive-summary`, `…/generate-executive-statements` |
| Schema | `supabase/migrations/*` |
