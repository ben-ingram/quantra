-- =============================================================================
-- Project Quality Phase Migration
-- Adds DMAIC-style phase tracking to projects
-- =============================================================================

-- =============================================================================
-- 1. CREATE ENUM TYPE FOR QUALITY PHASES
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE quality_phase AS ENUM ('define', 'plan', 'execute', 'control');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE quality_phase IS 'DMAIC-style quality phases: Define, Plan, Execute, Control';

-- =============================================================================
-- 2. ADD CURRENT_PHASE COLUMN TO PROJECTS
-- =============================================================================

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS current_phase quality_phase DEFAULT 'define';

COMMENT ON COLUMN projects.current_phase IS 'Current quality phase of the project workflow';

-- =============================================================================
-- 3. ADD PHASE TRANSITION TRACKING
-- =============================================================================

-- Track when phases were entered/completed
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS phase_entered_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS define_completed_at TIMESTAMPTZ;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS plan_completed_at TIMESTAMPTZ;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS execute_started_at TIMESTAMPTZ;

COMMENT ON COLUMN projects.phase_entered_at IS 'When the current phase was entered';
COMMENT ON COLUMN projects.define_completed_at IS 'When Define phase was completed (specs + BIM uploaded)';
COMMENT ON COLUMN projects.plan_completed_at IS 'When Plan phase was completed (quality manual approved)';
COMMENT ON COLUMN projects.execute_started_at IS 'When Execute phase began (daily inspections)';

-- =============================================================================
-- 4. CREATE PHASE TRANSITION LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_phase_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    from_phase quality_phase,
    to_phase quality_phase NOT NULL,

    -- What triggered the transition
    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'manual',           -- User manually advanced
        'specs_uploaded',   -- Specs document uploaded
        'bim_uploaded',     -- BIM model uploaded
        'manual_approved',  -- Quality manual approved
        'inspection_started' -- First inspection created
    )),
    trigger_details JSONB DEFAULT '{}',

    -- Who/what triggered it
    triggered_by UUID REFERENCES auth.users(id),
    triggered_at TIMESTAMPTZ DEFAULT NOW(),

    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_phase_transitions_project
ON project_phase_transitions(project_id);

CREATE INDEX IF NOT EXISTS idx_phase_transitions_date
ON project_phase_transitions(triggered_at DESC);

COMMENT ON TABLE project_phase_transitions IS 'Audit log of project phase transitions';

-- =============================================================================
-- 5. CREATE PHASE CHECK FUNCTIONS
-- =============================================================================

-- Check if Define phase requirements are met
CREATE OR REPLACE FUNCTION check_define_complete(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    has_specs BOOLEAN;
    has_bim BOOLEAN;
BEGIN
    -- Check for uploaded specs
    SELECT EXISTS (
        SELECT 1 FROM project_specs WHERE project_id = p_project_id LIMIT 1
    ) INTO has_specs;

    -- Check for uploaded BIM elements
    SELECT EXISTS (
        SELECT 1 FROM model_elements WHERE project_id = p_project_id LIMIT 1
    ) INTO has_bim;

    RETURN has_specs AND has_bim;
END;
$$;

COMMENT ON FUNCTION check_define_complete IS 'Returns TRUE if project has both specs and BIM uploaded';

-- Check if Plan phase requirements are met
CREATE OR REPLACE FUNCTION check_plan_complete(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    manual_approved BOOLEAN;
BEGIN
    -- Check for approved quality manual
    SELECT EXISTS (
        SELECT 1 FROM quality_manuals
        WHERE project_id = p_project_id
        AND status = 'approved'
        LIMIT 1
    ) INTO manual_approved;

    RETURN manual_approved;
END;
$$;

COMMENT ON FUNCTION check_plan_complete IS 'Returns TRUE if project has an approved quality manual';

-- =============================================================================
-- 6. CREATE PHASE TRANSITION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION advance_project_phase(
    p_project_id UUID,
    p_trigger_type TEXT,
    p_trigger_details JSONB DEFAULT '{}',
    p_user_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    new_phase quality_phase,
    message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_phase quality_phase;
    v_new_phase quality_phase;
    v_can_advance BOOLEAN;
BEGIN
    -- Get current phase
    SELECT current_phase INTO v_current_phase
    FROM projects WHERE id = p_project_id;

    IF v_current_phase IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::quality_phase, 'Project not found';
        RETURN;
    END IF;

    -- Determine next phase and check requirements
    CASE v_current_phase
        WHEN 'define' THEN
            v_can_advance := check_define_complete(p_project_id);
            v_new_phase := 'plan';
            IF NOT v_can_advance THEN
                RETURN QUERY SELECT FALSE, v_current_phase, 'Define phase incomplete: Upload specs and BIM model first';
                RETURN;
            END IF;

        WHEN 'plan' THEN
            v_can_advance := check_plan_complete(p_project_id);
            v_new_phase := 'execute';
            IF NOT v_can_advance THEN
                RETURN QUERY SELECT FALSE, v_current_phase, 'Plan phase incomplete: Approve quality manual first';
                RETURN;
            END IF;

        WHEN 'execute' THEN
            -- Execute can always advance to Control (project manager decision)
            v_can_advance := TRUE;
            v_new_phase := 'control';

        WHEN 'control' THEN
            -- Control is the final phase
            RETURN QUERY SELECT FALSE, v_current_phase, 'Project is already in Control phase (final)';
            RETURN;
    END CASE;

    -- Update project phase
    UPDATE projects SET
        current_phase = v_new_phase,
        phase_entered_at = NOW(),
        define_completed_at = CASE WHEN v_current_phase = 'define' THEN NOW() ELSE define_completed_at END,
        plan_completed_at = CASE WHEN v_current_phase = 'plan' THEN NOW() ELSE plan_completed_at END,
        execute_started_at = CASE WHEN v_new_phase = 'execute' THEN NOW() ELSE execute_started_at END
    WHERE id = p_project_id;

    -- Log the transition
    INSERT INTO project_phase_transitions (
        project_id, from_phase, to_phase, trigger_type, trigger_details, triggered_by, notes
    ) VALUES (
        p_project_id, v_current_phase, v_new_phase, p_trigger_type, p_trigger_details, p_user_id, p_notes
    );

    RETURN QUERY SELECT TRUE, v_new_phase, 'Phase advanced to ' || v_new_phase::TEXT;
END;
$$;

COMMENT ON FUNCTION advance_project_phase IS 'Advances project to next phase if requirements are met';

-- =============================================================================
-- 7. CREATE AUTO-ADVANCE TRIGGERS
-- =============================================================================

-- Trigger function to check and auto-advance from Define phase
CREATE OR REPLACE FUNCTION check_auto_advance_define()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_phase quality_phase;
BEGIN
    -- Get current phase
    SELECT current_phase INTO v_current_phase
    FROM projects WHERE id = NEW.project_id;

    -- Only auto-advance if in Define phase
    IF v_current_phase = 'define' AND check_define_complete(NEW.project_id) THEN
        PERFORM advance_project_phase(
            NEW.project_id,
            TG_ARGV[0], -- trigger_type passed as argument
            jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id),
            NULL,
            'Auto-advanced: Define phase requirements met'
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger on project_specs insert
DROP TRIGGER IF EXISTS trg_check_define_on_specs ON project_specs;
CREATE TRIGGER trg_check_define_on_specs
    AFTER INSERT ON project_specs
    FOR EACH ROW
    EXECUTE FUNCTION check_auto_advance_define('specs_uploaded');

-- Trigger on model_elements insert (only first element triggers check)
DROP TRIGGER IF EXISTS trg_check_define_on_bim ON model_elements;
CREATE TRIGGER trg_check_define_on_bim
    AFTER INSERT ON model_elements
    FOR EACH ROW
    EXECUTE FUNCTION check_auto_advance_define('bim_uploaded');

-- Trigger function to auto-advance from Plan phase when manual approved
CREATE OR REPLACE FUNCTION check_auto_advance_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_phase quality_phase;
BEGIN
    -- Only trigger on status change to 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
        -- Get current phase
        SELECT current_phase INTO v_current_phase
        FROM projects WHERE id = NEW.project_id;

        -- Auto-advance if in Plan phase
        IF v_current_phase = 'plan' THEN
            PERFORM advance_project_phase(
                NEW.project_id,
                'manual_approved',
                jsonb_build_object('manual_id', NEW.id),
                NEW.approved_by,
                'Auto-advanced: Quality manual approved'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger on quality_manuals update
DROP TRIGGER IF EXISTS trg_check_plan_on_manual ON quality_manuals;
CREATE TRIGGER trg_check_plan_on_manual
    AFTER UPDATE ON quality_manuals
    FOR EACH ROW
    EXECUTE FUNCTION check_auto_advance_plan();

-- =============================================================================
-- 8. CREATE PHASE STATUS VIEW
-- =============================================================================

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

    -- Counts for progress
    (SELECT COUNT(*) FROM project_specs WHERE project_id = p.id) AS specs_count,
    (SELECT COUNT(*) FROM model_elements WHERE project_id = p.id) AS bim_elements_count,
    (SELECT COUNT(*) FROM quality_manuals WHERE project_id = p.id AND status = 'approved') AS approved_manuals_count,
    -- checklist_items links through checklists table
    (SELECT COUNT(*) FROM checklist_items ci
     JOIN checklists c ON ci.checklist_id = c.id
     WHERE c.project_id = p.id) AS checklist_items_count

FROM projects p;

COMMENT ON VIEW project_phase_status IS 'Comprehensive view of project phase status and progress';

-- =============================================================================
-- 9. ADD RLS POLICIES
-- =============================================================================

ALTER TABLE project_phase_transitions ENABLE ROW LEVEL SECURITY;

-- Allow all for now (development)
DROP POLICY IF EXISTS "Allow all for phase_transitions" ON project_phase_transitions;
CREATE POLICY "Allow all for phase_transitions"
ON project_phase_transitions FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- 10. SET EXISTING PROJECTS TO APPROPRIATE PHASE
-- =============================================================================

-- Update existing projects based on their current state
DO $$
DECLARE
    proj RECORD;
BEGIN
    FOR proj IN SELECT id FROM projects LOOP
        -- Check if should be in Execute (has approved manual)
        IF check_plan_complete(proj.id) THEN
            UPDATE projects SET
                current_phase = 'execute',
                define_completed_at = COALESCE(define_completed_at, NOW()),
                plan_completed_at = COALESCE(plan_completed_at, NOW()),
                execute_started_at = COALESCE(execute_started_at, NOW())
            WHERE id = proj.id AND current_phase = 'define';
        -- Check if should be in Plan (has specs and BIM)
        ELSIF check_define_complete(proj.id) THEN
            UPDATE projects SET
                current_phase = 'plan',
                define_completed_at = COALESCE(define_completed_at, NOW())
            WHERE id = proj.id AND current_phase = 'define';
        END IF;
    END LOOP;
END $$;

-- =============================================================================
-- Migration complete
-- =============================================================================

DO $$ BEGIN RAISE NOTICE 'Migration 015_project_quality_phase completed successfully!'; END $$;
