/*
  Restate stored food cost usage WITHOUT subtracting waste.

  The app previously computed actual usage as
      Opening + GL Purchases - Closing - Waste
  which understated usage (waste is part of what was consumed). The app
  formula is now
      Opening + GL Purchases - Closing
  and this migration restates already-saved summaries the same way.

  How it works — and why it is safe to run more than once:
  - Only touches weekly_chef_summary rows whose final_food_cost_items is a
    JSON object with a categories array (i.e. rows produced by the guided
    workflow's food cost step, which used the old formula). Legacy/imported
    rows without that JSON are left untouched.
  - Usage is RECOMPUTED from each category's stored raw inputs
    (opening, glPurchases, closing) rather than by adding waste back, so
    re-running the migration yields the same result (idempotent).
  - Recomputes the dependent stored figures from the new usage:
    per-category actualUsage / variance / pctActualUsage / pctVariance in
    the JSON, and the row-level usage_amount, actual_food_cost_pct,
    fc_variance, and theoretical_variance columns.
  - waste_amount and the per-category waste values are kept as-is: waste
    stays reported, it just no longer reduces usage.
*/

WITH candidate AS MATERIALIZED (
  -- Restrict to object-form JSON before casting so invalid/legacy values
  -- ('', '[]', plain arrays) can never make the ::jsonb cast fail.
  SELECT id, final_food_cost_items AS raw
  FROM weekly_chef_summary
  WHERE final_food_cost_items LIKE '{%'
),
parsed AS MATERIALIZED (
  SELECT id, raw::jsonb AS j
  FROM candidate
),
valid AS (
  SELECT id, j
  FROM parsed
  WHERE jsonb_typeof(j->'categories') = 'array'
),
recomputed AS (
  SELECT
    v.id,
    v.j,
    (
      SELECT COALESCE(jsonb_agg(
        c || jsonb_build_object(
          'actualUsage', u.au,
          'variance', u.au - COALESCE((c->>'idealUsage')::numeric, 0),
          'pctActualUsage',
            CASE WHEN COALESCE((v.j->>'pushSales')::numeric, 0) <> 0
                 THEN u.au / (v.j->>'pushSales')::numeric * 100
                 ELSE 0 END,
          'pctVariance',
            CASE WHEN COALESCE((v.j->>'pushSales')::numeric, 0) <> 0
                 THEN (u.au - COALESCE((c->>'idealUsage')::numeric, 0)) / (v.j->>'pushSales')::numeric * 100
                 ELSE 0 END
        )
      ), '[]'::jsonb)
      FROM jsonb_array_elements(v.j->'categories') AS c
      CROSS JOIN LATERAL (
        SELECT COALESCE((c->>'opening')::numeric, 0)
             + COALESCE((c->>'glPurchases')::numeric, 0)
             - COALESCE((c->>'closing')::numeric, 0) AS au
      ) u
    ) AS new_categories,
    (
      SELECT COALESCE(SUM(
        COALESCE((c->>'opening')::numeric, 0)
        + COALESCE((c->>'glPurchases')::numeric, 0)
        - COALESCE((c->>'closing')::numeric, 0)
      ), 0)
      FROM jsonb_array_elements(v.j->'categories') AS c
    ) AS new_usage
  FROM valid v
)
UPDATE weekly_chef_summary w
SET
  final_food_cost_items = jsonb_set(r.j, '{categories}', r.new_categories)::text,
  usage_amount = r.new_usage,
  actual_food_cost_pct = CASE
    WHEN w.food_sales_labour_push > 0 THEN r.new_usage / w.food_sales_labour_push * 100
    ELSE w.actual_food_cost_pct
  END,
  fc_variance = CASE
    WHEN w.food_sales_labour_push > 0
    THEN r.new_usage / w.food_sales_labour_push * 100 - w.budget_food_cost_pct
    ELSE w.fc_variance
  END,
  theoretical_variance = CASE
    WHEN w.food_sales_labour_push > 0
    THEN r.new_usage / w.food_sales_labour_push * 100 - w.theoretical_food_cost_pct
    ELSE w.theoretical_variance
  END,
  updated_at = now()
FROM recomputed r
WHERE w.id = r.id;
