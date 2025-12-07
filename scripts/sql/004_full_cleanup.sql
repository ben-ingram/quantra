-- =============================================================================
-- Quantra Schema - Full Cleanup and Rebuild
-- This drops ALL old tables and creates a clean production schema
-- =============================================================================

-- Drop all existing tables that reference projects (from old Prisma schema)
DROP TABLE IF EXISTS project_assignments CASCADE;
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS checklists CASCADE;
DROP TABLE IF EXISTS project_files CASCADE;
DROP TABLE IF EXISTS compliance_checks CASCADE;
DROP TABLE IF EXISTS issues CASCADE;
DROP TABLE IF EXISTS scans CASCADE;
DROP TABLE IF EXISTS regulatory_codes CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- Also drop any other Prisma tables that might exist
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;

-- =============================================================================
-- Enable Extensions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. PROJECTS TABLE (Clean)
-- =============================================================================

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    cover_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. PROJECT FILES TABLE
-- =============================================================================

CREATE TABLE project_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('glb', 'gltf', 'ifc', 'pdf', 'jpg', 'jpeg', 'png', 'dwg', 'rvt')),
    file_size_bytes BIGINT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_files_project_id ON project_files(project_id);

-- =============================================================================
-- 3. CHECKLISTS TABLE
-- =============================================================================

CREATE TABLE checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checklists_project_id ON checklists(project_id);

CREATE TRIGGER checklists_updated_at
    BEFORE UPDATE ON checklists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 4. CHECKLIST ITEMS TABLE
-- =============================================================================

CREATE TABLE checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
    requirement_text TEXT NOT NULL,
    code_reference TEXT,
    is_compliant BOOLEAN,
    notes TEXT,
    rfi_link TEXT,
    checked_at TIMESTAMPTZ,
    checked_by UUID,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checklist_items_checklist_id ON checklist_items(checklist_id);

CREATE TRIGGER checklist_items_updated_at
    BEFORE UPDATE ON checklist_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- Development policies (allow all - replace with proper auth policies later)
CREATE POLICY "Allow all for projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for project_files" ON project_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for checklists" ON checklists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for checklist_items" ON checklist_items FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- 6. SEED SAMPLE PROJECT (Optional)
-- =============================================================================

INSERT INTO projects (name, description, address)
VALUES (
    'Metro Station Hub',
    'Mixed-use transit-oriented development featuring a 12-story residential tower above ground-level retail.',
    '1250 Transit Way, Downtown District'
);

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- Run this to verify:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
