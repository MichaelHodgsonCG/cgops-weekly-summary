/*
  # Update regions to two groups

  Restructures location regions from Central/Eastern/Western to:
  1. "Beertown" - All 12 Beertown locations + Sociable Kitchen Tavern (13 total)
  2. "Signature" - Sole, The Bauer Kitchen, Wildcraft (3 total)

  Also updates location_groups and their memberships to match.
*/

-- Update regions on locations
UPDATE locations SET region = 'Beertown' WHERE name LIKE 'Beertown%' OR name = 'Sociable Kitchen Tavern';
UPDATE locations SET region = 'Signature' WHERE name IN ('Sole', 'The Bauer Kitchen', 'Wildcraft');

-- Clear existing location group members
DELETE FROM location_group_members;

-- Remove old region groups and create new ones
DELETE FROM location_groups;

INSERT INTO location_groups (name, description, group_type) VALUES
  ('Beertown & SKT', 'All Beertown locations and Sociable Kitchen Tavern', 'regional'),
  ('Signature Brands', 'Sole, The Bauer Kitchen, and Wildcraft', 'regional');

-- Assign members to Beertown & SKT group
INSERT INTO location_group_members (group_id, location_id)
SELECT g.id, l.id
FROM location_groups g, locations l
WHERE g.name = 'Beertown & SKT'
  AND (l.name LIKE 'Beertown%' OR l.name = 'Sociable Kitchen Tavern');

-- Assign members to Signature Brands group
INSERT INTO location_group_members (group_id, location_id)
SELECT g.id, l.id
FROM location_groups g, locations l
WHERE g.name = 'Signature Brands'
  AND l.name IN ('Sole', 'The Bauer Kitchen', 'Wildcraft');
