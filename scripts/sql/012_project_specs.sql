-- =============================================================================
-- Project Specifications Migration
-- Adds project_specs table for Design Compliance checking
-- Allows verification against project-specific specifications (not just code)
-- =============================================================================

-- =============================================================================
-- 1. CREATE PROJECT_SPECS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- CSI MasterFormat Classification
    csi_division TEXT NOT NULL,           -- e.g., "03 00 00 Concrete"
    section_title TEXT,                    -- e.g., "Cast-in-Place Concrete"

    -- Requirement Details
    requirement_text TEXT NOT NULL,        -- Raw text of the requirement
    parameter_name TEXT NOT NULL,          -- e.g., "Slump", "Air Content", "Compressive Strength"

    -- Numeric Values (nullable - not all specs have all values)
    min_value FLOAT,                       -- Minimum acceptable value
    max_value FLOAT,                       -- Maximum acceptable value
    target_value FLOAT,                    -- Target/nominal value (e.g., Grade 60)
    unit TEXT,                             -- e.g., "inches", "psi", "%", "days"

    -- Tolerance (optional - extracted from specs like "+/- 1 inch")
    tolerance FLOAT,                       -- Plus/minus tolerance value
    tolerance_unit TEXT,                   -- Unit for tolerance if different from main unit
    tolerance_type TEXT CHECK (tolerance_type IS NULL OR tolerance_type IN (
        'absolute',      -- +/- fixed value (e.g., +/- 1 inch)
        'percentage'     -- +/- percentage (e.g., +/- 5%)
    )),

    -- Semantic Search
    embedding vector(1536),                -- OpenAI text-embedding-3-small

    -- Source Tracking
    source_document TEXT,                  -- Original document name
    source_page INTEGER,                   -- Page number in source document
    source_section TEXT,                   -- Section reference (e.g., "3.2.1")

    -- Metadata
    spec_type TEXT CHECK (spec_type IS NULL OR spec_type IN (
        'material',       -- Material property (e.g., concrete strength)
        'dimensional',    -- Dimensional requirement (e.g., slab thickness)
        'performance',    -- Performance requirement (e.g., air content)
        'procedural',     -- Procedural requirement (e.g., curing time)
        'quality'         -- Quality standard (e.g., ASTM reference)
    )),

    priority TEXT CHECK (priority IS NULL OR priority IN (
        'critical',       -- Must meet exactly
        'high',           -- Important, minor deviation may be acceptable
        'medium',         -- Standard requirement
        'low'             -- Informational or flexible
    )) DEFAULT 'medium',

    -- Verification
    verified_by TEXT,                      -- User who verified this extraction
    verified_at TIMESTAMPTZ,               -- When verification occurred
    is_verified BOOLEAN DEFAULT FALSE,     -- Manual verification flag

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 2. CREATE INDEXES
-- =============================================================================

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_project_specs_project_id
ON project_specs(project_id);

-- Index for CSI division filtering
CREATE INDEX IF NOT EXISTS idx_project_specs_csi_division
ON project_specs(csi_division);

-- Index for parameter name searches
CREATE INDEX IF NOT EXISTS idx_project_specs_parameter_name
ON project_specs(parameter_name);

-- Composite index for project + division queries
CREATE INDEX IF NOT EXISTS idx_project_specs_project_division
ON project_specs(project_id, csi_division);

-- Vector index for semantic search (HNSW for fast approximate search)
CREATE INDEX IF NOT EXISTS idx_project_specs_embedding
ON project_specs USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- 3. CREATE UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_project_specs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_specs_updated_at ON project_specs;
CREATE TRIGGER trg_project_specs_updated_at
    BEFORE UPDATE ON project_specs
    FOR EACH ROW
    EXECUTE FUNCTION update_project_specs_updated_at();

-- =============================================================================
-- 4. CREATE SEMANTIC SEARCH FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION search_project_specs(
    p_project_id UUID,
    p_query_embedding vector(1536),
    p_match_threshold FLOAT DEFAULT 0.75,
    p_match_count INT DEFAULT 10,
    p_csi_division TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    csi_division TEXT,
    section_title TEXT,
    requirement_text TEXT,
    parameter_name TEXT,
    min_value FLOAT,
    max_value FLOAT,
    target_value FLOAT,
    unit TEXT,
    tolerance FLOAT,
    spec_type TEXT,
    priority TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ps.id,
        ps.csi_division,
        ps.section_title,
        ps.requirement_text,
        ps.parameter_name,
        ps.min_value,
        ps.max_value,
        ps.target_value,
        ps.unit,
        ps.tolerance,
        ps.spec_type,
        ps.priority,
        1 - (ps.embedding <=> p_query_embedding) AS similarity
    FROM project_specs ps
    WHERE ps.project_id = p_project_id
      AND ps.embedding IS NOT NULL
      AND 1 - (ps.embedding <=> p_query_embedding) >= p_match_threshold
      AND (p_csi_division IS NULL OR ps.csi_division ILIKE '%' || p_csi_division || '%')
    ORDER BY ps.embedding <=> p_query_embedding
    LIMIT p_match_count;
END;
$$;

-- =============================================================================
-- 5. CREATE VALIDATION FUNCTION
-- =============================================================================

-- Function to validate a measured value against a spec
CREATE OR REPLACE FUNCTION validate_spec_measurement(
    p_measured_value FLOAT,
    p_min_value FLOAT,
    p_max_value FLOAT,
    p_target_value FLOAT,
    p_tolerance FLOAT,
    p_tolerance_type TEXT
)
RETURNS TEXT  -- Returns 'pass', 'fail', or 'warning'
LANGUAGE plpgsql
AS $$
DECLARE
    effective_min FLOAT;
    effective_max FLOAT;
    warning_margin FLOAT := 0.1;  -- 10% margin for warnings
BEGIN
    -- Handle NULL input
    IF p_measured_value IS NULL THEN
        RETURN 'not_measured';
    END IF;

    -- Calculate effective min/max based on tolerance
    IF p_target_value IS NOT NULL AND p_tolerance IS NOT NULL THEN
        IF p_tolerance_type = 'percentage' THEN
            effective_min := p_target_value * (1 - p_tolerance / 100);
            effective_max := p_target_value * (1 + p_tolerance / 100);
        ELSE  -- absolute tolerance
            effective_min := p_target_value - p_tolerance;
            effective_max := p_target_value + p_tolerance;
        END IF;
    ELSE
        effective_min := COALESCE(p_min_value, -999999999);
        effective_max := COALESCE(p_max_value, 999999999);
    END IF;

    -- Check if within bounds
    IF p_measured_value >= effective_min AND p_measured_value <= effective_max THEN
        RETURN 'pass';
    END IF;

    -- Check if close to bounds (warning zone)
    IF effective_min != -999999999 AND p_measured_value >= effective_min * (1 - warning_margin) THEN
        RETURN 'warning';
    END IF;
    IF effective_max != 999999999 AND p_measured_value <= effective_max * (1 + warning_margin) THEN
        RETURN 'warning';
    END IF;

    RETURN 'fail';
END;
$$;

-- =============================================================================
-- 6. CREATE VIEW FOR SPEC SUMMARY BY DIVISION
-- =============================================================================

CREATE OR REPLACE VIEW project_specs_summary AS
SELECT
    project_id,
    csi_division,
    COUNT(*) AS total_specs,
    COUNT(*) FILTER (WHERE is_verified = TRUE) AS verified_specs,
    COUNT(*) FILTER (WHERE priority = 'critical') AS critical_specs,
    COUNT(*) FILTER (WHERE spec_type = 'material') AS material_specs,
    COUNT(*) FILTER (WHERE spec_type = 'dimensional') AS dimensional_specs,
    COUNT(*) FILTER (WHERE spec_type = 'performance') AS performance_specs
FROM project_specs
GROUP BY project_id, csi_division
ORDER BY project_id, csi_division;

COMMENT ON VIEW project_specs_summary IS 'Summary of project specifications by CSI division';

-- =============================================================================
-- 7. ADD COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE project_specs IS 'Project-specific specifications for Design Compliance checking';
COMMENT ON COLUMN project_specs.csi_division IS 'CSI MasterFormat division (e.g., "03 00 00 Concrete")';
COMMENT ON COLUMN project_specs.parameter_name IS 'Name of the measurable parameter (e.g., "Slump", "Compressive Strength")';
COMMENT ON COLUMN project_specs.min_value IS 'Minimum acceptable value for this parameter';
COMMENT ON COLUMN project_specs.max_value IS 'Maximum acceptable value for this parameter';
COMMENT ON COLUMN project_specs.target_value IS 'Target/nominal value (used with tolerance for +/- specs)';
COMMENT ON COLUMN project_specs.tolerance IS 'Plus/minus tolerance value';
COMMENT ON COLUMN project_specs.embedding IS 'Vector embedding for semantic search';
COMMENT ON COLUMN project_specs.spec_type IS 'Type of specification: material, dimensional, performance, procedural, quality';

-- =============================================================================
-- 8. SEED CSI DIVISION REFERENCE (Optional helper table)
-- =============================================================================

CREATE TABLE IF NOT EXISTS csi_divisions (
    code TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT
);

INSERT INTO csi_divisions (code, title, description) VALUES
    ('01', 'General Requirements', 'Administrative and procedural requirements'),
    ('02', 'Existing Conditions', 'Subsurface investigation, demolition, site remediation'),
    ('03', 'Concrete', 'Cast-in-place concrete, precast concrete, grouts'),
    ('04', 'Masonry', 'Unit masonry, stone assemblies, masonry restoration'),
    ('05', 'Metals', 'Structural steel, metal fabrications, decorative metal'),
    ('06', 'Wood, Plastics, and Composites', 'Rough carpentry, finish carpentry, millwork'),
    ('07', 'Thermal and Moisture Protection', 'Waterproofing, insulation, roofing, siding'),
    ('08', 'Openings', 'Doors, windows, entrances, storefronts, glazing'),
    ('09', 'Finishes', 'Plaster, gypsum board, tile, flooring, painting'),
    ('10', 'Specialties', 'Signage, compartments, lockers, fire protection specialties'),
    ('11', 'Equipment', 'Appliances, athletic equipment, medical equipment'),
    ('12', 'Furnishings', 'Furniture, window treatments, fabrics'),
    ('13', 'Special Construction', 'Swimming pools, kennels, special structures'),
    ('14', 'Conveying Equipment', 'Elevators, escalators, lifts'),
    ('21', 'Fire Suppression', 'Fire sprinkler systems, fire pumps'),
    ('22', 'Plumbing', 'Plumbing fixtures, piping, pumps'),
    ('23', 'HVAC', 'Heating, ventilating, air conditioning'),
    ('25', 'Integrated Automation', 'Building automation systems'),
    ('26', 'Electrical', 'Power, lighting, electrical systems'),
    ('27', 'Communications', 'Data, voice, audio-video systems'),
    ('28', 'Electronic Safety and Security', 'Access control, surveillance, detection'),
    ('31', 'Earthwork', 'Site clearing, grading, excavation'),
    ('32', 'Exterior Improvements', 'Paving, site improvements, landscaping'),
    ('33', 'Utilities', 'Water, sewer, storm drainage, gas')
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- Migration complete
-- =============================================================================

DO $$ BEGIN RAISE NOTICE 'Migration 012_project_specs completed successfully!'; END $$;
