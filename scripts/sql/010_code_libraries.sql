-- =============================================================================
-- Code Libraries Migration
-- Multi-state building code support with semantic chapter routing
-- =============================================================================

-- =============================================================================
-- 1. CODE_LIBRARIES TABLE
-- Master table for each building code "book"
-- =============================================================================

CREATE TABLE IF NOT EXISTS code_libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    name TEXT NOT NULL,                    -- e.g., "Florida Building Code 2023"
    short_name TEXT,                       -- e.g., "FBC 2023" (for UI)

    -- Location
    state TEXT NOT NULL,                   -- e.g., "FL", "CA", "NY"
    jurisdiction TEXT DEFAULT 'Statewide', -- e.g., "Statewide", "Miami-Dade", "Los Angeles"

    -- Version info
    version TEXT,                          -- e.g., "2023", "8th Edition"
    effective_date DATE,                   -- When the code became effective

    -- Status
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived', 'draft', 'superseded')),

    -- Metadata
    description TEXT,                      -- Brief description of the code
    source_url TEXT,                       -- Official source URL

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_code_libraries_state ON code_libraries(state);
CREATE INDEX IF NOT EXISTS idx_code_libraries_status ON code_libraries(status);
CREATE INDEX IF NOT EXISTS idx_code_libraries_state_status ON code_libraries(state, status);

-- Unique constraint: one active code per state/jurisdiction combo
CREATE UNIQUE INDEX IF NOT EXISTS idx_code_libraries_unique_active
ON code_libraries(state, jurisdiction)
WHERE status = 'active';

COMMENT ON TABLE code_libraries IS 'Master registry of building code books (e.g., FBC 2023, CBC 2022)';
COMMENT ON COLUMN code_libraries.state IS 'Two-letter state code (FL, CA, NY, etc.)';
COMMENT ON COLUMN code_libraries.jurisdiction IS 'Sub-state jurisdiction if applicable (Statewide, Miami-Dade, etc.)';
COMMENT ON COLUMN code_libraries.status IS 'active = current code, archived = historical, draft = not yet effective, superseded = replaced by newer version';

-- =============================================================================
-- 2. CODE_STRUCTURE TABLE
-- Chapter-level organization with semantic embeddings for routing
-- =============================================================================

CREATE TABLE IF NOT EXISTS code_structure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Parent library
    library_id UUID NOT NULL REFERENCES code_libraries(id) ON DELETE CASCADE,

    -- Chapter identity
    chapter_number TEXT NOT NULL,          -- e.g., "10", "3A"
    chapter_title TEXT NOT NULL,           -- e.g., "Means of Egress"

    -- Semantic embedding for chapter routing
    -- Embed the chapter title + description for semantic chapter selection
    embedding vector(1536),

    -- Additional metadata
    description TEXT,                      -- Extended description for better embeddings
    page_start INTEGER,                    -- Starting page in source document
    page_end INTEGER,                      -- Ending page in source document
    section_count INTEGER DEFAULT 0,       -- Number of sections in this chapter

    -- Common topics (for keyword fallback)
    topics TEXT[],                         -- e.g., ARRAY['egress', 'exits', 'stairs', 'doors']

    -- Ordering
    sort_order INTEGER,                    -- For display ordering

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique chapter per library
    UNIQUE(library_id, chapter_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_code_structure_library ON code_structure(library_id);
CREATE INDEX IF NOT EXISTS idx_code_structure_chapter ON code_structure(chapter_number);

-- Vector index for semantic chapter routing (using HNSW for fast approximate search)
CREATE INDEX IF NOT EXISTS idx_code_structure_embedding
ON code_structure USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

COMMENT ON TABLE code_structure IS 'Chapter structure with embeddings for semantic routing to the correct chapter';
COMMENT ON COLUMN code_structure.embedding IS 'Vector embedding of chapter title + description for semantic chapter selection';
COMMENT ON COLUMN code_structure.topics IS 'Keyword topics for fallback matching when semantic search is ambiguous';

-- =============================================================================
-- 3. UPDATE CODE_SECTIONS TABLE
-- Add library_id foreign key
-- =============================================================================

-- Add library_id column
ALTER TABLE code_sections
ADD COLUMN IF NOT EXISTS library_id UUID REFERENCES code_libraries(id) ON DELETE SET NULL;

-- Add chapter_id column for direct chapter linking
ALTER TABLE code_sections
ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES code_structure(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_code_sections_library ON code_sections(library_id);
CREATE INDEX IF NOT EXISTS idx_code_sections_chapter_id ON code_sections(chapter_id);
CREATE INDEX IF NOT EXISTS idx_code_sections_library_chapter ON code_sections(library_id, chapter);

COMMENT ON COLUMN code_sections.library_id IS 'Reference to the code library this section belongs to';
COMMENT ON COLUMN code_sections.chapter_id IS 'Reference to the chapter structure entry for this section';

-- =============================================================================
-- 4. SEED INITIAL CODE LIBRARIES
-- Pre-populate with Florida Building Code (existing data)
-- =============================================================================

-- Insert FBC 2023 as the default library
INSERT INTO code_libraries (id, name, short_name, state, jurisdiction, version, status, description)
VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'Florida Building Code',
    'FBC 2023',
    'FL',
    'Statewide',
    '2023 (8th Edition)',
    'active',
    'The Florida Building Code (FBC) is the unified statewide building code for the State of Florida. Based on the International Building Code with Florida-specific amendments.'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 5. SEED CODE STRUCTURE FOR FBC
-- Insert chapter structure with descriptions for embedding
-- =============================================================================

INSERT INTO code_structure (library_id, chapter_number, chapter_title, description, topics, sort_order)
VALUES
    ('00000000-0000-0000-0000-000000000001', '1', 'Scope and Administration',
     'Administrative provisions including scope of code application, permits, construction documents, inspections, certificates of occupancy, fees, and board of appeals.',
     ARRAY['administration', 'permits', 'inspections', 'certificates', 'appeals', 'fees'],
     1),
    ('00000000-0000-0000-0000-000000000001', '2', 'Definitions',
     'Definitions of terms used throughout the Florida Building Code. Reference chapter for understanding code terminology.',
     ARRAY['definitions', 'terms', 'glossary'],
     2),
    ('00000000-0000-0000-0000-000000000001', '3', 'Use and Occupancy Classification',
     'Classification of buildings by occupancy group: Assembly (A), Business (B), Educational (E), Factory (F), High-Hazard (H), Institutional (I), Mercantile (M), Residential (R), Storage (S), Utility (U).',
     ARRAY['occupancy', 'classification', 'use', 'assembly', 'business', 'educational', 'factory', 'hazard', 'institutional', 'mercantile', 'residential', 'storage', 'utility'],
     3),
    ('00000000-0000-0000-0000-000000000001', '4', 'Special Detailed Requirements Based on Occupancy and Use',
     'Special requirements for covered mall buildings, high-rise buildings, atriums, underground buildings, motor vehicle facilities, aircraft facilities, and other special uses.',
     ARRAY['high-rise', 'mall', 'atrium', 'underground', 'parking', 'aircraft', 'special occupancy'],
     4),
    ('00000000-0000-0000-0000-000000000001', '5', 'General Building Heights and Areas',
     'Allowable building height in stories and feet, allowable floor area, area modifications, mixed occupancy, and unlimited area buildings.',
     ARRAY['height', 'area', 'stories', 'floors', 'mixed occupancy', 'unlimited area'],
     5),
    ('00000000-0000-0000-0000-000000000001', '6', 'Types of Construction',
     'Building construction types I through V including fire-resistance ratings for structural elements. Type I (fire-resistive), Type II (non-combustible), Type III (ordinary), Type IV (heavy timber), Type V (wood frame).',
     ARRAY['construction type', 'fire resistance', 'noncombustible', 'combustible', 'heavy timber', 'wood frame'],
     6),
    ('00000000-0000-0000-0000-000000000001', '7', 'Fire and Smoke Protection Features',
     'Fire barriers, fire partitions, smoke barriers, smoke partitions, horizontal assemblies, shaft enclosures, fire-resistance rated construction, and opening protectives.',
     ARRAY['fire barrier', 'smoke barrier', 'fire partition', 'shaft enclosure', 'opening protective', 'fire rating', 'fire separation'],
     7),
    ('00000000-0000-0000-0000-000000000001', '8', 'Interior Finishes',
     'Interior wall and ceiling finish requirements including flame spread index, smoke development, and foam plastic requirements.',
     ARRAY['interior finish', 'flame spread', 'smoke development', 'wall finish', 'ceiling finish', 'foam plastic'],
     8),
    ('00000000-0000-0000-0000-000000000001', '9', 'Fire Protection Systems',
     'Automatic sprinkler systems, alternative automatic fire-extinguishing systems, standpipe systems, fire alarm and detection systems, smoke control systems, and fire command centers.',
     ARRAY['sprinkler', 'fire alarm', 'standpipe', 'smoke control', 'fire extinguishing', 'detection', 'fire command'],
     9),
    ('00000000-0000-0000-0000-000000000001', '10', 'Means of Egress',
     'Exit access, exits, exit discharge, number of exits, egress width, doors, gates, stairways, ramps, exit signs, emergency lighting, occupant load, and travel distance requirements.',
     ARRAY['egress', 'exit', 'stairs', 'stairway', 'ramp', 'door', 'corridor', 'exit sign', 'emergency lighting', 'occupant load', 'travel distance', 'exit discharge', 'riser', 'tread', 'handrail', 'guardrail'],
     10),
    ('00000000-0000-0000-0000-000000000001', '11', 'Accessibility',
     'Accessible routes, accessible elements and spaces, accessible means of egress, signage, and scoping requirements for accessibility per ICC A117.1 and Florida Accessibility Code.',
     ARRAY['accessibility', 'ADA', 'accessible route', 'wheelchair', 'ramp', 'accessible parking', 'accessible restroom', 'signage', 'tactile'],
     11),
    ('00000000-0000-0000-0000-000000000001', '12', 'Interior Environment',
     'Ventilation, temperature control, lighting, yards and courts, sound transmission, and interior space dimensions.',
     ARRAY['ventilation', 'lighting', 'temperature', 'hvac', 'sound', 'acoustics', 'room size'],
     12),
    ('00000000-0000-0000-0000-000000000001', '13', 'Energy Efficiency',
     'Energy conservation requirements for building envelope, mechanical systems, lighting systems, and service water heating per Florida Energy Conservation Code.',
     ARRAY['energy', 'insulation', 'envelope', 'efficiency', 'HVAC efficiency', 'lighting efficiency'],
     13),
    ('00000000-0000-0000-0000-000000000001', '14', 'Exterior Walls',
     'Performance requirements for exterior walls including weather protection, water-resistive barriers, exterior wall coverings, and fire-resistance requirements.',
     ARRAY['exterior wall', 'weather barrier', 'water resistive', 'cladding', 'veneer', 'stucco', 'siding'],
     14),
    ('00000000-0000-0000-0000-000000000001', '15', 'Roof Assemblies and Rooftop Structures',
     'Roof covering materials, roof drainage, rooftop structures, vegetative roofs, and photovoltaic systems. Florida-specific high-velocity hurricane zone requirements.',
     ARRAY['roof', 'roofing', 'drainage', 'HVHZ', 'hurricane', 'photovoltaic', 'solar'],
     15),
    ('00000000-0000-0000-0000-000000000001', '16', 'Structural Design',
     'Structural loads including dead, live, wind, seismic, flood, rain, and special loads. Load combinations and structural design methods.',
     ARRAY['structural', 'load', 'wind load', 'seismic', 'flood', 'live load', 'dead load', 'foundation'],
     16),
    ('00000000-0000-0000-0000-000000000001', '17', 'Special Inspections and Tests',
     'Special inspection requirements for structural elements, fire-resistance, mechanical and electrical systems, and required testing.',
     ARRAY['special inspection', 'testing', 'inspection', 'structural inspection'],
     17),
    ('00000000-0000-0000-0000-000000000001', '18', 'Soils and Foundations',
     'Geotechnical investigations, excavation and fill, allowable load-bearing values, footings and foundations, and foundation walls.',
     ARRAY['foundation', 'soil', 'footing', 'geotechnical', 'bearing capacity', 'excavation'],
     18),
    ('00000000-0000-0000-0000-000000000001', '19', 'Concrete',
     'Concrete construction including materials, proportioning, durability, reinforcement, formwork, and special provisions.',
     ARRAY['concrete', 'reinforcement', 'rebar', 'formwork', 'durability'],
     19),
    ('00000000-0000-0000-0000-000000000001', '20', 'Aluminum',
     'Aluminum structural members and aluminum composite materials requirements.',
     ARRAY['aluminum', 'aluminum structure'],
     20),
    ('00000000-0000-0000-0000-000000000001', '21', 'Masonry',
     'Masonry construction including design methods, materials, construction requirements, and quality assurance.',
     ARRAY['masonry', 'brick', 'block', 'mortar', 'grout', 'CMU'],
     21),
    ('00000000-0000-0000-0000-000000000001', '22', 'Steel',
     'Structural steel, cold-formed steel, steel joists, steel decks, and cable structures.',
     ARRAY['steel', 'structural steel', 'cold-formed', 'steel joist', 'deck'],
     22),
    ('00000000-0000-0000-0000-000000000001', '23', 'Wood',
     'Wood construction including design, framing, sheathing, diaphragms, and preservative-treated wood.',
     ARRAY['wood', 'lumber', 'framing', 'plywood', 'OSB', 'timber', 'treated wood'],
     23),
    ('00000000-0000-0000-0000-000000000001', '24', 'Glass and Glazing',
     'Glass and glazing requirements including safety glazing, windborne debris protection, and glazing in hazardous locations.',
     ARRAY['glass', 'glazing', 'window', 'safety glazing', 'hurricane protection', 'impact resistant'],
     24),
    ('00000000-0000-0000-0000-000000000001', '25', 'Gypsum Board and Plaster',
     'Gypsum board, gypsum panel products, and plaster requirements including installation, fire-resistance assemblies.',
     ARRAY['gypsum', 'drywall', 'plaster', 'gypsum board'],
     25),
    ('00000000-0000-0000-0000-000000000001', '26', 'Plastic',
     'Plastic construction including foam plastic insulation, light-transmitting plastics, and plastic veneers.',
     ARRAY['plastic', 'foam plastic', 'insulation', 'acrylic', 'polycarbonate'],
     26),
    ('00000000-0000-0000-0000-000000000001', '27', 'Electrical',
     'Electrical systems including service, branch circuits, outlets, and equipment per National Electrical Code with Florida amendments.',
     ARRAY['electrical', 'wiring', 'outlets', 'service', 'panel', 'NEC'],
     27),
    ('00000000-0000-0000-0000-000000000001', '28', 'Mechanical Systems',
     'Mechanical systems including HVAC, duct systems, exhaust systems, and mechanical equipment per Florida Mechanical Code.',
     ARRAY['mechanical', 'HVAC', 'duct', 'exhaust', 'ventilation', 'air conditioning'],
     28),
    ('00000000-0000-0000-0000-000000000001', '29', 'Plumbing Systems',
     'Plumbing systems including fixtures, piping, water supply, drainage, and venting per Florida Plumbing Code.',
     ARRAY['plumbing', 'fixture', 'pipe', 'drain', 'vent', 'water supply', 'sewer'],
     29),
    ('00000000-0000-0000-0000-000000000001', '30', 'Elevators and Conveying Systems',
     'Elevators, escalators, moving walks, dumbwaiters, and other conveying systems.',
     ARRAY['elevator', 'escalator', 'lift', 'conveyor', 'dumbwaiter'],
     30),
    ('00000000-0000-0000-0000-000000000001', '31', 'Special Construction',
     'Membrane structures, temporary structures, pedestrian walkways, awnings, marquees, and special construction types.',
     ARRAY['membrane', 'temporary', 'walkway', 'awning', 'marquee', 'special construction'],
     31),
    ('00000000-0000-0000-0000-000000000001', '32', 'Encroachments into the Public Right-of-Way',
     'Encroachments including awnings, canopies, marquees, signs, and other projections over public property.',
     ARRAY['encroachment', 'right of way', 'projection', 'canopy', 'sign'],
     32),
    ('00000000-0000-0000-0000-000000000001', '33', 'Safeguards During Construction',
     'Construction site safety including protection of pedestrians, adjoining property, and fire safety during construction.',
     ARRAY['construction safety', 'safeguards', 'protection', 'temporary'],
     33),
    ('00000000-0000-0000-0000-000000000001', '34', 'Existing Buildings',
     'Alterations, repairs, additions, and change of occupancy for existing buildings per Florida Existing Building Code.',
     ARRAY['existing building', 'alteration', 'addition', 'change of occupancy', 'renovation', 'repair'],
     34),
    ('00000000-0000-0000-0000-000000000001', '35', 'Referenced Standards',
     'List of standards referenced in the Florida Building Code including ASTM, ANSI, NFPA, and other standards.',
     ARRAY['standards', 'reference', 'ASTM', 'ANSI', 'NFPA'],
     35)
ON CONFLICT (library_id, chapter_number) DO UPDATE SET
    chapter_title = EXCLUDED.chapter_title,
    description = EXCLUDED.description,
    topics = EXCLUDED.topics,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- =============================================================================
-- 6. BACKFILL LIBRARY_ID FOR EXISTING CODE_SECTIONS
-- Link existing Florida data to the FBC library
-- =============================================================================

-- Update existing Florida sections to link to the FBC library
UPDATE code_sections
SET library_id = '00000000-0000-0000-0000-000000000001'::UUID
WHERE (jurisdiction = 'Florida' OR jurisdiction IS NULL)
  AND library_id IS NULL;

-- Update chapter_id based on chapter number match
UPDATE code_sections cs
SET chapter_id = struct.id
FROM code_structure struct
WHERE cs.library_id = struct.library_id
  AND cs.chapter = struct.chapter_number
  AND cs.chapter_id IS NULL;

-- =============================================================================
-- 7. SEMANTIC CHAPTER ROUTING FUNCTION
-- Find the most relevant chapter(s) for a query
-- =============================================================================

CREATE OR REPLACE FUNCTION route_to_chapters(
    query_embedding vector(1536),
    p_library_id UUID DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.3,
    match_count INTEGER DEFAULT 3
)
RETURNS TABLE (
    chapter_id UUID,
    library_id UUID,
    chapter_number TEXT,
    chapter_title TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cs.id AS chapter_id,
        cs.library_id,
        cs.chapter_number,
        cs.chapter_title,
        (1 - (cs.embedding <=> query_embedding))::FLOAT AS similarity
    FROM code_structure cs
    JOIN code_libraries cl ON cs.library_id = cl.id
    WHERE
        cs.embedding IS NOT NULL
        AND cl.status = 'active'
        AND (p_library_id IS NULL OR cs.library_id = p_library_id)
        AND (p_state IS NULL OR cl.state = p_state)
        AND 1 - (cs.embedding <=> query_embedding) > match_threshold
    ORDER BY cs.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION route_to_chapters IS 'Semantic router that finds the most relevant chapter(s) for a query based on chapter title embeddings';

-- =============================================================================
-- 8. UPDATED HYBRID_SEARCH WITH LIBRARY SUPPORT
-- =============================================================================

-- Drop existing function to replace with updated version
DROP FUNCTION IF EXISTS hybrid_search(TEXT, vector, FLOAT, INTEGER, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS hybrid_search(TEXT, vector, FLOAT, INTEGER, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION hybrid_search(
    query_text TEXT,
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INTEGER DEFAULT 10,
    filter_jurisdiction TEXT DEFAULT NULL,
    filter_code_name TEXT DEFAULT NULL,
    filter_chapter TEXT DEFAULT NULL,
    filter_library_id UUID DEFAULT NULL  -- NEW: Filter by library
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
    chapter TEXT,
    library_id UUID,
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
    RETURN QUERY
    WITH vector_search AS (
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
            cs.library_id,
            1 - (cs.embedding <=> query_embedding) AS similarity
        FROM code_sections cs
        WHERE
            (filter_library_id IS NULL OR cs.library_id = filter_library_id)
            AND (filter_chapter IS NULL OR cs.chapter = filter_chapter)
            AND (filter_jurisdiction IS NULL OR cs.jurisdiction = filter_jurisdiction)
            AND (filter_code_name IS NULL OR cs.code_name = filter_code_name)
            AND 1 - (cs.embedding <=> query_embedding) > match_threshold
        ORDER BY cs.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    keyword_search AS (
        SELECT
            cs.id,
            ts_rank_cd(
                to_tsvector('english', cs.content),
                plainto_tsquery('english', query_text)
            ) AS rank
        FROM code_sections cs
        WHERE
            (filter_library_id IS NULL OR cs.library_id = filter_library_id)
            AND (filter_chapter IS NULL OR cs.chapter = filter_chapter)
            AND (filter_jurisdiction IS NULL OR cs.jurisdiction = filter_jurisdiction)
            AND (filter_code_name IS NULL OR cs.code_name = filter_code_name)
            AND to_tsvector('english', cs.content) @@ plainto_tsquery('english', query_text)
    ),
    combined AS (
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
            vs.library_id,
            vs.similarity AS vector_score,
            COALESCE(ks.rank, 0) AS keyword_score,
            (vs.similarity * vector_weight) + (COALESCE(ks.rank, 0) * keyword_weight) AS combined_score
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
        c.library_id,
        c.vector_score::FLOAT,
        c.keyword_score::FLOAT,
        c.combined_score::FLOAT
    FROM combined c
    ORDER BY c.combined_score DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION hybrid_search IS 'Hybrid semantic + keyword search with optional library, chapter, jurisdiction, and code name filters';

-- =============================================================================
-- 9. GET LIBRARIES FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION get_code_libraries(
    p_state TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'active'
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    short_name TEXT,
    state TEXT,
    jurisdiction TEXT,
    version TEXT,
    status TEXT,
    chapter_count BIGINT,
    section_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cl.id,
        cl.name,
        cl.short_name,
        cl.state,
        cl.jurisdiction,
        cl.version,
        cl.status,
        (SELECT COUNT(*) FROM code_structure cs WHERE cs.library_id = cl.id) AS chapter_count,
        (SELECT COUNT(*) FROM code_sections sec WHERE sec.library_id = cl.id) AS section_count
    FROM code_libraries cl
    WHERE
        (p_state IS NULL OR cl.state = p_state)
        AND (p_status IS NULL OR cl.status = p_status)
    ORDER BY cl.state, cl.name;
END;
$$;

COMMENT ON FUNCTION get_code_libraries IS 'List available code libraries with chapter and section counts';

-- =============================================================================
-- 10. UPDATE SECTION COUNTS IN CODE_STRUCTURE
-- =============================================================================

-- Update section counts for each chapter
UPDATE code_structure cs
SET section_count = (
    SELECT COUNT(*)
    FROM code_sections sec
    WHERE sec.library_id = cs.library_id
      AND sec.chapter = cs.chapter_number
);

-- =============================================================================
-- 11. VERIFICATION QUERIES (commented out for safety)
-- =============================================================================

-- Check libraries
-- SELECT * FROM get_code_libraries();

-- Check chapter structure
-- SELECT chapter_number, chapter_title, section_count, topics
-- FROM code_structure
-- WHERE library_id = '00000000-0000-0000-0000-000000000001'
-- ORDER BY sort_order;

-- Check sections linked to library
-- SELECT library_id, COUNT(*) FROM code_sections GROUP BY library_id;

-- Test hybrid search with library filter
-- SELECT section_number, section_title, chapter, vector_score
-- FROM hybrid_search(
--     'stair riser height',
--     (SELECT embedding FROM code_sections LIMIT 1),
--     0.5, 5, NULL, NULL, '10',
--     '00000000-0000-0000-0000-000000000001'
-- );

-- =============================================================================
-- Migration complete
-- =============================================================================

DO $$ BEGIN RAISE NOTICE 'Migration 010_code_libraries completed successfully!'; END $$;
