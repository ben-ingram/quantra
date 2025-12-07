-- =============================================================================
-- Chapter Filtering Migration for code_sections
-- Adds chapter and occupancy_group columns, backfills from metadata,
-- and updates hybrid_search RPC to support chapter filtering
-- =============================================================================

-- =============================================================================
-- 1. ADD NEW COLUMNS TO code_sections
-- =============================================================================

-- Add chapter column (e.g., "10", "4", "11")
ALTER TABLE code_sections
ADD COLUMN IF NOT EXISTS chapter TEXT;

-- Add occupancy_group column for future filtering (e.g., "A", "B", "E", "H", "I", "M", "R", "S", "U")
ALTER TABLE code_sections
ADD COLUMN IF NOT EXISTS occupancy_group TEXT;

-- Create index for chapter filtering (important for performance)
CREATE INDEX IF NOT EXISTS idx_code_sections_chapter ON code_sections(chapter);
CREATE INDEX IF NOT EXISTS idx_code_sections_occupancy_group ON code_sections(occupancy_group);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_code_sections_jurisdiction_chapter
ON code_sections(jurisdiction, chapter);

COMMENT ON COLUMN code_sections.chapter IS 'FBC chapter number extracted from source filename (e.g., "10" for Chapter 10 - Means of Egress)';
COMMENT ON COLUMN code_sections.occupancy_group IS 'Occupancy group classification (A, B, E, H, I, M, R, S, U) for filtered searches';

-- =============================================================================
-- 2. BACKFILL CHAPTER FROM METADATA->filename
-- =============================================================================

DO $$
DECLARE
    row_record RECORD;
    filename_val TEXT;
    chapter_match TEXT[];
    extracted_chapter TEXT;
    updated_count INTEGER := 0;
    total_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting chapter backfill from metadata...';

    -- Count total rows
    SELECT COUNT(*) INTO total_count FROM code_sections WHERE chapter IS NULL;
    RAISE NOTICE 'Found % rows to process', total_count;

    -- Iterate through all rows that don't have a chapter set
    FOR row_record IN
        SELECT id, metadata
        FROM code_sections
        WHERE chapter IS NULL
    LOOP
        -- Extract filename from metadata
        filename_val := row_record.metadata->>'filename';

        IF filename_val IS NOT NULL THEN
            -- Try to extract chapter number using regex
            -- Matches patterns like: Chapter_10.pdf, Chapter10.pdf, chapter-10.pdf, Ch10.pdf, etc.
            chapter_match := regexp_match(filename_val, '(?:Chapter|Ch|chapter|ch)[_\-\s]?(\d+)', 'i');

            IF chapter_match IS NOT NULL AND array_length(chapter_match, 1) > 0 THEN
                extracted_chapter := chapter_match[1];

                -- Update the row
                UPDATE code_sections
                SET chapter = extracted_chapter
                WHERE id = row_record.id;

                updated_count := updated_count + 1;

                -- Log progress every 1000 rows
                IF updated_count % 1000 = 0 THEN
                    RAISE NOTICE 'Processed % rows...', updated_count;
                END IF;
            END IF;
        END IF;

        -- Also try to extract from section_number if filename didn't work
        IF row_record.metadata->>'filename' IS NULL THEN
            -- Try section_number pattern like "1011.5.2" -> chapter "10"
            chapter_match := regexp_match(
                COALESCE(row_record.metadata->>'section_number', ''),
                '^(\d{1,2})\d{2}'
            );

            IF chapter_match IS NOT NULL AND array_length(chapter_match, 1) > 0 THEN
                extracted_chapter := chapter_match[1];

                UPDATE code_sections
                SET chapter = extracted_chapter
                WHERE id = row_record.id;

                updated_count := updated_count + 1;
            END IF;
        END IF;
    END LOOP;

    RAISE NOTICE 'Chapter backfill complete. Updated % of % rows.', updated_count, total_count;
END $$;

-- =============================================================================
-- 3. UPDATE hybrid_search FUNCTION WITH CHAPTER FILTER
-- =============================================================================

-- Drop existing function to replace it
DROP FUNCTION IF EXISTS hybrid_search(TEXT, vector, FLOAT, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS hybrid_search(TEXT, vector, FLOAT, INTEGER, TEXT, TEXT, TEXT);

-- Create updated function with chapter filter
CREATE OR REPLACE FUNCTION hybrid_search(
    query_text TEXT,
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INTEGER DEFAULT 10,
    filter_jurisdiction TEXT DEFAULT NULL,
    filter_code_name TEXT DEFAULT NULL,
    filter_chapter TEXT DEFAULT NULL  -- NEW: Optional chapter filter
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    section_number TEXT,
    section_title TEXT,
    metadata JSONB,
    jurisdiction TEXT,
    code_name TEXT,
    code_version TEXT,
    page_number INTEGER,
    chapter TEXT,  -- NEW: Include chapter in results
    vector_score FLOAT,
    keyword_score FLOAT,
    combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- Weights for combining scores
    vector_weight FLOAT := 0.7;
    keyword_weight FLOAT := 0.3;
BEGIN
    RETURN QUERY
    WITH vector_search AS (
        -- Semantic similarity search
        SELECT
            cs.id,
            cs.content,
            cs.section_number,
            cs.section_title,
            cs.metadata,
            cs.jurisdiction,
            cs.code_name,
            cs.code_version,
            cs.page_number,
            cs.chapter,
            1 - (cs.embedding <=> query_embedding) AS similarity
        FROM code_sections cs
        WHERE
            -- Apply chapter filter if provided
            (filter_chapter IS NULL OR cs.chapter = filter_chapter)
            -- Apply jurisdiction filter if provided
            AND (filter_jurisdiction IS NULL OR cs.jurisdiction = filter_jurisdiction)
            -- Apply code name filter if provided
            AND (filter_code_name IS NULL OR cs.code_name = filter_code_name)
            -- Only include results above threshold
            AND 1 - (cs.embedding <=> query_embedding) > match_threshold
        ORDER BY cs.embedding <=> query_embedding
        LIMIT match_count * 2  -- Get more candidates for re-ranking
    ),
    keyword_search AS (
        -- Full-text keyword search
        SELECT
            cs.id,
            ts_rank_cd(
                to_tsvector('english', cs.content),
                plainto_tsquery('english', query_text)
            ) AS rank
        FROM code_sections cs
        WHERE
            -- Apply same filters
            (filter_chapter IS NULL OR cs.chapter = filter_chapter)
            AND (filter_jurisdiction IS NULL OR cs.jurisdiction = filter_jurisdiction)
            AND (filter_code_name IS NULL OR cs.code_name = filter_code_name)
            -- Must have some keyword match
            AND to_tsvector('english', cs.content) @@ plainto_tsquery('english', query_text)
    ),
    combined AS (
        -- Combine vector and keyword scores
        SELECT
            vs.id,
            vs.content,
            vs.section_number,
            vs.section_title,
            vs.metadata,
            vs.jurisdiction,
            vs.code_name,
            vs.code_version,
            vs.page_number,
            vs.chapter,
            vs.similarity AS vector_score,
            COALESCE(ks.rank, 0) AS keyword_score,
            -- Weighted combination
            (vs.similarity * vector_weight) +
            (COALESCE(ks.rank, 0) * keyword_weight) AS combined_score
        FROM vector_search vs
        LEFT JOIN keyword_search ks ON vs.id = ks.id
    )
    SELECT
        c.id,
        c.content,
        c.section_number,
        c.section_title,
        c.metadata,
        c.jurisdiction,
        c.code_name,
        c.code_version,
        c.page_number,
        c.chapter,
        c.vector_score::FLOAT,
        c.keyword_score::FLOAT,
        c.combined_score::FLOAT
    FROM combined c
    ORDER BY c.combined_score DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION hybrid_search IS 'Hybrid semantic + keyword search with optional chapter, jurisdiction, and code name filters';

-- =============================================================================
-- 4. UPDATE search_code_tables WITH CHAPTER FILTER
-- =============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS search_code_tables(TEXT, vector, FLOAT, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS search_code_tables(TEXT, vector, FLOAT, INTEGER, TEXT, TEXT, TEXT);

-- Add chapter column to code_tables if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'code_tables') THEN
        ALTER TABLE code_tables ADD COLUMN IF NOT EXISTS chapter TEXT;
        CREATE INDEX IF NOT EXISTS idx_code_tables_chapter ON code_tables(chapter);
    END IF;
END $$;

-- Create updated function with chapter filter
CREATE OR REPLACE FUNCTION search_code_tables(
    query_text TEXT,
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.8,
    match_count INTEGER DEFAULT 5,
    filter_jurisdiction TEXT DEFAULT NULL,
    filter_code_name TEXT DEFAULT NULL,
    filter_chapter TEXT DEFAULT NULL  -- NEW: Optional chapter filter
)
RETURNS TABLE (
    id UUID,
    table_id TEXT,
    table_title TEXT,
    summary TEXT,
    data JSONB,
    metadata JSONB,
    jurisdiction TEXT,
    code_name TEXT,
    section_reference TEXT,
    chapter TEXT,  -- NEW: Include chapter in results
    vector_score FLOAT,
    keyword_score FLOAT,
    combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    vector_weight FLOAT := 0.7;
    keyword_weight FLOAT := 0.3;
BEGIN
    -- Check if code_tables exists
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'code_tables') THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH vector_search AS (
        SELECT
            ct.id,
            ct.table_id,
            ct.table_title,
            ct.summary,
            ct.data,
            ct.metadata,
            ct.jurisdiction,
            ct.code_name,
            ct.section_reference,
            ct.chapter,
            1 - (ct.embedding <=> query_embedding) AS similarity
        FROM code_tables ct
        WHERE
            (filter_chapter IS NULL OR ct.chapter = filter_chapter)
            AND (filter_jurisdiction IS NULL OR ct.jurisdiction = filter_jurisdiction)
            AND (filter_code_name IS NULL OR ct.code_name = filter_code_name)
            AND 1 - (ct.embedding <=> query_embedding) > match_threshold
        ORDER BY ct.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    keyword_search AS (
        SELECT
            ct.id,
            ts_rank_cd(
                to_tsvector('english', ct.summary || ' ' || COALESCE(ct.table_title, '')),
                plainto_tsquery('english', query_text)
            ) AS rank
        FROM code_tables ct
        WHERE
            (filter_chapter IS NULL OR ct.chapter = filter_chapter)
            AND (filter_jurisdiction IS NULL OR ct.jurisdiction = filter_jurisdiction)
            AND (filter_code_name IS NULL OR ct.code_name = filter_code_name)
            AND to_tsvector('english', ct.summary || ' ' || COALESCE(ct.table_title, ''))
                @@ plainto_tsquery('english', query_text)
    ),
    combined AS (
        SELECT
            vs.id,
            vs.table_id,
            vs.table_title,
            vs.summary,
            vs.data,
            vs.metadata,
            vs.jurisdiction,
            vs.code_name,
            vs.section_reference,
            vs.chapter,
            vs.similarity AS vector_score,
            COALESCE(ks.rank, 0) AS keyword_score,
            (vs.similarity * vector_weight) + (COALESCE(ks.rank, 0) * keyword_weight) AS combined_score
        FROM vector_search vs
        LEFT JOIN keyword_search ks ON vs.id = ks.id
    )
    SELECT
        c.id,
        c.table_id,
        c.table_title,
        c.summary,
        c.data,
        c.metadata,
        c.jurisdiction,
        c.code_name,
        c.section_reference,
        c.chapter,
        c.vector_score::FLOAT,
        c.keyword_score::FLOAT,
        c.combined_score::FLOAT
    FROM combined c
    ORDER BY c.combined_score DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_code_tables IS 'Search code tables with hybrid semantic + keyword matching and optional chapter filter';

-- =============================================================================
-- 5. CREATE HELPER FUNCTION TO LIST AVAILABLE CHAPTERS
-- =============================================================================

CREATE OR REPLACE FUNCTION get_available_chapters(
    filter_jurisdiction TEXT DEFAULT NULL,
    filter_code_name TEXT DEFAULT NULL
)
RETURNS TABLE (
    chapter TEXT,
    section_count BIGINT,
    sample_titles TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cs.chapter,
        COUNT(*) AS section_count,
        (
            SELECT ARRAY_AGG(DISTINCT t.section_title)
            FROM (
                SELECT cs2.section_title
                FROM code_sections cs2
                WHERE cs2.chapter = cs.chapter
                  AND cs2.section_title IS NOT NULL
                  AND (filter_jurisdiction IS NULL OR cs2.jurisdiction = filter_jurisdiction)
                  AND (filter_code_name IS NULL OR cs2.code_name = filter_code_name)
                ORDER BY cs2.section_title
                LIMIT 5
            ) t
        ) AS sample_titles
    FROM code_sections cs
    WHERE
        cs.chapter IS NOT NULL
        AND (filter_jurisdiction IS NULL OR cs.jurisdiction = filter_jurisdiction)
        AND (filter_code_name IS NULL OR cs.code_name = filter_code_name)
    GROUP BY cs.chapter
    ORDER BY
        -- Sort numerically if possible
        CASE WHEN cs.chapter ~ '^\d+$' THEN LPAD(cs.chapter, 3, '0') ELSE cs.chapter END;
END;
$$;

COMMENT ON FUNCTION get_available_chapters IS 'List all available chapters with section counts for UI filtering';

-- =============================================================================
-- 6. CHAPTER NAME REFERENCE TABLE (Optional but helpful)
-- =============================================================================

CREATE TABLE IF NOT EXISTS fbc_chapter_reference (
    chapter TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    typical_occupancy_groups TEXT[]
);

-- Insert FBC chapter names for reference
INSERT INTO fbc_chapter_reference (chapter, title, description, typical_occupancy_groups)
VALUES
    ('1', 'Scope and Administration', 'Administrative provisions, permits, inspections', NULL),
    ('2', 'Definitions', 'Terms and definitions used throughout the code', NULL),
    ('3', 'Use and Occupancy Classification', 'Building classification by occupancy type', ARRAY['A','B','E','F','H','I','M','R','S','U']),
    ('4', 'Special Detailed Requirements', 'Covered mall buildings, high-rise, atriums, etc.', NULL),
    ('5', 'General Building Heights and Areas', 'Allowable height, area, and number of stories', NULL),
    ('6', 'Types of Construction', 'Building construction types I through V', NULL),
    ('7', 'Fire and Smoke Protection Features', 'Fire barriers, smoke barriers, shaft enclosures', NULL),
    ('8', 'Interior Finishes', 'Interior wall, ceiling, and floor finish requirements', NULL),
    ('9', 'Fire Protection Systems', 'Sprinkler systems, standpipes, fire alarms', NULL),
    ('10', 'Means of Egress', 'Exit access, exits, exit discharge, stairs, doors', NULL),
    ('11', 'Accessibility', 'Accessible routes, accessible elements, signage', NULL),
    ('12', 'Interior Environment', 'Ventilation, temperature control, lighting', NULL),
    ('13', 'Energy Efficiency', 'Energy conservation requirements', NULL),
    ('14', 'Exterior Walls', 'Weather protection, exterior wall coverings', NULL),
    ('15', 'Roof Assemblies and Rooftop Structures', 'Roofing materials, roof drainage', NULL),
    ('16', 'Structural Design', 'Structural loads, design methods', NULL),
    ('17', 'Special Inspections and Tests', 'Special inspection requirements', NULL),
    ('18', 'Soils and Foundations', 'Foundation and geotechnical requirements', NULL),
    ('19', 'Concrete', 'Concrete construction requirements', NULL),
    ('20', 'Aluminum', 'Aluminum construction requirements', NULL),
    ('21', 'Masonry', 'Masonry construction requirements', NULL),
    ('22', 'Steel', 'Steel construction requirements', NULL),
    ('23', 'Wood', 'Wood construction requirements', NULL),
    ('24', 'Glass and Glazing', 'Glass and glazing requirements', NULL),
    ('25', 'Gypsum Board, Gypsum Panel Products and Plaster', 'Gypsum and plaster requirements', NULL),
    ('26', 'Plastic', 'Plastic construction requirements', NULL),
    ('27', 'Electrical', 'Electrical system requirements', NULL),
    ('28', 'Mechanical Systems', 'HVAC and mechanical requirements', NULL),
    ('29', 'Plumbing Systems', 'Plumbing system requirements', NULL),
    ('30', 'Elevators and Conveying Systems', 'Elevator and escalator requirements', NULL),
    ('31', 'Special Construction', 'Membrane structures, temporary structures', NULL),
    ('32', 'Encroachments into the Public Right-of-Way', 'Awnings, marquees, signs over public way', NULL),
    ('33', 'Safeguards During Construction', 'Construction site safety', NULL),
    ('34', 'Existing Buildings', 'Alterations, additions, change of occupancy', NULL),
    ('35', 'Referenced Standards', 'List of referenced standards', NULL)
ON CONFLICT (chapter) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    typical_occupancy_groups = EXCLUDED.typical_occupancy_groups;

-- =============================================================================
-- 7. VERIFICATION QUERIES
-- =============================================================================

-- Check chapter distribution
-- SELECT chapter, COUNT(*) as count FROM code_sections GROUP BY chapter ORDER BY chapter;

-- Check a sample of backfilled chapters
-- SELECT id, chapter, metadata->>'filename' as filename, section_number FROM code_sections WHERE chapter IS NOT NULL LIMIT 20;

-- Test the updated hybrid_search with chapter filter
-- SELECT * FROM hybrid_search(
--     'stair riser height requirements',
--     (SELECT embedding FROM code_sections LIMIT 1),  -- Use an actual embedding
--     0.5,
--     5,
--     'Florida',
--     NULL,
--     '10'  -- Filter to Chapter 10 only
-- );

-- List available chapters
-- SELECT * FROM get_available_chapters('Florida');

-- Migration complete notification (run this to verify)
DO $$ BEGIN RAISE NOTICE 'Migration 006_chapter_filtering completed successfully!'; END $$;
