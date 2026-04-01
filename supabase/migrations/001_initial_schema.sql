-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  avatar_url TEXT,
  membership_tier TEXT DEFAULT 'free' CHECK (membership_tier IN ('free', 'pro')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Landing sites
CREATE TABLE IF NOT EXISTS landing_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icao_code TEXT,
  faa_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('faa', 'community', 'blm', 'fs')),
  approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  submitted_by UUID REFERENCES profiles(id),
  reviewed_by UUID REFERENCES profiles(id),
  location GEOGRAPHY(Point, 4326) NOT NULL,
  elevation_ft INTEGER,
  runway_length_ft INTEGER,
  runway_surface TEXT CHECK (runway_surface IN ('dirt', 'gravel', 'paved', 'grass', 'snow', 'unknown')),
  magnetic_declination DECIMAL(5,2),
  description TEXT,
  restrictions TEXT,
  last_reported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Site photos
CREATE TABLE IF NOT EXISTS site_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES landing_sites(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Condition reports / comments
CREATE TABLE IF NOT EXISTS site_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES landing_sites(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES profiles(id),
  report_type TEXT NOT NULL CHECK (report_type IN ('condition', 'hazard', 'closure', 'general')),
  body TEXT NOT NULL,
  conditions_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_hidden BOOLEAN DEFAULT false
);

-- User favorites
CREATE TABLE IF NOT EXISTS saved_sites (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  site_id UUID REFERENCES landing_sites(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, site_id)
);

-- User-created routes
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Route waypoints
CREATE TABLE IF NOT EXISTS route_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  point_order INTEGER NOT NULL,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  label TEXT,
  notes TEXT
);

-- Spatial indexes
CREATE INDEX IF NOT EXISTS idx_landing_sites_location ON landing_sites USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_site_reports_site_id ON site_reports (site_id);
CREATE INDEX IF NOT EXISTS idx_route_points_route_id ON route_points (route_id);
CREATE INDEX IF NOT EXISTS idx_route_points_location ON route_points USING GIST (location);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER landing_sites_updated_at BEFORE UPDATE ON landing_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER routes_updated_at BEFORE UPDATE ON routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_points ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, only self can update
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Landing sites: approved sites are public, pending only for submitter/reviewer
CREATE POLICY "Approved sites are viewable by everyone" ON landing_sites
  FOR SELECT USING (approval_status = 'approved' OR auth.uid() = submitted_by);
CREATE POLICY "Authenticated users can insert sites" ON landing_sites
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Submitters and reviewers can update sites" ON landing_sites
  FOR UPDATE USING (auth.uid() = submitted_by OR auth.uid() = reviewed_by);

-- Site reports: public read, authenticated insert, reporter can update
CREATE POLICY "Site reports are viewable by everyone" ON site_reports
  FOR SELECT USING (NOT is_hidden OR auth.uid() = reported_by);
CREATE POLICY "Authenticated users can submit reports" ON site_reports
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Reporters can update own reports" ON site_reports
  FOR UPDATE USING (auth.uid() = reported_by);

-- Site photos: same as sites
CREATE POLICY "Site photos viewable with site" ON site_photos
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can upload photos" ON site_photos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Saved sites: only own
CREATE POLICY "Users can view own saved sites" ON saved_sites
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save sites" ON saved_sites
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave sites" ON saved_sites
  FOR DELETE USING (auth.uid() = user_id);

-- Routes: only own
CREATE POLICY "Users can manage own routes" ON routes
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own route points" ON route_points
  FOR ALL USING (
    EXISTS (SELECT 1 FROM routes WHERE routes.id = route_points.route_id AND routes.user_id = auth.uid())
  );
