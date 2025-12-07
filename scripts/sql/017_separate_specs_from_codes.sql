-- =============================================================================
-- Migration 017: Separate Project Specs from Building Codes
-- =============================================================================
-- CRITICAL FIX: code_sections should ONLY contain Florida Building Code text
-- Project specifications go in the dedicated project_specs table
-- =============================================================================

-- =============================================================================
-- STEP 1: Clean up code_sections - Remove any project specs that were
--         incorrectly stored there
-- =============================================================================

-- Delete rows that look like project specs (not building codes)
-- Project specs typically have jurisdiction = 'Project Specs' or
-- code_name = 'Project Specification'
DELETE FROM code_sections
WHERE jurisdiction = 'Project Specs'
   OR code_name = 'Project Specification'
   OR code_name LIKE '%Spec%';

-- Also delete any that were stored with a project UUID as code_version
-- (Building codes should have versions like "8th Edition (2023)", not UUIDs)
DELETE FROM code_sections
WHERE code_version ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Log how many rows remain (should only be building codes)
DO $$
DECLARE
    remaining_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_count FROM code_sections;
    RAISE NOTICE 'code_sections cleanup complete. Remaining rows (building codes only): %', remaining_count;
END $$;

-- =============================================================================
-- STEP 2: Remove any incorrectly added columns from code_sections
--         (if they exist)
-- =============================================================================

-- These columns should NOT be in code_sections - they belong in project_specs
ALTER TABLE code_sections DROP COLUMN IF EXISTS min_value;
ALTER TABLE code_sections DROP COLUMN IF EXISTS max_value;
ALTER TABLE code_sections DROP COLUMN IF EXISTS target_value;
ALTER TABLE code_sections DROP COLUMN IF EXISTS unit;
ALTER TABLE code_sections DROP COLUMN IF EXISTS requirement_text;
ALTER TABLE code_sections DROP COLUMN IF EXISTS csi_division;
ALTER TABLE code_sections DROP COLUMN IF EXISTS parameter_name;

-- =============================================================================
-- STEP 3: Create the dedicated project_specs table
-- =============================================================================

-- Drop if exists (for clean re-runs)
DROP TABLE IF EXISTS project_specs CASCADE;

CREATE TABLE project_specs (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign key to projects
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- CSI MasterFormat division (e.g., "03 00 00", "05 12 00")
    csi_division TEXT,

    -- Section title from the spec document (e.g., "Cast-in-Place Concrete")
    section_title TEXT,

    -- Specific parameter being specified (e.g., "Slump", "Concrete Strength")
    parameter_name TEXT,

    -- The raw requirement text extracted from the PDF
    requirement_text TEXT,

    -- Numeric values for measurable requirements
    min_value FLOAT,
    max_value FLOAT,
    target_value FLOAT,

    -- Unit of measurement (e.g., "inches", "psi", "degrees F")
    unit TEXT,

    -- Vector embedding for semantic search (1536 dimensions for OpenAI embeddings)
    embedding vector(1536),

    -- Source tracking
    source_file TEXT,
    page_number INTEGER,
    chunk_index INTEGER,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- STEP 4: Create indexes for project_specs
-- =============================================================================

-- Index on project_id for fast lookups
CREATE INDEX idx_project_specs_project_id
ON project_specs(project_id);

-- Index on CSI division for filtering by spec section
CREATE INDEX idx_project_specs_csi_division
ON project_specs(csi_division);

-- Index on parameter_name for filtering
CREATE INDEX idx_project_specs_parameter_name
ON project_specs(parameter_name);

-- HNSW index on embedding for fast vector similarity search
CREATE INDEX idx_project_specs_embedding
ON project_specs
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Full-text search index on requirement_text
CREATE INDEX idx_project_specs_requirement_fts
ON project_specs
USING gin (to_tsvector('english', COALESCE(requirement_text, '')));

-- =============================================================================
-- STEP 5: Create updated_at trigger
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
-- STEP 6: Enable RLS and create policies
-- =============================================================================

ALTER TABLE project_specs ENABLE ROW LEVEL SECURITY;

-- Allow all for development (tighten for production)
DROP POLICY IF EXISTS "Allow all for project_specs" ON project_specs;
CREATE POLICY "Allow all for project_specs"
ON project_specs FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- STEP 7: Create semantic search function for project specs
-- =============================================================================

-- Drop any existing versions of this function to avoid conflicts
DROP FUNCTION IF EXISTS search_project_specs(UUID, vector, INTEGER, FLOAT);
DROP FUNCTION IF EXISTS search_project_specs(UUID, vector(1536), INTEGER, FLOAT);

CREATE OR REPLACE FUNCTION search_project_specs(
    p_project_id UUID,
    p_query_embedding vector(1536),
    p_match_count INTEGER DEFAULT 10,
    p_match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    id UUID,
    csi_division TEXT,
    section_title TEXT,
    parameter_name TEXT,
    requirement_text TEXT,
    min_value FLOAT,
    max_value FLOAT,
    target_value FLOAT,
    unit TEXT,
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
        ps.parameter_name,
        ps.requirement_text,
        ps.min_value,
        ps.max_value,
        ps.target_value,
        ps.unit,
        1 - (ps.embedding <=> p_query_embedding) AS similarity
    FROM project_specs ps
    WHERE ps.project_id = p_project_id
      AND ps.embedding IS NOT NULL
      AND 1 - (ps.embedding <=> p_query_embedding) > p_match_threshold
    ORDER BY ps.embedding <=> p_query_embedding
    LIMIT p_match_count;
END;
$$;

COMMENT ON FUNCTION search_project_specs IS 'Semantic search for project specifications using vector similarity';

-- =============================================================================
-- STEP 8: Update check_define_complete to use project_specs correctly
-- =============================================================================

CREATE OR REPLACE FUNCTION check_define_complete(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    has_specs BOOLEAN;
    has_bim BOOLEAN;
BEGIN
    -- Check for uploaded specs in project_specs table (CORRECT location)
    SELECT EXISTS (
        SELECT 1 FROM project_specs
        WHERE project_id = p_project_id
        LIMIT 1
    ) INTO has_specs;

    -- Check for uploaded BIM in project_files
    SELECT EXISTS (
        SELECT 1 FROM project_files
        WHERE project_id = p_project_id
        AND file_type IN ('ifc', 'glb', 'gltf')
        LIMIT 1
    ) INTO has_bim;

    -- Also check model_elements as a fallback
    IF NOT has_bim THEN
        SELECT EXISTS (
            SELECT 1 FROM model_elements WHERE project_id = p_project_id LIMIT 1
        ) INTO has_bim;
    END IF;

    RETURN has_specs AND has_bim;
END;
$$;

COMMENT ON FUNCTION check_define_complete IS 'Returns TRUE if project has specs in project_specs table AND BIM model uploaded';

-- =============================================================================
-- STEP 9: Update project_phase_status view
-- =============================================================================

DROP VIEW IF EXISTS project_phase_status;

CREATE OR REPLACE VIEW project_phase_status AS
SELECT
    p.id AS project_id,
    p.name AS project_name,
    p.current_phase,
    p.phase_entered_at,

    -- Define phase status
    CASE WHEN p.current_phase = 'define' THEN
        CASE
            WHEN check_define_complete(p.id) THEN 'complete'
            ELSE 'in_progress'
        END
    ELSE 'complete'
    END AS define_status,
    p.define_completed_at,

    -- Plan phase status
    CASE
        WHEN p.current_phase IN ('define') THEN 'locked'
        WHEN p.current_phase = 'plan' THEN
            CASE WHEN check_plan_complete(p.id) THEN 'complete' ELSE 'in_progress' END
        ELSE 'complete'
    END AS plan_status,
    p.plan_completed_at,

    -- Execute phase status
    CASE
        WHEN p.current_phase IN ('define', 'plan') THEN 'locked'
        WHEN p.current_phase = 'execute' THEN 'in_progress'
        ELSE 'complete'
    END AS execute_status,
    p.execute_started_at,

    -- Control phase status
    CASE
        WHEN p.current_phase = 'control' THEN 'active'
        ELSE 'view_only'
    END AS control_status,

    -- Counts for progress - ONLY from project_specs (NOT code_sections)
    (SELECT COUNT(*) FROM project_specs WHERE project_id = p.id) AS specs_count,

    -- BIM elements count
    COALESCE(
        (SELECT COUNT(*) FROM project_files WHERE project_id = p.id AND file_type IN ('ifc', 'glb', 'gltf')), 0
    ) + COALESCE(
        (SELECT COUNT(*) FROM model_elements WHERE project_id = p.id), 0
    ) AS bim_elements_count,

    (SELECT COUNT(*) FROM quality_manuals WHERE project_id = p.id AND status = 'approved') AS approved_manuals_count,

    (SELECT COUNT(*) FROM checklist_items ci
     JOIN checklists c ON ci.checklist_id = c.id
     WHERE c.project_id = p.id) AS checklist_items_count

FROM projects p;

COMMENT ON VIEW project_phase_status IS 'Project phase status - specs counted from project_specs table only';

-- =============================================================================
-- STEP 10: Add comments documenting the architecture
-- =============================================================================

COMMENT ON TABLE code_sections IS
'BUILDING CODES ONLY - Contains text from Florida Building Code and other regulatory codes.
DO NOT store project specifications here. Use project_specs table for project-specific requirements.';

COMMENT ON TABLE project_specs IS
'PROJECT SPECIFICATIONS - Contains requirements extracted from project specification PDFs (CSI MasterFormat).
Each row represents a specific requirement for a specific project.
Use code_sections for building codes (FBC, IBC, etc).';

-- =============================================================================
-- Migration complete
-- =============================================================================

DO $$ BEGIN
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'Migration 017_separate_specs_from_codes COMPLETE';
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'ARCHITECTURE NOTES:';
    RAISE NOTICE '  - code_sections: ONLY for Florida Building Code text';
    RAISE NOTICE '  - project_specs: For project specification requirements';
    RAISE NOTICE '=======================================================';
END $$;
