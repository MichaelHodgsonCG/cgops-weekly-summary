/*
  # Seed Reference Data

  1. Data Seeded
    - 17 restaurant locations with region and market tier data
    - 4 roles (admin, manager, chef, staff)
    - 14 permissions across Reports, Data, and Admin categories
    - Role-permission assignments (admin gets all permissions)
    - 1 admin user (Michael Hodgson)
    - 3 location groups (Central, Eastern, Western regions)

  2. Notes
    - Uses ON CONFLICT to prevent duplicates on re-run
    - Location UUIDs match legacy production database for data continuity
*/

-- Insert 17 restaurant locations (legacy production UUIDs preserved)
INSERT INTO locations (id, name, code, region, market_tier, exclude_from_reporting) VALUES
  ('b0a1ed33-e1e0-4a2f-8983-ead795a421d5', 'Beertown Barrie', 'BTBA', 'Central', 'B', false),
  ('f6c05055-96ef-45cb-9bb7-53fd0c5dc1b1', 'Beertown Burlington', 'BTB', 'Central', 'B', false),
  ('9ea5c568-ee43-4bcb-9495-0e283c6661a2', 'Beertown Cambridge', 'BTC', 'Western', 'B', false),
  ('2a2f4fec-6d4d-4a42-9516-a2f31b106851', 'Beertown Etobicoke', 'BTE', 'Central', 'A', false),
  ('b78e7e4f-c435-4a78-9d8e-3df39607eac7', 'Beertown Guelph', 'BTG', 'Central', 'A', false),
  ('5d081f00-bbef-4f25-9a2a-b38e53a07c2b', 'Beertown London', 'BTLM', 'Central', 'B', false),
  ('63cad9c6-2fb5-47c3-b00a-3df031b71581', 'Beertown London White Oaks', 'BTLW', 'Western', 'A', false),
  ('9650f62e-e477-4d72-9a0e-c40b58409165', 'Beertown Newmarket', 'BTN', 'Eastern', 'A', false),
  ('490ebcf8-fba4-473d-9214-4cbba2ccdddf', 'Beertown Oakville', 'BTO', 'Central', 'B', false),
  ('e479517a-c31c-42b1-916b-eeec1a7d1790', 'Beertown Toronto', 'BTT', 'Central', 'B', false),
  ('9c0d1f1f-1424-4673-86dd-94d8ed404280', 'Beertown Waterloo', 'BTW', 'Western', 'B', false),
  ('b9dc1f7e-dcd1-4676-806b-ae3d81eb3dea', 'Beertown Whitby', 'BTWH', 'Eastern', 'B', false),
  ('085870e9-a02a-417f-a25c-7145386ca58f', 'Charcoal Group HQ', 'CG', null, null, true),
  ('1a37e5b5-6ef8-4085-98b2-7a880b2278b7', 'Sociable Kitchen Tavern', 'SKT', 'Central', 'A', false),
  ('352eb6eb-4cee-4a4d-be4d-04ebb3a46903', 'Sole', 'SOLE', 'Eastern', 'B', false),
  ('1106fd10-ca2a-41ce-842b-0cf153986f9b', 'The Bauer Kitchen', 'TBK', 'Central', 'B', false),
  ('a5984038-34bd-4347-a399-25da54c353ef', 'Wildcraft', 'WC', 'Eastern', 'B', false)
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
  ('Upload P&L Data', 'pl.upload', 'Upload P&L files for locations', 'Data'),
  ('Manage Locations', 'locations.manage', 'Create, edit, and delete locations', 'Data'),
  ('Manage Fiscal Calendar', 'fiscal.manage', 'Manage fiscal calendar periods', 'Data'),
  ('View Chef Summaries', 'chef.view', 'View weekly chef summaries', 'Reports'),
  ('Manage Chef Summaries', 'chef.manage', 'Create and edit chef summaries', 'Data'),
  ('Manage Users', 'users.manage', 'Create, edit, and delete users', 'Admin'),
  ('Manage Roles', 'roles.manage', 'Create, edit, and delete roles', 'Admin'),
  ('Manage Permissions', 'permissions.manage', 'Assign permissions to roles', 'Admin'),
  ('Manage P&L Adjustments', 'pl.adjust', 'Make adjustments to P&L line items', 'Data')
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
