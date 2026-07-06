/*
  Persist the guided workflow's individual labour transfer entry rows.

  The Transfers step previously saved only the summarized totals
  (labour_transfer_vacation/management/other) and generated notes, so
  reopening a saved summary showed a blank entry list even though the
  totals were still applied. Storing the raw entries (annual wage, days,
  destination, reason) lets the guide restore them editable on reopen.

  Stored as a JSON-encoded text blob, matching final_food_cost_items and
  usage_review_items.
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS labour_transfer_entries text DEFAULT '[]';
