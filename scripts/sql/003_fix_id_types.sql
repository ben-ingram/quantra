-- =============================================================================
-- Quantra Schema Fix - Convert TEXT IDs to UUID
-- Run this to fix type mismatches
-- =============================================================================

-- First, let's check what we're dealing with
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects';

-- Drop dependent tables if they exist (they reference projects.id)
DROP TABLE IF EXISTS checklist_items CASCADE;
DROP TABLE IF EXISTS checklists CASCADE;
DROP TABLE IF EXISTS project_files CASCADE;

-- Now we need to convert projects.id from TEXT to UUID
-- This requires recreating the table or altering the column

-- Option: Alter the column type (works if existing IDs are valid UUIDs)
-- If your existing IDs are already UUID format stored as TEXT, this will work:
ALTER TABLE projects
    ALTER COLUMN id TYPE UUID USING id::uuid;

-- If the above fails, you may need to drop and recreate projects table
-- Uncomment the following if the ALTER fails:
-- DROP TABLE IF EXISTS projects CASCADE;
-- CREATE TABLE projects (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     user_id UUID,
--     name TEXT NOT NULL,
--     description TEXT,
--     address TEXT,
--     cover_image_url TEXT,
--     created_at TIMESTAMPTZ DEFAULT NOW(),
--     updated_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- =============================================================================
-- Now recreate the dependent tables with proper UUID types
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Project Files
CREATE TABLE IF NOT EXISTS project_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('glb', 'gltf', 'ifc', 'pdf', 'jpg', 'jpeg', 'png', 'dwg', 'rvt')),
    file_size_bytes BIGINT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);

-- Checklists
CREATE TABLE IF NOT EXISTS checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklists_project_id ON checklists(project_id);

DROP TRIGGER IF EXISTS checklists_updated_at ON checklists;
CREATE TRIGGER checklists_updated_at
    BEFORE UPDATE ON checklists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Checklist Items
CREATE TABLE IF NOT EXISTS checklist_items (
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

CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);

DROP TRIGGER IF EXISTS checklist_items_updated_at ON checklist_items;
CREATE TRIGGER checklist_items_updated_at
    BEFORE UPDATE ON checklist_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Enable RLS
-- =============================================================================

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- Development policies (allow all)
DROP POLICY IF EXISTS "Allow all for project_files" ON project_files;
CREATE POLICY "Allow all for project_files" ON project_files FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for checklists" ON checklists;
CREATE POLICY "Allow all for checklists" ON checklists FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for checklist_items" ON checklist_items;
CREATE POLICY "Allow all for checklist_items" ON checklist_items FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- Verification
-- =============================================================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects';
