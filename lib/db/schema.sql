-- Schema reference (for documentation)
-- This file mirrors supabase/migrations/001_initial_schema.sql
-- Use that file for actual database operations

-- Key tables:
--   profiles       - extends auth.users with membership info
--   landing_sites  - main table with PostGIS geography(Point, 4326)
--   site_photos    - photos uploaded to Supabase Storage
--   site_reports   - condition reports with report_type enum
--   saved_sites    - user favorites (composite PK)
--   routes         - user-created routes
--   route_points   - waypoints with geography(Point, 4326)

-- Spatial queries examples:

-- Find sites within 50 miles of a point
-- SELECT * FROM landing_sites
-- WHERE ST_DWithin(
--   location::geography,
--   ST_SetSRID(ST_MakePoint(-109.5, 39.0), 4326)::geography,
--   80467.2  -- 50 miles in meters
-- )
-- ORDER BY ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(-109.5, 39.0), 4326)::geography);

-- Find sites in a bounding box
-- SELECT * FROM landing_sites
-- WHERE location && ST_MakeEnvelope(-110, 38, -109, 40, 4326);

-- Calculate distance between two sites
-- SELECT ST_Distance(a.location::geography, b.location::geography) as distance_meters
-- FROM landing_sites a, landing_sites b
-- WHERE a.id = 'site1' AND b.id = 'site2';
