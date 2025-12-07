-- =============================================================================
-- Quality Manual Migration
-- Adds tables for Quality Manual and Inspection Test Plans (ITPs)
-- =============================================================================

-- =============================================================================
-- 1. CREATE QUALITY_MANUALS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS quality_manuals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Manual metadata
    title TEXT NOT NULL DEFAULT 'Project Quality Manual',
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),

    -- Content sections (stored as JSONB for flexibility)
    -- Structure: { sections: [{ title, content, order }] }
    content JSONB DEFAULT '{"sections": []}',

    -- Approval tracking
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 2. CREATE INSPECTION_TEST_PLANS (ITPs) TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS inspection_test_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quality_manual_id UUID NOT NULL REFERENCES quality_manuals(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- ITP Classification
    construction_phase TEXT NOT NULL, -- e.g., "Foundation", "Framing", "MEP"
    csi_division TEXT, -- e.g., "03 00 00 Concrete"
    sort_order INTEGER DEFAULT 0,

    -- Activity details
    activity TEXT NOT NULL, -- e.g., "Concrete Pour - Footings"
    description TEXT, -- Detailed description of the activity

    -- Responsibility
    responsibility TEXT NOT NULL DEFAULT 'Contractor', -- Who is responsible
    inspector_role TEXT, -- e.g., "QC Inspector", "Third Party", "Owner's Rep"

    -- Frequency and timing
    frequency TEXT NOT NULL DEFAULT 'Each Occurrence', -- e.g., "Daily", "Weekly", "Each Occurrence"
    timing TEXT, -- e.g., "Prior to pour", "During placement"

    -- Hold point (critical inspection that must pass before proceeding)
    is_hold_point BOOLEAN DEFAULT FALSE,
    hold_point_release_by TEXT, -- Who can release the hold point

    -- References
    spec_reference TEXT, -- e.g., "Section 03 30 00"
    code_reference TEXT, -- e.g., "FBC 1904.2"
    standard_reference TEXT, -- e.g., "ASTM C31", "ACI 318"

    -- Acceptance criteria
    acceptance_criteria TEXT, -- What constitutes passing
    parameter_name TEXT, -- Measurable parameter if applicable
    target_value JSONB, -- Same format as checklist_items

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),

    -- Link to generated checklist item (after approval)
    checklist_item_id UUID REFERENCES checklist_items(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. CREATE INDEXES
-- =============================================================================

-- Quality manuals indexes
CREATE INDEX IF NOT EXISTS idx_quality_manuals_project_id
ON quality_manuals(project_id);

CREATE INDEX IF NOT EXISTS idx_quality_manuals_status
ON quality_manuals(status);

-- ITP indexes
CREATE INDEX IF NOT EXISTS idx_itp_quality_manual_id
ON inspection_test_plans(quality_manual_id);

CREATE INDEX IF NOT EXISTS idx_itp_project_id
ON inspection_test_plans(project_id);

CREATE INDEX IF NOT EXISTS idx_itp_construction_phase
ON inspection_test_plans(construction_phase);

CREATE INDEX IF NOT EXISTS idx_itp_hold_point
ON inspection_test_plans(is_hold_point)
WHERE is_hold_point = TRUE;

-- =============================================================================
-- 4. CREATE UPDATED_AT TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_quality_manual_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quality_manual_updated_at ON quality_manuals;
CREATE TRIGGER trg_quality_manual_updated_at
    BEFORE UPDATE ON quality_manuals
    FOR EACH ROW
    EXECUTE FUNCTION update_quality_manual_updated_at();

CREATE OR REPLACE FUNCTION update_itp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_itp_updated_at ON inspection_test_plans;
CREATE TRIGGER trg_itp_updated_at
    BEFORE UPDATE ON inspection_test_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_itp_updated_at();

-- =============================================================================
-- 5. CREATE VIEW FOR ITP SUMMARY BY PHASE
-- =============================================================================

CREATE OR REPLACE VIEW itp_summary_by_phase AS
SELECT
    qm.project_id,
    qm.id AS quality_manual_id,
    itp.construction_phase,
    COUNT(*) AS total_items,
    COUNT(*) FILTER (WHERE itp.is_hold_point = TRUE) AS hold_points,
    COUNT(*) FILTER (WHERE itp.checklist_item_id IS NOT NULL) AS linked_to_checklist,
    COUNT(*) FILTER (WHERE itp.status = 'completed') AS completed_items
FROM inspection_test_plans itp
JOIN quality_manuals qm ON itp.quality_manual_id = qm.id
GROUP BY qm.project_id, qm.id, itp.construction_phase
ORDER BY qm.project_id, itp.construction_phase;

COMMENT ON VIEW itp_summary_by_phase IS 'Summary of ITPs grouped by construction phase';

-- =============================================================================
-- 6. ADD RLS POLICIES
-- =============================================================================

ALTER TABLE quality_manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_test_plans ENABLE ROW LEVEL SECURITY;

-- Temporary policies for development (allow all operations)
DROP POLICY IF EXISTS "Allow all for quality_manuals" ON quality_manuals;
CREATE POLICY "Allow all for quality_manuals" ON quality_manuals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for inspection_test_plans" ON inspection_test_plans;
CREATE POLICY "Allow all for inspection_test_plans" ON inspection_test_plans FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- 7. ADD COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE quality_manuals IS 'Project quality manuals with version control and approval workflow';
COMMENT ON TABLE inspection_test_plans IS 'Inspection Test Plan (ITP) items linked to quality manuals';
COMMENT ON COLUMN inspection_test_plans.is_hold_point IS 'If true, work cannot proceed until this inspection passes';
COMMENT ON COLUMN inspection_test_plans.checklist_item_id IS 'Links ITP to generated checklist item after manual approval';

-- =============================================================================
-- Migration complete
-- =============================================================================

DO $$ BEGIN RAISE NOTICE 'Migration 013_quality_manual completed successfully!'; END $$;
