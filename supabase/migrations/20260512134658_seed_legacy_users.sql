/*
  # Seed legacy users

  Inserts all users from the legacy production database:
  - 1 admin (Michael Hodgson)
  - 4 HQ users (John Mackay, Megan Stover, Shanna Jenion, Test User)
  - 16 chef users (one per restaurant location, PIN-based login)

  Chef users have no name in legacy DB, so we use the restaurant name as display name.
  
  The existing seeded admin record (pin 179321) is removed first to avoid conflicts,
  as that pin belongs to "Test User" (HQ role) in the legacy system.
*/

-- Remove existing seeded user to avoid pin conflicts
DELETE FROM users WHERE pin = '179321';

-- Insert all legacy users with original UUIDs
INSERT INTO users (id, name, pin, role, restaurant) VALUES
  ('3fa12f89-d90d-4b20-900f-bb8cdcdca010', 'Michael Hodgson', '142613', 'admin', 'Charcoal Group HQ'),
  ('77152865-7523-49f7-89ff-3214f697923d', 'John Mackay', '147258', 'HQ', 'Charcoal Group HQ'),
  ('99dbecd0-6dc1-4021-b8a6-11e09e9026a1', 'Megan Stover', '123456', 'HQ', 'Charcoal Group HQ'),
  ('25e83bab-1495-44f5-ac79-d8e7ef4b0756', 'Shanna Jenion', '987654', 'HQ', 'Charcoal Group HQ'),
  ('c327ecaa-2ea2-44f6-afd9-dba19dbb70fc', 'Test User', '179321', 'HQ', 'Charcoal Group HQ'),
  ('ff1c358b-7a7c-45ee-bf63-5027032161ad', 'Beertown Barrie', '1001', 'chef', 'Beertown Barrie'),
  ('012c0af3-5d14-4bf8-a925-ab16a08f274c', 'Beertown Burlington', '1002', 'chef', 'Beertown Burlington'),
  ('feb9f9ab-6d94-40bc-96d8-c9f357931d95', 'Beertown Cambridge', '1003', 'chef', 'Beertown Cambridge'),
  ('ebed275f-fde7-41fb-bf0c-a36f5237ad46', 'Beertown Etobicoke', '1004', 'chef', 'Beertown Etobicoke'),
  ('ceec4051-4a3c-4c6b-a327-14d4eb4ca9c4', 'Beertown Guelph', '1005', 'chef', 'Beertown Guelph'),
  ('535e01d8-f63e-4204-86e5-a8ebb64f5f20', 'Beertown London', '1006', 'chef', 'Beertown London'),
  ('fcff99d5-d2ce-4b53-83f8-2512788dc226', 'Beertown London White Oaks', '1007', 'chef', 'Beertown London White Oaks'),
  ('16564f01-ac3d-4ed1-99c1-6810b686da2b', 'Beertown Newmarket', '1008', 'chef', 'Beertown Newmarket'),
  ('c5f86456-e7c0-43a8-a8ad-e68c5c292587', 'Beertown Oakville', '1009', 'chef', 'Beertown Oakville'),
  ('4f935907-c8ca-49fd-8d24-cc5d7abcf3e9', 'Beertown Toronto', '1010', 'chef', 'Beertown Toronto'),
  ('e8fc499a-af07-4110-94ed-543fc159fdc7', 'Beertown Waterloo', '1011', 'chef', 'Beertown Waterloo'),
  ('c2d35d42-05b0-4f1c-90de-034e0f1cae11', 'Beertown Whitby', '1012', 'chef', 'Beertown Whitby'),
  ('04c1786c-96c2-496b-bd29-d40204e4a2e0', 'Sociable Kitchen Tavern', '1013', 'chef', 'Sociable Kitchen Tavern'),
  ('55c9c065-a312-4fbf-bca7-d379e6961d53', 'Sole', '1014', 'chef', 'Sole'),
  ('8514b427-7049-435d-879e-595622468784', 'The Bauer Kitchen', '1015', 'chef', 'The Bauer Kitchen'),
  ('18605d33-5b06-4ec7-bed3-0bde1e5b44fd', 'Wildcraft', '1016', 'chef', 'Wildcraft')
ON CONFLICT (pin) DO NOTHING;
