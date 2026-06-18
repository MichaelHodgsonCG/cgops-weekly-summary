/*
  Add Purchases fields to weekly_chef_summary to support the Guided Weekly
  Package's Purchases step (Section 4, Step 1), where chefs confirm all
  invoices are on the invoice report and upload a General Ledger CSV to
  capture Bakery, Dairy, Meat And Seafood, Other Food, and Produce totals.
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS purchases_invoices_confirmed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS purchases_bakery_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchases_dairy_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchases_meat_seafood_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchases_other_food_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchases_produce_amount numeric DEFAULT 0;
