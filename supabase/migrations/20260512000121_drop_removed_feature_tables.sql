/*
  # Drop removed feature tables

  Removes tables for features that have been removed from the application:
  
  1. SLP tables: slp_promo_data, slp_labor_data, slp_sales_data, slp_reports
  2. Logs tables: daily_insights, daily_logbook
  3. Reviews tables: dismissed_alerts, guest_feedback, location_mappings
  4. Email: raw_emails
  5. Unused: performance_alerts, performance_benchmarks, location_rankings

  All tables are currently empty (0 rows). No data loss.
*/

DROP TABLE IF EXISTS slp_promo_data;
DROP TABLE IF EXISTS slp_labor_data;
DROP TABLE IF EXISTS slp_sales_data;
DROP TABLE IF EXISTS slp_reports;
DROP TABLE IF EXISTS daily_insights;
DROP TABLE IF EXISTS daily_logbook;
DROP TABLE IF EXISTS dismissed_alerts;
DROP TABLE IF EXISTS guest_feedback;
DROP TABLE IF EXISTS location_mappings;
DROP TABLE IF EXISTS raw_emails;
DROP TABLE IF EXISTS performance_alerts;
DROP TABLE IF EXISTS performance_benchmarks;
DROP TABLE IF EXISTS location_rankings;
