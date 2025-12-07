-- =============================================================================
-- BIM Data Store Migration
-- Separates 3D geometry from metadata for efficient handling of massive models
-- =============================================================================

-- =============================================================================
-- 1. CREATE MODEL_ELEMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS model_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- IFC Identity
    global_id TEXT NOT NULL,                    -- IFC GUID (e.g., "2tO7F9$2X5fvBhPQq0001K")
    name TEXT,                                   -- Element name (e.g., "Basic Wall: Generic - 8"")

    -- Classification
    category TEXT NOT NULL,                      -- IFC class (e.g., "IfcWallStandardCase", "IfcDoor", "IfcSlab")
    subcategory TEXT,                            -- More specific type (e.g., "Basic Wall", "Interior Door")

    -- Spatial Location
    level TEXT,                                  -- Building level (e.g., "Level 01", "Basement")
    level_elevation FLOAT,                       -- Elevation in project units (for sorting)
    zone TEXT,                                   -- Spatial zone if defined
    space TEXT,                                  -- Room/space name if assigned

    -- Geometric Summary (not the full geometry - just key dimensions)
    bounding_box JSONB,                          -- {min: {x, y, z}, max: {x, y, z}}
    volume FLOAT,                                -- Volume in cubic units
    area FLOAT,                                  -- Primary area (wall area, floor area, etc.)
    length FLOAT,                                -- Primary length dimension
    height FLOAT,                                -- Height dimension
    width FLOAT,                                 -- Width/thickness dimension

    -- Full Properties (raw IFC metadata)
    properties JSONB NOT NULL DEFAULT '{}',      -- All IFC property sets and quantities
    /*
    Example properties structure:
    {
      "Pset_WallCommon": {
        "FireRating": "2 Hour",
        "IsExternal": false,
        "LoadBearing": true,
        "ThermalTransmittance": 0.35
      },
      "Qto_WallBaseQuantities": {
        "Length": 15.5,
        "Height": 10.0,
        "GrossArea": 155.0,
        "NetArea": 142.5,
        "GrossVolume": 12.92
      },
      "Materials": ["Concrete", "Gypsum Board"],
      "TypeName": "Basic Wall: Generic - 8\"",
      "TypeId": "abc123..."
    }
    */

    -- Type Information
    type_id TEXT,                                -- IFC Type element GUID
    type_name TEXT,                              -- Type name for grouping

    -- Relationships
    parent_id UUID REFERENCES model_elements(id) ON DELETE SET NULL,  -- Spatial parent (e.g., floor -> building)
    contained_in_space TEXT,                     -- Space GUID this element is in

    -- System/Assembly
    system_name TEXT,                            -- MEP system name (e.g., "Hot Water Supply")
    system_type TEXT,                            -- System type (e.g., "Plumbing", "HVAC", "Electrical")

    -- Classification Systems
    uniformat_code TEXT,                         -- UniFormat classification (e.g., "B2010")
    omniclass_code TEXT,                         -- OmniClass classification
    masterformat_code TEXT,                      -- MasterFormat code (e.g., "03 30 00")

    -- Status & Tracking
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'demolished', 'proposed', 'temporary')),
    phase TEXT,                                  -- Construction phase

    -- Semantic Search
    embedding vector(1536),                      -- OpenAI text-embedding-3-small
    search_text TEXT,                            -- Concatenated text used for embedding

    -- Source Tracking
    source_file TEXT,                            -- Original IFC file name
    ifc_schema TEXT,                             -- IFC schema version (e.g., "IFC4", "IFC2X3")
    express_id INTEGER,                          -- Original EXPRESS ID in IFC file

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint per project
    CONSTRAINT unique_element_per_project UNIQUE (project_id, global_id)
);

-- =============================================================================
-- 2. CREATE INDEXES
-- =============================================================================

-- Primary lookups
CREATE INDEX IF NOT EXISTS idx_model_elements_project_id
ON model_elements(project_id);

CREATE INDEX IF NOT EXISTS idx_model_elements_global_id
ON model_elements(global_id);

-- Category filtering (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_model_elements_category
ON model_elements(category);

CREATE INDEX IF NOT EXISTS idx_model_elements_project_category
ON model_elements(project_id, category);

-- Level/spatial filtering
CREATE INDEX IF NOT EXISTS idx_model_elements_level
ON model_elements(level);

CREATE INDEX IF NOT EXISTS idx_model_elements_project_level
ON model_elements(project_id, level);

-- System filtering (for MEP elements)
CREATE INDEX IF NOT EXISTS idx_model_elements_system
ON model_elements(system_name)
WHERE system_name IS NOT NULL;

-- Classification code lookups
CREATE INDEX IF NOT EXISTS idx_model_elements_masterformat
ON model_elements(masterformat_code)
WHERE masterformat_code IS NOT NULL;

-- Type grouping
CREATE INDEX IF NOT EXISTS idx_model_elements_type
ON model_elements(project_id, type_name);

-- GIN index for fast JSONB property queries
-- Supports queries like: properties @> '{"Pset_WallCommon": {"FireRating": "2 Hour"}}'
CREATE INDEX IF NOT EXISTS idx_model_elements_properties_gin
ON model_elements USING GIN (properties jsonb_path_ops);

-- Additional GIN index for key existence queries
-- Supports queries like: properties ? 'Pset_WallCommon'
CREATE INDEX IF NOT EXISTS idx_model_elements_properties_keys
ON model_elements USING GIN (properties);

-- HNSW index for semantic vector search
-- Optimized for approximate nearest neighbor queries
CREATE INDEX IF NOT EXISTS idx_model_elements_embedding_hnsw
ON model_elements USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- =============================================================================
-- 3. CREATE UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_model_elements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_model_elements_updated_at ON model_elements;
CREATE TRIGGER trg_model_elements_updated_at
    BEFORE UPDATE ON model_elements
    FOR EACH ROW
    EXECUTE FUNCTION update_model_elements_updated_at();

-- =============================================================================
-- 4. CREATE SEMANTIC SEARCH FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION search_model_elements(
    p_project_id UUID,
    p_query_embedding vector(1536),
    p_match_threshold FLOAT DEFAULT 0.7,
    p_match_count INT DEFAULT 20,
    p_category TEXT DEFAULT NULL,
    p_level TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    global_id TEXT,
    name TEXT,
    category TEXT,
    level TEXT,
    properties JSONB,
    type_name TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        me.id,
        me.global_id,
        me.name,
        me.category,
        me.level,
        me.properties,
        me.type_name,
        1 - (me.embedding <=> p_query_embedding) AS similarity
    FROM model_elements me
    WHERE me.project_id = p_project_id
      AND me.embedding IS NOT NULL
      AND 1 - (me.embedding <=> p_query_embedding) >= p_match_threshold
      AND (p_category IS NULL OR me.category = p_category)
      AND (p_level IS NULL OR me.level = p_level)
    ORDER BY me.embedding <=> p_query_embedding
    LIMIT p_match_count;
END;
$$;

COMMENT ON FUNCTION search_model_elements IS 'Semantic search for model elements (e.g., "Find all fire-rated walls")';

-- =============================================================================
-- 5. CREATE PROPERTY SEARCH FUNCTION
-- =============================================================================

-- Function to find elements by property value
CREATE OR REPLACE FUNCTION find_elements_by_property(
    p_project_id UUID,
    p_property_path TEXT[],  -- e.g., ARRAY['Pset_WallCommon', 'FireRating']
    p_value TEXT,            -- e.g., '2 Hour'
    p_category TEXT DEFAULT NULL,
    p_limit INT DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    global_id TEXT,
    name TEXT,
    category TEXT,
    level TEXT,
    property_value JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        me.id,
        me.global_id,
        me.name,
        me.category,
        me.level,
        me.properties #> p_property_path AS property_value
    FROM model_elements me
    WHERE me.project_id = p_project_id
      AND me.properties #>> p_property_path = p_value
      AND (p_category IS NULL OR me.category = p_category)
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION find_elements_by_property IS 'Find elements by specific property value (e.g., FireRating = "2 Hour")';

-- =============================================================================
-- 6. CREATE ELEMENT STATISTICS VIEW
-- =============================================================================

CREATE OR REPLACE VIEW model_element_stats AS
SELECT
    project_id,
    category,
    level,
    COUNT(*) AS element_count,
    COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS elements_with_embeddings,
    COUNT(DISTINCT type_name) AS unique_types,
    SUM(volume) AS total_volume,
    SUM(area) AS total_area,
    AVG(volume) AS avg_volume
FROM model_elements
WHERE status = 'active'
GROUP BY project_id, category, level
ORDER BY project_id, category, level;

COMMENT ON VIEW model_element_stats IS 'Statistics of model elements by category and level';

-- =============================================================================
-- 7. CREATE CATEGORY SUMMARY VIEW
-- =============================================================================

CREATE OR REPLACE VIEW model_category_summary AS
SELECT
    project_id,
    category,
    COUNT(*) AS total_elements,
    COUNT(DISTINCT level) AS levels_present,
    COUNT(DISTINCT type_name) AS unique_types,
    ARRAY_AGG(DISTINCT level ORDER BY level) AS levels,
    jsonb_object_agg(
        COALESCE(type_name, 'Unnamed'),
        type_count
    ) FILTER (WHERE type_name IS NOT NULL) AS types_breakdown
FROM (
    SELECT
        project_id,
        category,
        level,
        type_name,
        COUNT(*) AS type_count
    FROM model_elements
    WHERE status = 'active'
    GROUP BY project_id, category, level, type_name
) sub
GROUP BY project_id, category;

COMMENT ON VIEW model_category_summary IS 'Summary of element categories per project';

-- =============================================================================
-- 8. CREATE HELPER FUNCTION FOR BUILDING SEARCH TEXT
-- =============================================================================

CREATE OR REPLACE FUNCTION build_element_search_text(
    p_name TEXT,
    p_category TEXT,
    p_type_name TEXT,
    p_level TEXT,
    p_properties JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    search_parts TEXT[];
    fire_rating TEXT;
    materials TEXT;
BEGIN
    -- Start with basic info
    search_parts := ARRAY[
        COALESCE(p_name, ''),
        COALESCE(p_category, ''),
        COALESCE(p_type_name, ''),
        COALESCE(p_level, '')
    ];

    -- Extract key properties for search
    -- Fire Rating
    fire_rating := p_properties #>> '{Pset_WallCommon,FireRating}';
    IF fire_rating IS NULL THEN
        fire_rating := p_properties #>> '{Pset_DoorCommon,FireRating}';
    END IF;
    IF fire_rating IS NOT NULL THEN
        search_parts := array_append(search_parts, 'Fire Rating: ' || fire_rating);
    END IF;

    -- Materials
    IF p_properties ? 'Materials' THEN
        materials := array_to_string(
            ARRAY(SELECT jsonb_array_elements_text(p_properties -> 'Materials')),
            ', '
        );
        search_parts := array_append(search_parts, 'Materials: ' || materials);
    END IF;

    -- IsExternal
    IF (p_properties #>> '{Pset_WallCommon,IsExternal}')::boolean THEN
        search_parts := array_append(search_parts, 'External Wall');
    END IF;

    -- LoadBearing
    IF (p_properties #>> '{Pset_WallCommon,LoadBearing}')::boolean THEN
        search_parts := array_append(search_parts, 'Load Bearing');
    END IF;

    RETURN array_to_string(search_parts, ' | ');
END;
$$;

COMMENT ON FUNCTION build_element_search_text IS 'Builds concatenated text from element properties for embedding generation';

-- =============================================================================
-- 9. ADD RLS POLICIES
-- =============================================================================

ALTER TABLE model_elements ENABLE ROW LEVEL SECURITY;

-- Temporary policy for development (allow all operations)
DROP POLICY IF EXISTS "Allow all for model_elements" ON model_elements;
CREATE POLICY "Allow all for model_elements" ON model_elements FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- 10. ADD DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE model_elements IS 'BIM model element metadata store - separates geometry from properties for efficient querying';
COMMENT ON COLUMN model_elements.global_id IS 'IFC GlobalId (GUID) - unique identifier within the IFC model';
COMMENT ON COLUMN model_elements.category IS 'IFC entity type (e.g., IfcWall, IfcDoor, IfcSlab)';
COMMENT ON COLUMN model_elements.properties IS 'Full IFC property sets and quantities as JSONB';
COMMENT ON COLUMN model_elements.embedding IS 'Semantic embedding for natural language search';
COMMENT ON COLUMN model_elements.search_text IS 'Text used to generate the embedding';
COMMENT ON COLUMN model_elements.bounding_box IS 'Axis-aligned bounding box {min: {x,y,z}, max: {x,y,z}}';
COMMENT ON COLUMN model_elements.masterformat_code IS 'CSI MasterFormat classification code';

-- =============================================================================
-- 11. CREATE BULK UPSERT FUNCTION
-- =============================================================================

-- Function for efficient bulk upsert of model elements
CREATE OR REPLACE FUNCTION upsert_model_elements(
    p_elements JSONB
)
RETURNS TABLE (
    inserted_count INT,
    updated_count INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inserted INT := 0;
    v_updated INT := 0;
    v_element JSONB;
BEGIN
    FOR v_element IN SELECT * FROM jsonb_array_elements(p_elements)
    LOOP
        INSERT INTO model_elements (
            project_id,
            global_id,
            name,
            category,
            subcategory,
            level,
            level_elevation,
            properties,
            type_id,
            type_name,
            volume,
            area,
            length,
            height,
            width,
            system_name,
            system_type,
            masterformat_code,
            source_file,
            ifc_schema,
            express_id,
            search_text
        ) VALUES (
            (v_element->>'project_id')::UUID,
            v_element->>'global_id',
            v_element->>'name',
            v_element->>'category',
            v_element->>'subcategory',
            v_element->>'level',
            (v_element->>'level_elevation')::FLOAT,
            COALESCE(v_element->'properties', '{}'),
            v_element->>'type_id',
            v_element->>'type_name',
            (v_element->>'volume')::FLOAT,
            (v_element->>'area')::FLOAT,
            (v_element->>'length')::FLOAT,
            (v_element->>'height')::FLOAT,
            (v_element->>'width')::FLOAT,
            v_element->>'system_name',
            v_element->>'system_type',
            v_element->>'masterformat_code',
            v_element->>'source_file',
            v_element->>'ifc_schema',
            (v_element->>'express_id')::INT,
            v_element->>'search_text'
        )
        ON CONFLICT (project_id, global_id)
        DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            subcategory = EXCLUDED.subcategory,
            level = EXCLUDED.level,
            level_elevation = EXCLUDED.level_elevation,
            properties = EXCLUDED.properties,
            type_id = EXCLUDED.type_id,
            type_name = EXCLUDED.type_name,
            volume = EXCLUDED.volume,
            area = EXCLUDED.area,
            length = EXCLUDED.length,
            height = EXCLUDED.height,
            width = EXCLUDED.width,
            system_name = EXCLUDED.system_name,
            system_type = EXCLUDED.system_type,
            masterformat_code = EXCLUDED.masterformat_code,
            source_file = EXCLUDED.source_file,
            search_text = EXCLUDED.search_text,
            updated_at = NOW();

        IF NOT FOUND THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_inserted, v_updated;
END;
$$;

COMMENT ON FUNCTION upsert_model_elements IS 'Bulk upsert model elements from JSON array';

-- =============================================================================
-- Migration complete
-- =============================================================================

DO $$ BEGIN RAISE NOTICE 'Migration 014_bim_data_store completed successfully!'; END $$;
