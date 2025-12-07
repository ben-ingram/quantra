-- =============================================================================
-- Project Details & Checklist Audit Trail Migration
-- Adds detailed project intake fields and checklist audit tracking
-- =============================================================================

-- =============================================================================
-- 1. ADD DETAILED PROJECT FIELDS
-- =============================================================================

-- Add new columns to projects table for detailed intake
ALTER TABLE projects ADD COLUMN IF NOT EXISTS occupancy_subtype TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS mixed_occupancies TEXT[]; -- Array of additional occupancies
ALTER TABLE projects ADD COLUMN IF NOT EXISTS occupant_load INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS number_of_stories INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS building_height_ft DECIMAL(10,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_area_sqft DECIMAL(12,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_sprinklered BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS fire_alarm_type TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS florida_county TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS flood_zone TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS wind_speed_mph INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_coastal_construction BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_high_rise BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS has_assembly_areas BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS has_hazardous_materials BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS has_high_piled_storage BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS special_features TEXT[]; -- Array of special features
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_phase TEXT DEFAULT 'design'; -- design, permit, construction, inspection, final
ALTER TABLE projects ADD COLUMN IF NOT EXISTS intake_completed_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN projects.occupancy_subtype IS 'Specific subtype like R-1, R-2, R-3, A-1, A-2, etc.';
COMMENT ON COLUMN projects.mixed_occupancies IS 'Additional occupancy groups for mixed-use buildings';
COMMENT ON COLUMN projects.occupant_load IS 'Calculated or estimated occupant load';
COMMENT ON COLUMN projects.number_of_stories IS 'Number of stories above grade plane';
COMMENT ON COLUMN projects.building_height_ft IS 'Building height in feet to highest roof';
COMMENT ON COLUMN projects.total_area_sqft IS 'Total building area in square feet';
COMMENT ON COLUMN projects.is_sprinklered IS 'Whether building has automatic sprinkler system';
COMMENT ON COLUMN projects.fire_alarm_type IS 'Type of fire alarm system (manual, automatic, etc.)';
COMMENT ON COLUMN projects.florida_county IS 'County for local code amendments';
COMMENT ON COLUMN projects.flood_zone IS 'FEMA flood zone designation';
COMMENT ON COLUMN projects.wind_speed_mph IS 'Design wind speed in mph';
COMMENT ON COLUMN projects.is_coastal_construction IS 'Within coastal construction control line';
COMMENT ON COLUMN projects.is_high_rise IS 'Building 75+ feet in height';
COMMENT ON COLUMN projects.has_assembly_areas IS 'Contains assembly occupancy areas';
COMMENT ON COLUMN projects.has_hazardous_materials IS 'Contains hazardous materials storage';
COMMENT ON COLUMN projects.has_high_piled_storage IS 'Contains high-piled storage areas';
COMMENT ON COLUMN projects.special_features IS 'Array of special building features';
COMMENT ON COLUMN projects.project_phase IS 'Current phase of the project';
COMMENT ON COLUMN projects.intake_completed_at IS 'When detailed intake was completed';

-- =============================================================================
-- 2. CREATE CHECKLIST ITEM COMPLIANCE LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS checklist_item_compliance_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
    checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Compliance decision
    action TEXT NOT NULL CHECK (action IN ('MARKED_PASS', 'MARKED_FAIL', 'MARKED_FLAG', 'CLEARED', 'NOTE_ADDED')),
    previous_status BOOLEAN, -- null = unchecked, true = pass, false = fail
    new_status BOOLEAN,

    -- Details
    notes TEXT,
    photo_evidence_url TEXT,
    inspector_name TEXT,

    -- Metadata
    user_id UUID,
    ip_address TEXT,
    user_agent TEXT,

    -- Audit chain
    checksum TEXT NOT NULL,
    previous_hash TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_compliance_log_item ON checklist_item_compliance_log(checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_compliance_log_checklist ON checklist_item_compliance_log(checklist_id);
CREATE INDEX IF NOT EXISTS idx_compliance_log_project ON checklist_item_compliance_log(project_id);
CREATE INDEX IF NOT EXISTS idx_compliance_log_created ON checklist_item_compliance_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_log_action ON checklist_item_compliance_log(action);

COMMENT ON TABLE checklist_item_compliance_log IS 'Tamper-evident log of all checklist compliance decisions';

-- =============================================================================
-- 3. ADD STATUS FIELD TO CHECKLIST_ITEMS FOR FLAG/FAIL TRACKING
-- =============================================================================

-- Add compliance_status field for more granular tracking
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS compliance_status TEXT
    DEFAULT 'pending'
    CHECK (compliance_status IN ('pending', 'pass', 'fail', 'flag', 'na'));

ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS fail_notes TEXT;
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS flag_reason TEXT;
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS evidence_urls TEXT[];
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS inspector_name TEXT;
ALTER TABLE checklist_items ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMPTZ;

COMMENT ON COLUMN checklist_items.compliance_status IS 'Current compliance status: pending, pass, fail, flag, na';
COMMENT ON COLUMN checklist_items.fail_notes IS 'Required notes when marking as fail';
COMMENT ON COLUMN checklist_items.flag_reason IS 'Reason for flagging item for review';
COMMENT ON COLUMN checklist_items.evidence_urls IS 'Array of photo evidence URLs';
COMMENT ON COLUMN checklist_items.inspector_name IS 'Name of inspector who checked item';
COMMENT ON COLUMN checklist_items.inspected_at IS 'When the item was inspected';

-- =============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE checklist_item_compliance_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to compliance_log" ON checklist_item_compliance_log;
CREATE POLICY "Allow all access to compliance_log" ON checklist_item_compliance_log
    FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- 5. CREATE FUNCTION FOR COMPLIANCE HASH GENERATION
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_compliance_hash(
    p_action TEXT,
    p_item_id UUID,
    p_previous_status BOOLEAN,
    p_new_status BOOLEAN,
    p_notes TEXT,
    p_timestamp TIMESTAMPTZ,
    p_previous_hash TEXT
) RETURNS TEXT AS $$
DECLARE
    content TEXT;
BEGIN
    content := json_build_object(
        'action', p_action,
        'item_id', p_item_id,
        'previous_status', p_previous_status,
        'new_status', p_new_status,
        'notes', p_notes,
        'timestamp', p_timestamp,
        'previous_hash', p_previous_hash
    )::TEXT;

    RETURN encode(sha256(content::bytea), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DO $$ BEGIN RAISE NOTICE 'Migration 008_project_details_and_audit completed successfully!'; END $$;
