-- =============================================================================
-- Projects Refactor Migration
-- Creates/updates projects and project_files tables with proper structure
-- =============================================================================

-- =============================================================================
-- 1. DROP EXISTING TABLES IF THEY EXIST (to recreate with proper structure)
-- =============================================================================

-- Note: Only uncomment if you want to reset tables
-- DROP TABLE IF EXISTS project_files CASCADE;
-- DROP TABLE IF EXISTS projects CASCADE;

-- =============================================================================
-- 2. CREATE PROJECTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    occupancy_group TEXT CHECK (occupancy_group IN (
        'Assembly', 'Business', 'Educational', 'Factory',
        'High Hazard', 'Institutional', 'Mercantile',
        'Residential', 'Storage', 'Utility'
    )),
    construction_type TEXT CHECK (construction_type IN (
        'Type I-A', 'Type I-B', 'Type II-A', 'Type II-B',
        'Type III-A', 'Type III-B', 'Type IV',
        'Type V-A', 'Type V-B'
    )),
    cover_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (for existing tables)
DO $$
BEGIN
    -- Add occupancy_group if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'occupancy_group'
    ) THEN
        ALTER TABLE projects ADD COLUMN occupancy_group TEXT CHECK (occupancy_group IN (
            'Assembly', 'Business', 'Educational', 'Factory',
            'High Hazard', 'Institutional', 'Mercantile',
            'Residential', 'Storage', 'Utility'
        ));
    END IF;

    -- Add construction_type if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'construction_type'
    ) THEN
        ALTER TABLE projects ADD COLUMN construction_type TEXT CHECK (construction_type IN (
            'Type I-A', 'Type I-B', 'Type II-A', 'Type II-B',
            'Type III-A', 'Type III-B', 'Type IV',
            'Type V-A', 'Type V-B'
        ));
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_occupancy_group ON projects(occupancy_group);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE projects IS 'Construction projects for compliance tracking';
COMMENT ON COLUMN projects.occupancy_group IS 'FBC occupancy classification (Assembly, Business, etc.)';
COMMENT ON COLUMN projects.construction_type IS 'FBC construction type (Type I-A through Type V-B)';

-- =============================================================================
-- 3. CREATE PROJECT_FILES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN (
        'glb', 'gltf', 'ifc', 'pdf', 'jpg', 'jpeg', 'png', 'dwg', 'rvt', 'other'
    )),
    file_size_bytes BIGINT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_file_type ON project_files(file_type);

COMMENT ON TABLE project_files IS 'Files associated with projects (BIM models, drawings, images)';

-- =============================================================================
-- 4. ENABLE ROW LEVEL SECURITY (Optional - enable if using auth)
-- =============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now (adjust based on auth requirements)
DROP POLICY IF EXISTS "Allow all access to projects" ON projects;
CREATE POLICY "Allow all access to projects" ON projects
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to project_files" ON project_files;
CREATE POLICY "Allow all access to project_files" ON project_files
    FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- 5. INSERT SAMPLE PROJECT (Optional - for testing)
-- =============================================================================

-- Uncomment to insert a sample project
-- INSERT INTO projects (name, description, address, occupancy_group, construction_type)
-- VALUES (
--     'Metro Station Hub',
--     'Mixed-use transit-oriented development with retail and residential components',
--     '123 Main Street, Miami, FL 33101',
--     'Assembly',
--     'Type I-A'
-- ) ON CONFLICT DO NOTHING;

DO $$ BEGIN RAISE NOTICE 'Migration 007_projects_refactor completed successfully!'; END $$;
