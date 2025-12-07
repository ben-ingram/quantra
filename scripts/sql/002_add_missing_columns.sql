-- =============================================================================
-- Quantra Schema Migration - Add Missing Columns
-- Run this if you already have tables from a previous schema
-- =============================================================================

-- Add user_id column to projects if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE projects ADD COLUMN user_id UUID;
    END IF;
END $$;

-- Add cover_image_url column to projects if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'cover_image_url'
    ) THEN
        ALTER TABLE projects ADD COLUMN cover_image_url TEXT;
    END IF;
END $$;

-- Add updated_at column to projects if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE projects ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create index on user_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Verification
-- =============================================================================
-- Run this to check columns:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects';
