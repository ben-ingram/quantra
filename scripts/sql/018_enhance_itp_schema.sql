-- =============================================================================
-- Migration 018: Enhance Inspection Test Plans Schema
-- =============================================================================
-- Adds spec_source_id FK to link ITPs directly to project_specs rows
-- Ensures all required columns exist for detailed planning
-- =============================================================================

-- =============================================================================
-- STEP 1: Add spec_source_id column (FK to project_specs)
-- =============================================================================

-- Add the foreign key column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inspection_test_plans'
        AND column_name = 'spec_source_id'
    ) THEN
        ALTER TABLE inspection_test_plans
        ADD COLUMN spec_source_id UUID REFERENCES project_specs(id) ON DELETE SET NULL;

        RAISE NOTICE 'Added spec_source_id column to inspection_test_plans';
    ELSE
        RAISE NOTICE 'spec_source_id column already exists';
    END IF;
END $$;

-- =============================================================================
-- STEP 2: Add index for spec_source_id lookups
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_itp_spec_source_id
ON inspection_test_plans(spec_source_id)
WHERE spec_source_id IS NOT NULL;

-- =============================================================================
-- STEP 3: Verify all required columns exist (add if missing)
-- =============================================================================

-- Ensure construction_phase exists (renamed from generic 'phase')
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inspection_test_plans'
        AND column_name = 'construction_phase'
    ) THEN
        ALTER TABLE inspection_test_plans
        ADD COLUMN construction_phase TEXT NOT NULL DEFAULT 'General';
        RAISE NOTICE 'Added construction_phase column';
    END IF;
END $$;

-- Ensure activity exists (main inspection activity description)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inspection_test_plans'
        AND column_name = 'activity'
    ) THEN
        ALTER TABLE inspection_test_plans
        ADD COLUMN activity TEXT NOT NULL DEFAULT 'Inspection Activity';
        RAISE NOTICE 'Added activity column';
    END IF;
END $$;

-- Ensure description exists (detailed description)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inspection_test_plans'
        AND column_name = 'description'
    ) THEN
        ALTER TABLE inspection_test_plans
        ADD COLUMN description TEXT;
        RAISE NOTICE 'Added description column';
    END IF;
END $$;

-- Ensure responsibility exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inspection_test_plans'
        AND column_name = 'responsibility'
    ) THEN
        ALTER TABLE inspection_test_plans
        ADD COLUMN responsibility TEXT NOT NULL DEFAULT 'Quality Inspector';
        RAISE NOTICE 'Added responsibility column';
    END IF;
END $$;

-- Ensure frequency exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inspection_test_plans'
        AND column_name = 'frequency'
    ) THEN
        ALTER TABLE inspection_test_plans
        ADD COLUMN frequency TEXT NOT NULL DEFAULT 'Each Occurrence';
        RAISE NOTICE 'Added frequency column';
    END IF;
END $$;

-- Ensure is_hold_point exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inspection_test_plans'
        AND column_name = 'is_hold_point'
    ) THEN
        ALTER TABLE inspection_test_plans
        ADD COLUMN is_hold_point BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added is_hold_point column';
    END IF;
END $$;

-- Ensure acceptance_criteria exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inspection_test_plans'
        AND column_name = 'acceptance_criteria'
    ) THEN
        ALTER TABLE inspection_test_plans
        ADD COLUMN acceptance_criteria TEXT;
        RAISE NOTICE 'Added acceptance_criteria column';
    END IF;
END $$;

-- Ensure spec_reference exists (CSI section reference)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inspection_test_plans'
        AND column_name = 'spec_reference'
    ) THEN
        ALTER TABLE inspection_test_plans
        ADD COLUMN spec_reference TEXT;
        RAISE NOTICE 'Added spec_reference column';
    END IF;
END $$;

-- Ensure csi_division exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inspection_test_plans'
        AND column_name = 'csi_division'
    ) THEN
        ALTER TABLE inspection_test_plans
        ADD COLUMN csi_division TEXT;
        RAISE NOTICE 'Added csi_division column';
    END IF;
END $$;

-- Ensure parameter_name exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inspection_test_plans'
        AND column_name = 'parameter_name'
    ) THEN
        ALTER TABLE inspection_test_plans
        ADD COLUMN parameter_name TEXT;
        RAISE NOTICE 'Added parameter_name column';
    END IF;
END $$;

-- Ensure target_value exists (JSONB with min/max/value/unit)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inspection_test_plans'
        AND column_name = 'target_value'
    ) THEN
        ALTER TABLE inspection_test_plans
        ADD COLUMN target_value JSONB;
        RAISE NOTICE 'Added target_value column';
    END IF;
END $$;

-- =============================================================================
-- STEP 4: Create view for ITP with linked spec details
-- =============================================================================

DROP VIEW IF EXISTS itp_with_spec_details;

CREATE VIEW itp_with_spec_details AS
SELECT
    itp.id,
    itp.quality_manual_id,
    itp.project_id,
    itp.construction_phase,
    itp.activity,
    itp.description,
    itp.responsibility,
    itp.frequency,
    itp.is_hold_point,
    itp.acceptance_criteria,
    itp.spec_reference,
    itp.csi_division,
    itp.parameter_name,
    itp.target_value,
    itp.sort_order,
    itp.status,
    itp.created_at,
    itp.updated_at,
    -- Linked spec details
    itp.spec_source_id,
    ps.requirement_text AS spec_requirement_text,
    ps.min_value AS spec_min_value,
    ps.max_value AS spec_max_value,
    ps.target_value AS spec_target_value,
    ps.unit AS spec_unit,
    ps.section_title AS spec_section_title
FROM inspection_test_plans itp
LEFT JOIN project_specs ps ON itp.spec_source_id = ps.id;

COMMENT ON VIEW itp_with_spec_details IS 'ITPs joined with their source spec details for display';

-- =============================================================================
-- STEP 5: Add documentation comments
-- =============================================================================

COMMENT ON COLUMN inspection_test_plans.spec_source_id IS
'Foreign key to project_specs.id - links this ITP directly to the source specification';

COMMENT ON COLUMN inspection_test_plans.construction_phase IS
'Construction phase name (e.g., "Metal Stairs", "Foundation", "Structure")';

COMMENT ON COLUMN inspection_test_plans.activity IS
'Specific inspection activity (e.g., "Verify Riser Height Tolerance")';

COMMENT ON COLUMN inspection_test_plans.responsibility IS
'Party responsible for the inspection (e.g., "Field Engineer", "QC Inspector")';

COMMENT ON COLUMN inspection_test_plans.frequency IS
'Inspection frequency (e.g., "Every Flight", "Each Pour", "100% of locations")';

COMMENT ON COLUMN inspection_test_plans.is_hold_point IS
'If true, work MUST stop until this inspection passes and is released';

-- =============================================================================
-- Migration complete
-- =============================================================================

DO $$ BEGIN
    RAISE NOTICE '======================================================';
    RAISE NOTICE 'Migration 018_enhance_itp_schema COMPLETE';
    RAISE NOTICE '======================================================';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '  - Added spec_source_id FK to project_specs';
    RAISE NOTICE '  - Verified all required columns exist';
    RAISE NOTICE '  - Created itp_with_spec_details view';
    RAISE NOTICE '======================================================';
END $$;
