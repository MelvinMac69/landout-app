-- Migration 002: Data Sources and Overlay Metadata
-- Adds source_type distinction, site_type enum, and overlay_metadata table
-- Required for official data source tracking and provenance

-- 1. Add site_type column to distinguish airport vs strip vs emergency
ALTER TABLE landing_sites ADD COLUMN IF NOT EXISTS site_type TEXT
  DEFAULT 'airport'
  CHECK (site_type IN ('airport', 'strip', 'emergency', 'water'));

-- 2. Add source_type column to clearly distinguish official vs community
-- faa_reference = seeded from FAA data, managed by admins, not editable by users
-- community = user-submitted, moderated, editable by submitter
ALTER TABLE landing_sites ADD COLUMN IF NOT EXISTS source_type TEXT
  DEFAULT 'faa_reference'
  CHECK (source_type IN ('faa_reference', 'community'));

-- 3. Add NASR cycle date to track when FAA data was last refreshed
ALTER TABLE landing_sites ADD COLUMN IF NOT EXISTS nasr_cycle_date DATE;

-- 4. Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_landing_sites_source_type ON landing_sites(source_type);
CREATE INDEX IF NOT EXISTS idx_landing_sites_site_type ON landing_sites(site_type);
CREATE INDEX IF NOT EXISTS idx_landing_sites_icao ON landing_sites(icao_code);

-- 5. Update RLS policies to enforce source_type rules
-- FAA reference sites are read-only for regular users
-- Community sites can be inserted by authenticated users
DROP POLICY IF EXISTS "Users can insert sites" ON landing_sites;
CREATE POLICY "Users can insert community sites" ON landing_sites
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND source_type = 'community'
  );

-- Users can update community sites they submitted
DROP POLICY IF EXISTS "Submitters and reviewers can update sites" ON landing_sites;
CREATE POLICY "Users can update own community sites" ON landing_sites
  FOR UPDATE USING (
    auth.uid() = submitted_by
    AND source_type = 'community'
  );

-- FAA reference sites: allow read for all, update only via service role
-- (handled by RLS — auth.uid() must be null for reads, service role bypasses RLS)
-- Regular users can read all approved sites
-- FAA reference sites have submitted_by = NULL

-- 6. Create overlay_metadata table
-- Tracks provenance and freshness of map overlay GeoJSON files
CREATE TABLE IF NOT EXISTS overlay_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_key TEXT UNIQUE NOT NULL,  -- 'blm_sma', 'wilderness', 'wsa'
  official_source_name TEXT NOT NULL,
  official_source_url TEXT NOT NULL,
  geojson_file_path TEXT NOT NULL,  -- relative path under /public/data/
  data_format TEXT DEFAULT 'geojson', -- 'geojson', 'mbtiles', etc.
  last_refreshed_at TIMESTAMPTZ,
  last_refreshed_by TEXT,  -- 'manual', 'script_name', 'cron'
  source_data_hash TEXT,  -- SHA-256 of source data for change detection
  record_count INTEGER,  -- number of features in the GeoJSON
  file_size_bytes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Insert initial overlay metadata records
INSERT INTO overlay_metadata (layer_key, official_source_name, official_source_url, geojson_file_path, notes)
VALUES
  (
    'blm_sma',
    'BLM National Surface Management Agency',
    'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_SMA/MapServer',
    '/data/blm-sma.geojson',
    'Surface Management Agency polygons — shows BLM, USFS, NPS, FWS, BOR, DOE ownership. Private/state shown as no-fill.'
  ),
  (
    'wilderness',
    'BLM National NLCS Wilderness Areas',
    'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_WLD_WSA/MapServer',
    '/data/wilderness.geojson',
    'Designated wilderness areas — no landing without explicit permission. Managed by BLM NLCS.'
  ),
  (
    'wsa',
    'BLM National NLCS Wilderness Study Areas',
    'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_WLD_WSA/MapServer',
    '/data/wsa.geojson',
    'Wilderness Study Areas — not yet designated as wilderness. Special restrictions may apply. Verify current status with BLM.'
  )
ON CONFLICT (layer_key) DO NOTHING;

-- 8. Create data_refresh_log table for audit trail
CREATE TABLE IF NOT EXISTS data_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refresh_type TEXT NOT NULL,  -- 'overlay', 'faa_nasr', 'community_sync'
  source_key TEXT,  -- 'blm_sma', 'wilderness', 'wsa', 'faa_nasr'
  initiated_by TEXT NOT NULL,  -- 'manual', 'cron', 'script_name'
  status TEXT NOT NULL CHECK (status IN ('started', 'success', 'failed')),
  records_processed INTEGER,
  records_inserted INTEGER,
  records_updated INTEGER,
  records_rejected INTEGER,
  error_message TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 9. Create function to log refresh completion
CREATE OR REPLACE FUNCTION log_refresh_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' OR NEW.status = 'failed' THEN
    NEW.completed_at = now();
    NEW.duration_ms = EXTRACT(MILLISECONDS FROM (now() - NEW.started_at))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER refresh_log_completion
  BEFORE UPDATE ON data_refresh_log
  FOR EACH ROW
  EXECUTE FUNCTION log_refresh_completion();

-- 10. Update updated_at trigger to include overlay_metadata
CREATE OR REPLACE FUNCTION update_overlay_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS overlay_metadata_updated_at ON overlay_metadata;
CREATE TRIGGER overlay_metadata_updated_at
  BEFORE UPDATE ON overlay_metadata
  FOR EACH ROW EXECUTE FUNCTION update_overlay_metadata_updated_at();
