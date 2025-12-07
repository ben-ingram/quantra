-- =============================================================================
-- Quantra Production Schema
-- Run this in your Supabase SQL Editor
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. PROJECTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID, -- Will link to auth.users when auth is set up
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    cover_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. PROJECT FILES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('glb', 'gltf', 'ifc', 'pdf', 'jpg', 'jpeg', 'png', 'dwg', 'rvt')),
    file_size_bytes BIGINT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);

-- =============================================================================
-- 3. CHECKLISTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_checklists_project_id ON checklists(project_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS checklists_updated_at ON checklists;
CREATE TRIGGER checklists_updated_at
    BEFORE UPDATE ON checklists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 4. CHECKLIST ITEMS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
    requirement_text TEXT NOT NULL,
    code_reference TEXT, -- e.g., "FBC 1011.5.2"
    is_compliant BOOLEAN, -- NULL = not checked, TRUE = pass, FALSE = fail
    notes TEXT,
    rfi_link TEXT, -- Optional link to RFI or issue
    checked_at TIMESTAMPTZ,
    checked_by UUID, -- User who marked compliance
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for checklist lookups
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS checklist_items_updated_at ON checklist_items;
CREATE TRIGGER checklist_items_updated_at
    BEFORE UPDATE ON checklist_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 5. ROW LEVEL SECURITY (RLS) - Prepare for auth
-- =============================================================================

-- Enable RLS on all tables (policies will be added when auth is configured)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- Temporary policies for development (allow all operations)
-- Remove these and add proper policies when auth is set up

DROP POLICY IF EXISTS "Allow all for projects" ON projects;
CREATE POLICY "Allow all for projects" ON projects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for project_files" ON project_files;
CREATE POLICY "Allow all for project_files" ON project_files FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for checklists" ON checklists;
CREATE POLICY "Allow all for checklists" ON checklists FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for checklist_items" ON checklist_items;
CREATE POLICY "Allow all for checklist_items" ON checklist_items FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- 6. SEED SAMPLE PROJECT (Optional)
-- =============================================================================

INSERT INTO projects (id, name, description, address, cover_image_url)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Metro Station Hub',
    'Mixed-use transit-oriented development featuring a 12-story residential tower above ground-level retail and direct metro station access.',
    '1250 Transit Way, Downtown District, Metro City, MC 10001',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800'
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Run this to verify tables were created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('projects', 'project_files', 'checklists', 'checklist_items');
