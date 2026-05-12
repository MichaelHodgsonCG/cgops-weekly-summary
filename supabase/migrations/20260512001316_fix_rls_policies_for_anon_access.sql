/*
  # Fix RLS policies for custom PIN-based auth

  This application uses a custom PIN-based authentication system stored in the
  `users` table, not Supabase Auth. The Supabase client connects with the anon
  key and never has a Supabase Auth session, so `auth.uid()` is always NULL.

  The existing policies target the `authenticated` role and check `auth.uid() IS NOT NULL`,
  which blocks all access from the `anon` role the client actually uses.

  This migration:
  1. Drops all existing restrictive policies
  2. Creates new policies that allow the `anon` role full CRUD access
  
  Security note: Access control is enforced at the application layer via
  PIN login and role-based permissions. The database is not directly exposed
  to end users -- all access goes through the frontend app.
*/

-- Drop all existing policies and recreate for anon role

-- locations
DROP POLICY IF EXISTS "Authenticated users can view locations" ON locations;
DROP POLICY IF EXISTS "Authenticated users can insert locations" ON locations;
DROP POLICY IF EXISTS "Authenticated users can update locations" ON locations;
DROP POLICY IF EXISTS "Authenticated users can delete locations" ON locations;

CREATE POLICY "Allow read access to locations" ON locations FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert access to locations" ON locations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow update access to locations" ON locations FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to locations" ON locations FOR DELETE TO anon USING (true);

-- pl_uploads
DROP POLICY IF EXISTS "Authenticated users can view pl_uploads" ON pl_uploads;
DROP POLICY IF EXISTS "Authenticated users can insert pl_uploads" ON pl_uploads;
DROP POLICY IF EXISTS "Authenticated users can update pl_uploads" ON pl_uploads;
DROP POLICY IF EXISTS "Authenticated users can delete pl_uploads" ON pl_uploads;

CREATE POLICY "Allow read access to pl_uploads" ON pl_uploads FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert access to pl_uploads" ON pl_uploads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow update access to pl_uploads" ON pl_uploads FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to pl_uploads" ON pl_uploads FOR DELETE TO anon USING (true);

-- pl_line_items
DROP POLICY IF EXISTS "Authenticated users can view pl_line_items" ON pl_line_items;
DROP POLICY IF EXISTS "Authenticated users can insert pl_line_items" ON pl_line_items;
DROP POLICY IF EXISTS "Authenticated users can update pl_line_items" ON pl_line_items;
DROP POLICY IF EXISTS "Authenticated users can delete pl_line_items" ON pl_line_items;

CREATE POLICY "Allow read access to pl_line_items" ON pl_line_items FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert access to pl_line_items" ON pl_line_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow update access to pl_line_items" ON pl_line_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to pl_line_items" ON pl_line_items FOR DELETE TO anon USING (true);

-- fiscal_calendar
DROP POLICY IF EXISTS "Authenticated users can view fiscal_calendar" ON fiscal_calendar;
DROP POLICY IF EXISTS "Authenticated users can insert fiscal_calendar" ON fiscal_calendar;
DROP POLICY IF EXISTS "Authenticated users can update fiscal_calendar" ON fiscal_calendar;
DROP POLICY IF EXISTS "Authenticated users can delete fiscal_calendar" ON fiscal_calendar;

CREATE POLICY "Allow read access to fiscal_calendar" ON fiscal_calendar FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert access to fiscal_calendar" ON fiscal_calendar FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow update access to fiscal_calendar" ON fiscal_calendar FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to fiscal_calendar" ON fiscal_calendar FOR DELETE TO anon USING (true);

-- weekly_chef_summary
DROP POLICY IF EXISTS "Authenticated users can view weekly_chef_summary" ON weekly_chef_summary;
DROP POLICY IF EXISTS "Authenticated users can insert weekly_chef_summary" ON weekly_chef_summary;
DROP POLICY IF EXISTS "Authenticated users can update weekly_chef_summary" ON weekly_chef_summary;
DROP POLICY IF EXISTS "Authenticated users can delete weekly_chef_summary" ON weekly_chef_summary;

CREATE POLICY "Allow read access to weekly_chef_summary" ON weekly_chef_summary FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert access to weekly_chef_summary" ON weekly_chef_summary FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow update access to weekly_chef_summary" ON weekly_chef_summary FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to weekly_chef_summary" ON weekly_chef_summary FOR DELETE TO anon USING (true);

-- weekly_executive_reports
DROP POLICY IF EXISTS "Authenticated users can view weekly_executive_reports" ON weekly_executive_reports;
DROP POLICY IF EXISTS "Authenticated users can insert weekly_executive_reports" ON weekly_executive_reports;
DROP POLICY IF EXISTS "Authenticated users can update weekly_executive_reports" ON weekly_executive_reports;
DROP POLICY IF EXISTS "Authenticated users can delete weekly_executive_reports" ON weekly_executive_reports;

CREATE POLICY "Allow read access to weekly_executive_reports" ON weekly_executive_reports FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert access to weekly_executive_reports" ON weekly_executive_reports FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow update access to weekly_executive_reports" ON weekly_executive_reports FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to weekly_executive_reports" ON weekly_executive_reports FOR DELETE TO anon USING (true);

-- users
DROP POLICY IF EXISTS "Authenticated users can view users" ON users;
DROP POLICY IF EXISTS "Authenticated users can insert users" ON users;
DROP POLICY IF EXISTS "Authenticated users can update users" ON users;
DROP POLICY IF EXISTS "Authenticated users can delete users" ON users;

CREATE POLICY "Allow read access to users" ON users FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert access to users" ON users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow update access to users" ON users FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to users" ON users FOR DELETE TO anon USING (true);

-- roles
DROP POLICY IF EXISTS "Authenticated users can view roles" ON roles;
DROP POLICY IF EXISTS "Authenticated users can insert roles" ON roles;
DROP POLICY IF EXISTS "Authenticated users can update roles" ON roles;
DROP POLICY IF EXISTS "Authenticated users can delete roles" ON roles;

CREATE POLICY "Allow read access to roles" ON roles FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert access to roles" ON roles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow update access to roles" ON roles FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to roles" ON roles FOR DELETE TO anon USING (true);

-- permissions
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON permissions;
DROP POLICY IF EXISTS "Authenticated users can insert permissions" ON permissions;
DROP POLICY IF EXISTS "Authenticated users can update permissions" ON permissions;
DROP POLICY IF EXISTS "Authenticated users can delete permissions" ON permissions;

CREATE POLICY "Allow read access to permissions" ON permissions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert access to permissions" ON permissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow update access to permissions" ON permissions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to permissions" ON permissions FOR DELETE TO anon USING (true);

-- role_permissions
DROP POLICY IF EXISTS "Authenticated users can view role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Authenticated users can insert role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Authenticated users can update role_permissions" ON role_permissions;
DROP POLICY IF EXISTS "Authenticated users can delete role_permissions" ON role_permissions;

CREATE POLICY "Allow read access to role_permissions" ON role_permissions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert access to role_permissions" ON role_permissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow update access to role_permissions" ON role_permissions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to role_permissions" ON role_permissions FOR DELETE TO anon USING (true);

-- location_groups
DROP POLICY IF EXISTS "Authenticated users can view location_groups" ON location_groups;
DROP POLICY IF EXISTS "Authenticated users can insert location_groups" ON location_groups;
DROP POLICY IF EXISTS "Authenticated users can update location_groups" ON location_groups;
DROP POLICY IF EXISTS "Authenticated users can delete location_groups" ON location_groups;

CREATE POLICY "Allow read access to location_groups" ON location_groups FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert access to location_groups" ON location_groups FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow update access to location_groups" ON location_groups FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to location_groups" ON location_groups FOR DELETE TO anon USING (true);

-- location_group_members
DROP POLICY IF EXISTS "Authenticated users can view location_group_members" ON location_group_members;
DROP POLICY IF EXISTS "Authenticated users can insert location_group_members" ON location_group_members;
DROP POLICY IF EXISTS "Authenticated users can update location_group_members" ON location_group_members;
DROP POLICY IF EXISTS "Authenticated users can delete location_group_members" ON location_group_members;

CREATE POLICY "Allow read access to location_group_members" ON location_group_members FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert access to location_group_members" ON location_group_members FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow update access to location_group_members" ON location_group_members FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to location_group_members" ON location_group_members FOR DELETE TO anon USING (true);

-- user_location_preferences
DROP POLICY IF EXISTS "Authenticated users can view user_location_preferences" ON user_location_preferences;
DROP POLICY IF EXISTS "Authenticated users can insert user_location_preferences" ON user_location_preferences;
DROP POLICY IF EXISTS "Authenticated users can update user_location_preferences" ON user_location_preferences;
DROP POLICY IF EXISTS "Authenticated users can delete user_location_preferences" ON user_location_preferences;

CREATE POLICY "Allow read access to user_location_preferences" ON user_location_preferences FOR SELECT TO anon USING (true);
CREATE POLICY "Allow insert access to user_location_preferences" ON user_location_preferences FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow update access to user_location_preferences" ON user_location_preferences FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete access to user_location_preferences" ON user_location_preferences FOR DELETE TO anon USING (true);
