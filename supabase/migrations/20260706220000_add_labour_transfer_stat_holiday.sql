/*
  Add a Stat Holiday labour transfer bucket.

  Statutory holiday pay (e.g. Canada Day) lands in the Push labour numbers
  and inflates the chefs' weekly labour percentage. The guided workflow's
  Transfers step now has a "Transfer to Stat Holiday Pay" destination so
  chefs can move it off their weekly labour, mirroring the existing
  vacation / management / other buckets.
*/

ALTER TABLE weekly_chef_summary
  ADD COLUMN IF NOT EXISTS labour_transfer_stat_holiday numeric DEFAULT 0;
