/*
  # Seed Reference Data

  1. Data Seeded
    - 16 restaurant locations with region and market tier data
    - 4 roles (admin, manager, chef, staff)
    - 20 permissions across Reports, Data, and Admin categories
    - Role-permission assignments (admin gets all permissions)
    - 1 admin user (Michael Hodgson)
    - 3 location groups (Central, Eastern, Western regions)

  2. Notes
    - Uses ON CONFLICT to prevent duplicates on re-run
    - Location regions and market tiers assigned based on geography
*/

-- Insert 16 restaurant locations
INSERT INTO locations (name, code, region, market_tier) VALUES
  ('Beertown Barrie', 'BARRIE', 'Western', 'B'),
  ('Beertown Burlington', 'BURLINGTON', 'Central', 'B'),
  ('Beertown Etobicoke', 'ETOBICOKE', 'Central', 'A'),
  ('Beertown Hamilton', 'HAMILTON', 'Western', 'B'),
  ('Beertown King West', 'KINGWEST', 'Central', 'A'),
  ('Beertown London', 'LONDON', 'Western', 'A'),
  ('Beertown Markham', 'MARKHAM', 'Central', 'B'),
  ('Beertown Mississauga', 'MISSISSAUGA', 'Central', 'B'),
  ('Beertown Oakville', 'OAKVILLE', 'Central', 'B'),
  ('Beertown Ottawa', 'OTTAWA', 'Eastern', 'A'),
  ('Beertown Pickering', 'PICKERING', 'Eastern', 'B'),
  ('Beertown Scarborough', 'SCARBOROUGH', 'Eastern', 'B'),
  ('Beertown Vaughan', 'VAUGHAN', 'Central', 'B'),
  ('Beertown Waterloo', 'WATERLOO', 'Western', 'B'),
  ('Beertown Whitby', 'WHITBY', 'Eastern', 'B'),
  ('Beertown York', 'YORK', 'Central', 'A')
ON CONFLICT (code) DO NOTHING;

-- Insert default roles
INSERT INTO roles (name) VALUES
  ('admin'),
  ('manager'),
  ('chef'),
  ('staff')
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (name, code, description, category) VALUES
  ('View Dashboard', 'dashboard.view', 'Access main dashboard with P&L summaries', 'Reports'),
  ('View Portfolio', 'portfolio.view', 'View portfolio-wide metrics and summaries', 'Reports'),
  ('View Rankings', 'rankings.view', 'View location performance rankings', 'Reports'),
  ('View Trends', 'trends.view', 'View trend analysis across periods', 'Reports'),
  ('View Comparisons', 'comparison.view', 'Compare multiple locations', 'Reports'),
  ('View Alerts', 'alerts.view', 'View automated alerts and notifications', 'Reports'),
  ('View SLP Data', 'slp.view', 'View Store Level P&L data', 'Reports'),
  ('View Guest Feedback', 'feedback.view', 'View guest feedback reports', 'Reports'),
  ('Upload P&L Data', 'pl.upload', 'Upload P&L files for locations', 'Data'),
  ('Upload SLP Data', 'slp.upload', 'Upload Store Level P&L data', 'Data'),
  ('Process Emails', 'email.process', 'Process incoming email data', 'Data'),
  ('View Logs', 'logs.view', 'View system logs and data processing history', 'Data'),
  ('Manage Locations', 'locations.manage', 'Create, edit, and delete locations', 'Data'),
  ('Manage Location Mappings', 'mappings.manage', 'Manage location name mappings', 'Data'),
  ('Manage Fiscal Calendar', 'fiscal.manage', 'Manage fiscal calendar periods', 'Data'),
  ('View Chef Summaries', 'chef.view', 'View weekly chef summaries', 'Reports'),
  ('Manage Chef Summaries', 'chef.manage', 'Create and edit chef summaries', 'Data'),
  ('Manage Users', 'users.manage', 'Create, edit, and delete users', 'Admin'),
  ('Manage Roles', 'roles.manage', 'Create, edit, and delete roles', 'Admin'),
  ('Manage Permissions', 'permissions.manage', 'Assign permissions to roles', 'Admin')
ON CONFLICT (code) DO NOTHING;

-- Grant all permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE LOWER(r.name) = 'admin'
ON CONFLICT DO NOTHING;

-- Insert initial admin user
INSERT INTO users (name, pin, role)
VALUES ('Michael Hodgson', '179321', 'admin')
ON CONFLICT (pin) DO NOTHING;

-- Insert location groups
INSERT INTO location_groups (name, description, group_type) VALUES
  ('Central Region', 'Central Ontario locations', 'regional'),
  ('Eastern Region', 'Eastern Ontario locations', 'regional'),
  ('Western Region', 'Western Ontario locations', 'regional')
ON CONFLICT DO NOTHING;
