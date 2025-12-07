-- =============================================================================
-- Fix Define Phase Check
-- Updates check_define_complete to look at actual tables used by the app
-- Also updates the project_phase_status view to count specs correctly
-- =============================================================================

-- Update the check_define_complete function to check the correct tables
CREATE OR REPLACE FUNCTION check_define_complete(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    has_specs BOOLEAN;
    has_bim BOOLEAN;
BEGIN
    -- Check for uploaded specs in code_sections (SUPER RAG table)
    -- The code_version column stores the project_id for project specs
    SELECT EXISTS (
        SELECT 1 FROM code_sections
        WHERE code_version = p_project_id::TEXT
        LIMIT 1
    ) INTO has_specs;

    -- Also check project_specs as a fallback
    IF NOT has_specs THEN
        SELECT EXISTS (
            SELECT 1 FROM project_specs WHERE project_id = p_project_id LIMIT 1
        ) INTO has_specs;
    END IF;

    -- Check for uploaded BIM in project_files (where file_type is ifc, glb, or gltf)
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

COMMENT ON FUNCTION check_define_complete IS 'Returns TRUE if project has both specs (in code_sections or project_specs) and BIM (in project_files or model_elements)';

-- =============================================================================
-- Update project_phase_status view to count specs from code_sections
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

    -- Control phase status (always accessible for viewing)
    CASE
        WHEN p.current_phase = 'control' THEN 'active'
        ELSE 'view_only'
    END AS control_status,

    -- Counts for progress - Check both code_sections AND project_specs
    (
        SELECT COUNT(*) FROM code_sections WHERE code_version = p.id::TEXT
    ) + COALESCE(
        (SELECT COUNT(*) FROM project_specs WHERE project_id = p.id), 0
    ) AS specs_count,

    -- BIM elements count - Check both project_files AND model_elements
    COALESCE(
        (SELECT COUNT(*) FROM project_files WHERE project_id = p.id AND file_type IN ('ifc', 'glb', 'gltf')), 0
    ) + COALESCE(
        (SELECT COUNT(*) FROM model_elements WHERE project_id = p.id), 0
    ) AS bim_elements_count,

    (SELECT COUNT(*) FROM quality_manuals WHERE project_id = p.id AND status = 'approved') AS approved_manuals_count,

    -- checklist_items links through checklists table
    (SELECT COUNT(*) FROM checklist_items ci
     JOIN checklists c ON ci.checklist_id = c.id
     WHERE c.project_id = p.id) AS checklist_items_count

FROM projects p;

COMMENT ON VIEW project_phase_status IS 'Comprehensive view of project phase status and progress (checks code_sections for specs)';

-- =============================================================================
-- Migration complete
-- =============================================================================

DO $$ BEGIN RAISE NOTICE 'Migration 016_fix_define_complete_check completed successfully!'; END $$;
