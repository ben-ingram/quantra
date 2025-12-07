-- =============================================================================
-- Checklist Parameter Validation Migration
-- Adds columns for measurable parameter tracking and validation
-- =============================================================================

-- =============================================================================
-- 1. ADD PARAMETER VALIDATION COLUMNS TO CHECKLIST_ITEMS
-- =============================================================================

-- Parameter name (what is being measured)
-- e.g., "Stair Riser Height", "Door Width", "Corridor Width"
ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS parameter_name TEXT;

-- Target value from code requirements (what the code specifies)
-- Stored as JSONB to support complex values like ranges, minimums, maximums
-- e.g., {"max": 7, "unit": "inches"} or {"min": 36, "unit": "inches"}
ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS target_value JSONB;

-- Designed value from project drawings/BIM (what was designed)
-- e.g., "6.5 inches" or "38 inches"
ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS designed_value TEXT;

-- Measured value entered by inspector during field inspection
-- e.g., "6.75 inches"
ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS measured_value TEXT;

-- Unit of measurement
-- e.g., "inches", "feet", "mm", "count", "percent", "degrees"
ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS unit TEXT;

-- Comparison logic for validation
-- Defines how measured/designed values should be compared to target
ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS comparison_logic TEXT
    CHECK (comparison_logic IS NULL OR comparison_logic IN (
        'less_than',           -- value must be < target (e.g., max riser height)
        'less_than_or_equal',  -- value must be <= target
        'greater_than',        -- value must be > target
        'greater_than_or_equal', -- value must be >= target (e.g., min door width)
        'equal',               -- value must exactly match target
        'between',             -- value must be within range (uses target_value.min and .max)
        'not_equal',           -- value must not equal target
        'contains',            -- for text matching
        'matches_pattern'      -- for regex patterns
    ));

-- Validation result (computed when measured_value is entered)
ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS validation_result TEXT
    CHECK (validation_result IS NULL OR validation_result IN (
        'pass',        -- measured value meets requirement
        'fail',        -- measured value does not meet requirement
        'warning',     -- close to threshold, needs review
        'not_measured' -- no measured value yet
    ));

-- Validation notes (inspector's comments on the measurement)
ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS validation_notes TEXT;

-- When the measurement was taken
ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS measured_at TIMESTAMPTZ;

-- Who took the measurement (user ID)
ALTER TABLE checklist_items
ADD COLUMN IF NOT EXISTS measured_by TEXT;

-- =============================================================================
-- 2. ADD INDEXES FOR COMMON QUERIES
-- =============================================================================

-- Index for finding items with parameters
CREATE INDEX IF NOT EXISTS idx_checklist_items_has_parameter
ON checklist_items(checklist_id)
WHERE parameter_name IS NOT NULL;

-- Index for validation status filtering
CREATE INDEX IF NOT EXISTS idx_checklist_items_validation_result
ON checklist_items(validation_result)
WHERE validation_result IS NOT NULL;

-- Composite index for checklist + validation queries
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_validation
ON checklist_items(checklist_id, validation_result);

-- =============================================================================
-- 3. ADD COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON COLUMN checklist_items.parameter_name IS 'Name of the measurable parameter (e.g., "Stair Riser Height")';
COMMENT ON COLUMN checklist_items.target_value IS 'Code-required value as JSONB (e.g., {"max": 7, "unit": "inches"} or {"min": 36, "max": 44})';
COMMENT ON COLUMN checklist_items.designed_value IS 'Value from project drawings/BIM model';
COMMENT ON COLUMN checklist_items.measured_value IS 'Field-measured value entered by inspector';
COMMENT ON COLUMN checklist_items.unit IS 'Unit of measurement (inches, feet, mm, count, percent, degrees)';
COMMENT ON COLUMN checklist_items.comparison_logic IS 'How to compare measured value to target (less_than, greater_than_or_equal, between, etc.)';
COMMENT ON COLUMN checklist_items.validation_result IS 'Result of validation: pass, fail, warning, or not_measured';
COMMENT ON COLUMN checklist_items.validation_notes IS 'Inspector notes about the measurement or validation';
COMMENT ON COLUMN checklist_items.measured_at IS 'Timestamp when measurement was recorded';
COMMENT ON COLUMN checklist_items.measured_by IS 'User ID of person who recorded the measurement';

-- =============================================================================
-- 4. CREATE VALIDATION FUNCTION
-- =============================================================================

-- Function to validate a measured value against target
CREATE OR REPLACE FUNCTION validate_checklist_measurement(
    p_measured_value TEXT,
    p_target_value JSONB,
    p_comparison_logic TEXT,
    p_tolerance FLOAT DEFAULT 0.05  -- 5% tolerance for warnings
)
RETURNS TEXT  -- Returns 'pass', 'fail', or 'warning'
LANGUAGE plpgsql
AS $$
DECLARE
    measured_num FLOAT;
    target_num FLOAT;
    target_min FLOAT;
    target_max FLOAT;
    tolerance_amount FLOAT;
BEGIN
    -- Handle NULL inputs
    IF p_measured_value IS NULL OR p_target_value IS NULL OR p_comparison_logic IS NULL THEN
        RETURN 'not_measured';
    END IF;

    -- Try to parse measured value as number
    BEGIN
        measured_num := p_measured_value::FLOAT;
    EXCEPTION WHEN OTHERS THEN
        -- Non-numeric comparison (for text matching)
        IF p_comparison_logic = 'equal' THEN
            IF p_measured_value = p_target_value->>'value' THEN
                RETURN 'pass';
            ELSE
                RETURN 'fail';
            END IF;
        ELSIF p_comparison_logic = 'contains' THEN
            IF p_measured_value ILIKE '%' || (p_target_value->>'value') || '%' THEN
                RETURN 'pass';
            ELSE
                RETURN 'fail';
            END IF;
        END IF;
        RETURN 'fail';
    END;

    -- Extract target values
    target_num := (p_target_value->>'value')::FLOAT;
    target_min := (p_target_value->>'min')::FLOAT;
    target_max := (p_target_value->>'max')::FLOAT;

    -- Calculate tolerance
    IF target_num IS NOT NULL THEN
        tolerance_amount := ABS(target_num * p_tolerance);
    ELSIF target_max IS NOT NULL THEN
        tolerance_amount := ABS(target_max * p_tolerance);
    ELSIF target_min IS NOT NULL THEN
        tolerance_amount := ABS(target_min * p_tolerance);
    ELSE
        tolerance_amount := 0;
    END IF;

    -- Perform comparison based on logic type
    CASE p_comparison_logic
        WHEN 'less_than' THEN
            IF target_max IS NOT NULL THEN
                IF measured_num < target_max THEN
                    RETURN 'pass';
                ELSIF measured_num < target_max + tolerance_amount THEN
                    RETURN 'warning';
                ELSE
                    RETURN 'fail';
                END IF;
            ELSIF target_num IS NOT NULL THEN
                IF measured_num < target_num THEN
                    RETURN 'pass';
                ELSIF measured_num < target_num + tolerance_amount THEN
                    RETURN 'warning';
                ELSE
                    RETURN 'fail';
                END IF;
            END IF;

        WHEN 'less_than_or_equal' THEN
            IF target_max IS NOT NULL THEN
                IF measured_num <= target_max THEN
                    RETURN 'pass';
                ELSIF measured_num <= target_max + tolerance_amount THEN
                    RETURN 'warning';
                ELSE
                    RETURN 'fail';
                END IF;
            ELSIF target_num IS NOT NULL THEN
                IF measured_num <= target_num THEN
                    RETURN 'pass';
                ELSIF measured_num <= target_num + tolerance_amount THEN
                    RETURN 'warning';
                ELSE
                    RETURN 'fail';
                END IF;
            END IF;

        WHEN 'greater_than' THEN
            IF target_min IS NOT NULL THEN
                IF measured_num > target_min THEN
                    RETURN 'pass';
                ELSIF measured_num > target_min - tolerance_amount THEN
                    RETURN 'warning';
                ELSE
                    RETURN 'fail';
                END IF;
            ELSIF target_num IS NOT NULL THEN
                IF measured_num > target_num THEN
                    RETURN 'pass';
                ELSIF measured_num > target_num - tolerance_amount THEN
                    RETURN 'warning';
                ELSE
                    RETURN 'fail';
                END IF;
            END IF;

        WHEN 'greater_than_or_equal' THEN
            IF target_min IS NOT NULL THEN
                IF measured_num >= target_min THEN
                    RETURN 'pass';
                ELSIF measured_num >= target_min - tolerance_amount THEN
                    RETURN 'warning';
                ELSE
                    RETURN 'fail';
                END IF;
            ELSIF target_num IS NOT NULL THEN
                IF measured_num >= target_num THEN
                    RETURN 'pass';
                ELSIF measured_num >= target_num - tolerance_amount THEN
                    RETURN 'warning';
                ELSE
                    RETURN 'fail';
                END IF;
            END IF;

        WHEN 'equal' THEN
            IF target_num IS NOT NULL THEN
                IF measured_num = target_num THEN
                    RETURN 'pass';
                ELSIF ABS(measured_num - target_num) <= tolerance_amount THEN
                    RETURN 'warning';
                ELSE
                    RETURN 'fail';
                END IF;
            END IF;

        WHEN 'between' THEN
            IF target_min IS NOT NULL AND target_max IS NOT NULL THEN
                IF measured_num >= target_min AND measured_num <= target_max THEN
                    RETURN 'pass';
                ELSIF measured_num >= target_min - tolerance_amount AND measured_num <= target_max + tolerance_amount THEN
                    RETURN 'warning';
                ELSE
                    RETURN 'fail';
                END IF;
            END IF;

        WHEN 'not_equal' THEN
            IF target_num IS NOT NULL THEN
                IF measured_num != target_num THEN
                    RETURN 'pass';
                ELSE
                    RETURN 'fail';
                END IF;
            END IF;

        ELSE
            RETURN 'not_measured';
    END CASE;

    RETURN 'not_measured';
END;
$$;

COMMENT ON FUNCTION validate_checklist_measurement IS 'Validates a measured value against a target using specified comparison logic';

-- =============================================================================
-- 5. CREATE TRIGGER TO AUTO-VALIDATE ON MEASUREMENT UPDATE
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_validate_measurement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only validate if we have the required fields
    IF NEW.measured_value IS NOT NULL AND NEW.target_value IS NOT NULL AND NEW.comparison_logic IS NOT NULL THEN
        NEW.validation_result := validate_checklist_measurement(
            NEW.measured_value,
            NEW.target_value,
            NEW.comparison_logic
        );

        -- Set measured_at if not already set
        IF NEW.measured_at IS NULL AND OLD.measured_value IS DISTINCT FROM NEW.measured_value THEN
            NEW.measured_at := NOW();
        END IF;
    ELSIF NEW.measured_value IS NULL THEN
        NEW.validation_result := 'not_measured';
    END IF;

    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_validate_measurement ON checklist_items;

-- Create trigger
CREATE TRIGGER trg_validate_measurement
    BEFORE INSERT OR UPDATE OF measured_value, target_value, comparison_logic
    ON checklist_items
    FOR EACH ROW
    EXECUTE FUNCTION trigger_validate_measurement();

-- =============================================================================
-- 6. CREATE VIEW FOR PARAMETER SUMMARY
-- =============================================================================

CREATE OR REPLACE VIEW checklist_parameter_summary AS
SELECT
    ci.checklist_id,
    c.project_id,
    COUNT(*) FILTER (WHERE ci.parameter_name IS NOT NULL) AS total_parameters,
    COUNT(*) FILTER (WHERE ci.validation_result = 'pass') AS passed,
    COUNT(*) FILTER (WHERE ci.validation_result = 'fail') AS failed,
    COUNT(*) FILTER (WHERE ci.validation_result = 'warning') AS warnings,
    COUNT(*) FILTER (WHERE ci.validation_result = 'not_measured' OR ci.measured_value IS NULL) AS not_measured,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE ci.validation_result = 'pass') /
        NULLIF(COUNT(*) FILTER (WHERE ci.parameter_name IS NOT NULL), 0),
        1
    ) AS pass_rate_percent
FROM checklist_items ci
JOIN checklists c ON ci.checklist_id = c.id
WHERE ci.parameter_name IS NOT NULL
GROUP BY ci.checklist_id, c.project_id;

COMMENT ON VIEW checklist_parameter_summary IS 'Summary of parameter validation status per checklist';

-- =============================================================================
-- 7. EXAMPLE DATA STRUCTURE
-- =============================================================================

-- Example of how target_value JSONB would be structured:
--
-- For maximum value (e.g., max riser height 7"):
-- {"max": 7, "unit": "inches", "code_ref": "1011.5.2"}
--
-- For minimum value (e.g., min door width 32"):
-- {"min": 32, "unit": "inches", "code_ref": "1010.1.1"}
--
-- For range (e.g., handrail height 34-38"):
-- {"min": 34, "max": 38, "unit": "inches", "code_ref": "1014.3.1"}
--
-- For exact match (e.g., number of exits):
-- {"value": 2, "unit": "count", "code_ref": "1006.2"}

-- =============================================================================
-- Migration complete
-- =============================================================================

DO $$ BEGIN RAISE NOTICE 'Migration 011_checklist_parameter_validation completed successfully!'; END $$;
