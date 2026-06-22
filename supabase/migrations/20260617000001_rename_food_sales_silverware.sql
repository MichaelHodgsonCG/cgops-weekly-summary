/*
  Rename food_sales_silverware to food_sales_labour_push on weekly_chef_summary
  to match updated business terminology.
*/

ALTER TABLE weekly_chef_summary
  RENAME COLUMN food_sales_silverware TO food_sales_labour_push;
