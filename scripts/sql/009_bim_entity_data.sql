-- =============================================================================
-- BIM Entity Data Storage
-- Stores parsed IFC entity data for inspection planning
-- =============================================================================

-- =============================================================================
-- 1. ADD BIM DATA COLUMNS TO PROJECT_FILES
-- =============================================================================

-- Add JSON column to store parsed BIM entity data
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS bim_data JSONB;
ALTER TABLE project_files ADD COLUMN IF NOT EXISTS bim_parsed_at TIMESTAMPTZ;

COMMENT ON COLUMN project_files.bim_data IS 'Parsed IFC entity data including element counts, storeys, and properties';
COMMENT ON COLUMN project_files.bim_parsed_at IS 'When the BIM file was last parsed';

-- =============================================================================
-- 2. CREATE INDEX FOR BIM DATA QUERIES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_project_files_bim_data
ON project_files USING GIN (bim_data)
WHERE bim_data IS NOT NULL;

-- =============================================================================
-- 3. ADD BIM SUMMARY TO PROJECTS (DENORMALIZED FOR QUICK ACCESS)
-- =============================================================================

-- Add summary columns to projects table for quick checklist generation access
ALTER TABLE projects ADD COLUMN IF NOT EXISTS bim_element_counts JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS bim_storey_count INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS bim_total_elements INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS bim_summary_text TEXT;

COMMENT ON COLUMN projects.bim_element_counts IS 'Summary of BIM element counts (doors, windows, stairs, etc.)';
COMMENT ON COLUMN projects.bim_storey_count IS 'Number of building storeys from BIM';
COMMENT ON COLUMN projects.bim_total_elements IS 'Total number of elements in BIM model';
COMMENT ON COLUMN projects.bim_summary_text IS 'Text summary of BIM data for checklist generation context';

DO $$ BEGIN RAISE NOTICE 'Migration 009_bim_entity_data completed successfully!'; END $$;
