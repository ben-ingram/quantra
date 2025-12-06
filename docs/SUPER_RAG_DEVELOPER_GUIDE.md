# SUPER RAG Developer Guide
## Quantra's Hybrid Retrieval-Augmented Generation System for Regulatory Compliance Analysis

**Version:** 1.1
**Last Updated:** December 2024
**Authors:** Quantra Engineering Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Data Ingestion Pipeline](#data-ingestion-pipeline)
4. [Database Schema](#database-schema)
5. [Hybrid Search Implementation](#hybrid-search-implementation)
6. [AI Analysis Engine](#ai-analysis-engine)
7. [Query Interpretation Logic](#query-interpretation-logic)
8. [Response Parsing & Validation](#response-parsing--validation)
9. [API Reference](#api-reference)
10. [Configuration & Tuning](#configuration--tuning)
11. [Performance Optimization](#performance-optimization)
12. [Troubleshooting](#troubleshooting)

---

## Executive Summary

SUPER RAG (Structured Understanding with Prioritized Evidence Retrieval and Augmented Generation) is Quantra's proprietary compliance analysis system that combines:

- **PDF Ingestion Pipeline** (Python-based document processing)
- **Semantic Vector Search** (pgvector with HNSW indexing)
- **Full-Text Keyword Search** (PostgreSQL tsvector/tsquery)
- **Structured Data Retrieval** (JSONB tables with numeric lookups)
- **Intelligent Data Hierarchy** (Tables > Specific Rules > General Text)
- **Query Interpretation Logic** (Conditions vs. Requirements)
- **LLM-Powered Analysis** (GPT-4o with specialized prompting)
- **Robust Response Parsing** (Graceful handling of edge cases)

The system analyzes construction defects against regulatory codes (primarily Florida Building Code) with unprecedented accuracy by intelligently combining multiple retrieval strategies and enforcing a strict evidence hierarchy.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SUPER RAG COMPLETE ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────────┘

                              INGESTION FLOW
                              ==============

┌─────────────┐     ┌─────────────────────────────────────────────────────────┐
│   PDF       │     │              INGESTION PIPELINE (Python)                │
│   Building  │────▶│                    ingest.py                            │
│   Codes     │     │                                                         │
└─────────────┘     │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
                    │  │ PDF Loader  │─▶│ Text        │─▶│ Section         │ │
                    │  │ (PyPDF)     │  │ Splitter    │  │ Extractor       │ │
                    │  └─────────────┘  └─────────────┘  └─────────────────┘ │
                    │                                            │            │
                    │                                            ▼            │
                    │  ┌─────────────────────────────────────────────────┐   │
                    │  │           OpenAI Embedding Generator            │   │
                    │  │           text-embedding-3-small (1536d)        │   │
                    │  └─────────────────────────────────────────────────┘   │
                    │                          │                              │
                    │         ┌────────────────┴────────────────┐            │
                    │         ▼                                 ▼            │
                    │  ┌─────────────────┐           ┌──────────────────┐   │
                    │  │  code_sections  │           │   code_tables    │   │
                    │  │  (Text Chunks)  │           │ (Structured JSON)│   │
                    │  └─────────────────┘           └──────────────────┘   │
                    └─────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                              QUERY FLOW (Runtime)
                              ====================

┌─────────────┐     ┌─────────────────────────────────────────────────────────┐
│   USER      │     │                    FRONTEND LAYER                       │
│   QUERY     │────▶│         ComplianceAnalyzer.tsx (React Component)        │
│             │     │    - Query input interface                              │
│             │     │    - Result visualization with risk factors             │
│             │     │    - Data source & citation display                     │
└─────────────┘     └─────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVER ACTION LAYER                                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              performSuperRAGAnalysis.ts (Phase 4: Analyst)          │   │
│  │                                                                     │   │
│  │  - Orchestrates entire analysis pipeline                           │   │
│  │  - Contains SUPER_RAG_SYSTEM_PROMPT with:                          │   │
│  │    • Data hierarchy rules (Tables > Specific > General)            │   │
│  │    • Query interpretation logic (Conditions vs Requirements)       │   │
│  │    • Anti-hallucination guardrails                                 │   │
│  │    • Risk scoring guidelines                                       │   │
│  │  - Builds analyst prompt with retrieved context                    │   │
│  │  - Calls GPT-4o for compliance determination                       │   │
│  │  - Parses response with robust null/default handling               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                            │                                │
│                                            ▼                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │              retrieveComplianceData.ts (Phase 3: Router)            │   │
│  │                                                                     │   │
│  │  - Generates query embedding via OpenAI                            │   │
│  │  - Executes PARALLEL hybrid searches:                              │   │
│  │    • Text chunks (threshold: 0.5, count: 8)                        │   │
│  │    • Structured tables (threshold: 0.82, count: 3)                 │   │
│  │  - Formats context for LLM consumption                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    │                                               │
                    ▼                                               ▼
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│        EMBEDDING SERVICE            │   │           DATABASE LAYER            │
│                                     │   │                                     │
│  OpenAI text-embedding-3-small      │   │  ┌─────────────────────────────┐   │
│  - 1536-dimensional vectors         │   │  │    Supabase PostgreSQL      │   │
│  - Semantic similarity encoding     │   │  │    + pgvector extension     │   │
│                                     │   │  │                             │   │
└─────────────────────────────────────┘   │  │  ┌─────────────────────┐   │   │
                                          │  │  │   code_sections     │   │   │
                                          │  │  │   - content         │   │   │
                                          │  │  │   - embedding       │   │   │
                                          │  │  │   - fts_vector      │   │   │
                                          │  │  │   - section_number  │   │   │
                                          │  │  │   - section_title   │   │   │
                                          │  │  └─────────────────────┘   │   │
                                          │  │                             │   │
                                          │  │  ┌─────────────────────┐   │   │
                                          │  │  │   code_tables       │   │   │
                                          │  │  │   - table_id        │   │   │
                                          │  │  │   - summary         │   │   │
                                          │  │  │   - data (JSONB)    │   │   │
                                          │  │  │   - embedding       │   │   │
                                          │  │  └─────────────────────┘   │   │
                                          │  │                             │   │
                                          │  │  ┌─────────────────────┐   │   │
                                          │  │  │   RPC Functions     │   │   │
                                          │  │  │   - hybrid_search() │   │   │
                                          │  │  │   - search_code_    │   │   │
                                          │  │  │     tables()        │   │   │
                                          │  │  └─────────────────────┘   │   │
                                          │  └─────────────────────────────┘   │
                                          └─────────────────────────────────────┘
```

---

## Data Ingestion Pipeline

The ingestion pipeline (`scripts/ingest.py`) transforms PDF building codes into searchable vector embeddings and structured data.

### Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INGESTION PIPELINE FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

   PDF FILE                    PROCESSING STAGES                    DATABASE
   ========                    =================                    ========

┌───────────┐
│ Building  │
│ Code PDF  │
│ (100+ pg) │
└─────┬─────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: PDF LOADING                                                        │
│                                                                             │
│   PyPDFLoader extracts text page-by-page                                   │
│   - Preserves page numbers for citation                                    │
│   - Handles multi-column layouts                                           │
│   - Output: List[Document] with page metadata                              │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: TEXT SPLITTING                                                     │
│                                                                             │
│   RecursiveCharacterTextSplitter with building code optimizations          │
│                                                                             │
│   Separators (in priority order):                                          │
│   1. "\n\n\n"          (major section breaks)                              │
│   2. "\n\n"            (paragraph breaks)                                  │
│   3. "\nSection "      (section headers)                                   │
│   4. "\nCHAPTER "      (chapter headers)                                   │
│   5. "\nARTICLE "      (article headers)                                   │
│   6. "\n§ "            (section symbol)                                    │
│   7. "\n", ". ", etc.  (fallbacks)                                         │
│                                                                             │
│   Configuration:                                                            │
│   - Chunk size: 1000 characters                                            │
│   - Overlap: 200 characters (ensures context preservation)                 │
│   - Keep separators: true                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 3: SECTION EXTRACTION                                                 │
│                                                                             │
│   extract_section_info() parses section numbers and titles                 │
│                                                                             │
│   Regex patterns supported:                                                 │
│   - "1011.5.2 Handrails"           → number: "1011.5.2", title: "Handrails"│
│   - "Section 1011.5 - Stairways"   → number: "1011.5", title: "Stairways"  │
│   - "§ 1011.5 Stairways"           → number: "1011.5", title: "Stairways"  │
│                                                                             │
│   This enables:                                                             │
│   - Precise citation in analysis results                                   │
│   - Section number matching in keyword search (bonus scoring)              │
│   - Specific vs general rule identification                                │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 4: METADATA ENRICHMENT                                                │
│                                                                             │
│   Each chunk receives comprehensive metadata:                              │
│                                                                             │
│   {                                                                         │
│     "source": "florida_building_code.pdf",                                 │
│     "page_number": 245,                                                    │
│     "chunk_index": 1247,                                                   │
│     "jurisdiction": "Florida",                                             │
│     "code_name": "Florida Building Code",                                  │
│     "code_version": "8th Edition (2023)",                                  │
│     "section_number": "1011.10",                                           │
│     "section_title": "Spiral Stairways",                                   │
│     "document_hash": "a1b2c3d4e5f6g7h8",  // For deduplication            │
│     "ingested_at": "2024-12-04T10:30:00Z",                                 │
│     "char_count": 847                                                      │
│   }                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 5: EMBEDDING GENERATION                                               │
│                                                                             │
│   OpenAI text-embedding-3-small                                            │
│                                                                             │
│   - Batch processing: 100 chunks per API call                              │
│   - Output: 1536-dimensional vectors                                       │
│   - Progress tracking with console output                                  │
│                                                                             │
│   Semantic encoding captures:                                              │
│   - Conceptual meaning (not just keywords)                                 │
│   - Synonyms and related terms                                             │
│   - Context and intent                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ├────────────────────────────────────────────┐
      ▼                                            ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────────────┐
│ STAGE 6A: TEXT STORAGE         │  │ STAGE 6B: TABLE STORAGE                 │
│                                 │  │                                         │
│ code_sections table:            │  │ code_tables table:                      │
│                                 │  │                                         │
│ - content (TEXT)                │  │ - table_id ("Table 1004.5")             │
│ - embedding (VECTOR 1536)       │  │ - table_title                           │
│ - section_number                │  │ - summary (for semantic search)         │
│ - section_title                 │  │ - data (JSONB - structured!)            │
│ - page_number                   │  │ - summary_embedding (VECTOR)            │
│ - jurisdiction                  │  │ - jurisdiction, code_name               │
│ - code_name, code_version       │  │                                         │
│ - document_hash                 │  │ Supports upsert for updates             │
│                                 │  │                                         │
│ Batch insert: 100 records/batch │  │                                         │
└─────────────────────────────────┘  └─────────────────────────────────────────┘
```

### Ingestion Script Usage

```bash
# Basic usage - ingest a PDF
python ingest.py florida_building_code.pdf

# Full options
python ingest.py \
  --file path/to/code.pdf \
  --jurisdiction "Florida" \
  --code-name "Florida Building Code" \
  --code-version "8th Edition (2023)" \
  --replace  # Delete existing chunks from same document

# Tables only (no PDF)
python ingest.py --tables-only -j "Florida" -n "FBC" -v "2023"

# Skip sample tables
python ingest.py code.pdf --no-tables
```

### Structured Table Ingestion

The system supports ingesting structured tables separately from text. This is critical for accurate numeric calculations.

```python
# Example: Ingesting Table 1004.5 (Occupancy Load Factors)
ingest_table(
    client=supabase_client,
    table_id="Table 1004.5",
    table_title="Maximum Floor Area Allowances Per Occupant",
    summary="Occupancy load factors for calculating maximum occupants...",
    data={
        "occupancies": {
            "Assembly": {
                "Standing space": 5,        # 5 sq ft per person
                "Concentrated": 7,          # 7 sq ft per person
                "Unconcentrated": 15        # 15 sq ft per person
            },
            "Business": {"General": 150},
            # ... more occupancy types
        }
    },
    jurisdiction="Florida",
    code_name="Florida Building Code",
    code_version="8th Edition (2023)"
)
```

**Pre-loaded Sample Tables:**
- `Table 1004.5` - Occupancy Load Factors
- `Table 1011.5.2` - Stair Riser Heights and Tread Depths
- `Table 1006.2.1` - Egress Width Per Occupant

---

## Database Schema

### code_sections Table

```sql
CREATE TABLE code_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Content
  content TEXT NOT NULL,

  -- Metadata columns (denormalized for fast filtering)
  section_number TEXT,           -- e.g., "1011.10"
  section_title TEXT,            -- e.g., "Spiral Stairways"
  page_number INTEGER,
  chunk_index INTEGER,

  -- Classification
  jurisdiction TEXT,             -- e.g., "Florida"
  code_name TEXT,                -- e.g., "Florida Building Code"
  code_version TEXT,             -- e.g., "8th Edition (2023)"

  -- Search vectors
  embedding VECTOR(1536),        -- Semantic search
  fts_vector TSVECTOR,           -- Keyword search (auto-generated)

  -- Tracking
  document_hash TEXT,            -- For deduplication
  metadata JSONB DEFAULT '{}',   -- Extra fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast vector search
CREATE INDEX idx_code_sections_embedding
  ON code_sections USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- GIN index for full-text search
CREATE INDEX idx_code_sections_fts ON code_sections USING gin(fts_vector);

-- Trigger for automatic FTS vector generation
CREATE TRIGGER code_sections_fts_trigger
  BEFORE INSERT OR UPDATE ON code_sections
  FOR EACH ROW EXECUTE FUNCTION update_code_sections_fts();
```

### code_tables Table

```sql
CREATE TABLE code_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  table_id TEXT NOT NULL UNIQUE,  -- e.g., "Table 1004.5"
  table_title TEXT,

  -- Content
  summary TEXT NOT NULL,          -- Natural language (for embedding)
  data JSONB NOT NULL,            -- Structured data (for calculations)

  -- Classification
  jurisdiction TEXT,
  code_name TEXT,
  code_version TEXT,
  section_reference TEXT,

  -- Search
  summary_embedding VECTOR(1536),
  fts_vector TSVECTOR,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Hybrid Search Implementation

### Scoring Algorithm

```
COMBINED_SCORE = (VECTOR_SCORE × 1.0) + (KEYWORD_SCORE × 1.5) + SECTION_BONUS

Where:
- VECTOR_SCORE: Cosine similarity (0.0 - 1.0)
- KEYWORD_SCORE: ts_rank_cd result (normalized)
- KEYWORD_WEIGHT: 1.5 (50% boost for keyword matches)
- SECTION_BONUS: 0.3 if query contains exact section number match
```

### hybrid_search() RPC Function

```sql
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10,
  filter_jurisdiction TEXT DEFAULT NULL,
  filter_code_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  section_number TEXT,
  section_title TEXT,
  jurisdiction TEXT,
  code_name TEXT,
  code_version TEXT,
  page_number INT,
  vector_score FLOAT,
  keyword_score FLOAT,
  combined_score FLOAT
) AS $$
-- Implementation combines:
-- 1. HNSW vector similarity search
-- 2. Full-text search with ts_rank_cd
-- 3. Exact section number matching bonus
-- Returns results ranked by combined_score
$$ LANGUAGE plpgsql;
```

### Why Hybrid Search?

| Scenario | Vector Only | Keyword Only | Hybrid |
|----------|-------------|--------------|--------|
| "spiral stairway" → finds "helical stairs" | ✅ | ❌ | ✅ |
| "Section 1011.10" → exact match | ⚠️ (may miss) | ✅ | ✅ |
| "minimum width requirements" | ✅ | ⚠️ | ✅ |
| "26 inches" → specific number | ⚠️ | ✅ | ✅ |

---

## AI Analysis Engine

### System Prompt Structure

The SUPER_RAG_SYSTEM_PROMPT contains five critical sections:

#### 1. Data Hierarchy Rules

```
## DATA HIERARCHY (CRITICAL - FOLLOW THIS ORDER)

### 1. STRUCTURED TABLE DATA (Highest Priority)
If you are provided with "Structured Table Data" (JSON), you MUST use that
data for any calculations, numeric lookups, or threshold determinations.

### 2. SPECIFIC RULES (Second Priority)
When analyzing a defect, first identify the SPECIFIC type of building element:
- "Spiral Stairway" is more specific than "Stairway"

### 3. GENERAL TEXT CONTEXT (Third Priority)
Use the retrieved text context for understanding requirements not covered
by tables and interpreting exceptions.
```

#### 2. Query Interpretation Logic

```
## QUERY INTERPRETATION (CRITICAL)

Users will describe EXISTING CONDITIONS or ASK QUESTIONS.

### Key Interpretation Rule
When a user states a number (e.g., "50 occupants", "30 inches wide"),
treat this as the ACTUAL CONDITION being inspected, NOT as their assertion
of what the code requires.

**Example:**
- Query: "A 500 sq ft standing assembly room has 50 occupants"
- Code: Table 1004.5 says 5 sq ft per person → max = 100 occupants
- Analysis: 50 < 100 → **PASS** (the condition is compliant)
- Do NOT say "your calculation is wrong" - they're stating a condition!
```

#### 3. Critical Rules

```
## CRITICAL RULES

1. USE ONLY PROVIDED DATA - never invent requirements
2. NEVER HALLUCINATE - trust only retrieved context
3. CITE PRECISELY - exact section numbers and table IDs
4. BE CONSERVATIVE - flag ambiguous cases as WARNING
5. SHOW YOUR WORK - explain data source and comparisons
```

#### 4. Evaluation Criteria

```
## EVALUATION CRITERIA

- PASS: Condition fully complies with requirements
- FAIL: Condition violates one or more requirements
- WARNING: Borderline or needs additional inspection
- INSUFFICIENT_CONTEXT: Not enough information to determine
```

#### 5. Response Format

```json
{
  "status": "PASS | FAIL | WARNING | INSUFFICIENT_CONTEXT",
  "citation": "Primary code reference",
  "allCitations": ["All sections referenced"],
  "reasoning": "Detailed explanation",
  "dataSourceUsed": "text | table | both",
  "specificRuleApplied": "Section number or null",
  "riskScore": 1-10,
  "riskFactors": {
    "lifeSafety": "LOW | MEDIUM | HIGH | CRITICAL",
    "reworkCost": "LOW | MEDIUM | HIGH",
    "scheduleImpact": "LOW | MEDIUM | HIGH"
  },
  "recommendations": ["Corrective actions"],
  "confidence": 0.0-1.0
}
```

---

## Query Interpretation Logic

This is a critical innovation in SUPER RAG. The system distinguishes between:

### Condition Statements (User describing what exists)

| Query | Interpretation | Analysis Approach |
|-------|---------------|-------------------|
| "The room has 50 occupants" | Actual count | Compare 50 vs max allowed |
| "A 30-inch spiral stairway" | Actual width | Compare 30" vs min required |
| "7-inch risers" | Actual measurement | Compare 7" vs max allowed |

### Requirement Questions (User asking what code says)

| Query | Interpretation | Analysis Approach |
|-------|---------------|-------------------|
| "What is the maximum occupant load?" | Code lookup | Calculate from table |
| "What width is required?" | Code lookup | Return requirement |
| "Is 50 compliant?" | Compliance check | Compare to requirement |

### Why This Matters

**Without Query Interpretation:**
- User: "A 500 sq ft room has 50 occupants"
- AI: "Wrong! The maximum should be 100!" ❌

**With Query Interpretation:**
- User: "A 500 sq ft room has 50 occupants"
- AI: "PASS - 50 occupants is within the 100 maximum" ✅

---

## Response Parsing & Validation

The `parseAnalystResponse()` function handles edge cases gracefully:

```typescript
function parseAnalystResponse(content: string): ExtendedAnalysisResult {
  // Extract JSON from response
  let parsed = JSON.parse(content);

  // Validate status (required)
  const validStatuses = ["PASS", "FAIL", "WARNING", "INSUFFICIENT_CONTEXT"];
  if (!validStatuses.includes(parsed.status)) {
    throw new Error(`Invalid status: ${parsed.status}`);
  }

  // Map INSUFFICIENT_CONTEXT to WARNING for UI
  const mappedStatus = status === "INSUFFICIENT_CONTEXT" ? "WARNING" : status;

  // Handle null/missing risk score (default to 5)
  let riskScore = Number(parsed.riskScore);
  if (isNaN(riskScore) || parsed.riskScore === null) {
    riskScore = 5;  // Default for uncertain cases
  }
  riskScore = Math.max(1, Math.min(10, riskScore));  // Clamp to 1-10

  // Handle null/missing confidence (default based on status)
  let confidence = Number(parsed.confidence);
  if (isNaN(confidence) || parsed.confidence === null) {
    confidence = status === "INSUFFICIENT_CONTEXT" ? 0.3 : 0.5;
  }
  confidence = Math.max(0, Math.min(1, confidence));  // Clamp to 0-1

  // Default risk factors if missing
  const defaultRiskFactors = {
    lifeSafety: "MEDIUM",
    reworkCost: "MEDIUM",
    scheduleImpact: "LOW",
  };

  // Default recommendations if missing
  const recommendations = parsed.recommendations ||
    ["Provide more specific details for accurate analysis."];

  return {
    status: mappedStatus,
    citation: parsed.citation || "N/A - Insufficient information",
    reasoning: parsed.reasoning || "Unable to make determination.",
    riskScore,
    riskFactors: parsed.riskFactors || defaultRiskFactors,
    recommendations,
    confidence,
    // ... other fields
  };
}
```

### Edge Case Handling

| Scenario | AI Returns | Parser Handles |
|----------|------------|----------------|
| Insufficient context | `riskScore: null` | Default to 5 |
| Missing confidence | `confidence: null` | Default to 0.3-0.5 |
| No recommendations | `recommendations: null` | Default message |
| Invalid status | `status: "MAYBE"` | Throws error |

---

## API Reference

### performSuperRAGAnalysis()

```typescript
interface SuperRAGInput {
  query: string;                    // User's compliance question
  jurisdiction?: string;            // e.g., "Florida"
  codeName?: string;                // e.g., "Florida Building Code"
  textMatchCount?: number;          // Default: 8
  tableMatchThreshold?: number;     // Default: 0.82
}

interface SuperRAGResponse {
  result: {
    status: "PASS" | "FAIL" | "WARNING";
    citation: string;
    reasoning: string;
    riskScore: number;              // 1-10
    riskFactors: {
      lifeSafety: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      reworkCost: "LOW" | "MEDIUM" | "HIGH";
      scheduleImpact: "LOW" | "MEDIUM" | "HIGH";
    };
    recommendations: string[];
    confidence: number;             // 0.0-1.0
    allCitations?: string[];
    dataSourceUsed?: "text" | "table" | "both";
    specificRuleApplied?: string | null;
  };
  metadata: {
    timestamp: string;
    modelVersion: string;
    processingTimeMs: number;
    tokensUsed: { prompt, completion, total };
  };
  codeSnippets: RegulatoryCodeSnippet[];
  retrievalStats: {
    textChunksFound: number;
    tablesFound: number;
    embeddingTime: number;
    searchTime: number;
  };
}
```

### retrieveComplianceData()

```typescript
interface ComplianceData {
  textContext: string;              // Formatted for LLM
  textChunks: TextChunk[];          // Raw retrieved chunks
  tableContext: CodeTable[];        // Structured tables
  query: string;
  embeddingTime: number;
  searchTime: number;
}
```

---

## Configuration & Tuning

### Environment Variables

```bash
# Required
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbG...
OPENAI_API_KEY=sk-...

# Database (for Prisma)
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true
```

### Tuning Parameters

| Parameter | Default | Impact |
|-----------|---------|--------|
| `TEXT_MATCH_THRESHOLD` | 0.5 | Lower = more results, less relevant |
| `TEXT_MATCH_COUNT` | 8 | More = better coverage, higher cost |
| `TABLE_MATCH_THRESHOLD` | 0.82 | Higher = only highly relevant tables |
| `TABLE_MATCH_COUNT` | 3 | More structured data context |
| `CHUNK_SIZE` | 1000 | Larger = more context per chunk |
| `CHUNK_OVERLAP` | 200 | Higher = better context preservation |
| `temperature` | 0.1 | Lower = more deterministic |

---

## Performance Metrics

| Stage | Typical Time |
|-------|--------------|
| Embedding Generation | 100-200ms |
| Hybrid Search | 300-500ms |
| LLM Analysis | 3000-5000ms |
| **Total Response** | **3500-5700ms** |

---

## File Reference

| File | Purpose |
|------|---------|
| `scripts/ingest.py` | PDF ingestion pipeline |
| `app/actions/performSuperRAGAnalysis.ts` | Analyst (orchestration + LLM) |
| `app/actions/retrieveComplianceData.ts` | Router (retrieval logic) |
| `app/components/dashboard/ComplianceAnalyzer.tsx` | UI component |
| `app/lib/openai.ts` | OpenAI client configuration |

---

**Document Version:** 1.1
**Copyright:** Quantra, Inc. All Rights Reserved.
