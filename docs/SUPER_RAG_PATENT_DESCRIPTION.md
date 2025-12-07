# SUPER RAG Patent Application Materials
## Structured Understanding with Prioritized Evidence Retrieval and Augmented Generation

**Prepared for Patent Counsel**
**Confidential - Attorney-Client Privileged**

**Applicant:** Quantra, Inc.
**Inventors:** [To be completed by legal counsel]
**Filing Date:** [To be completed]
**Application Number:** [To be assigned]
**Version:** 2.0

---

## TITLE OF INVENTION

**Dual-Source Hierarchical Hybrid Retrieval-Augmented Generation System with Query Intent Classification for Construction Compliance Analysis**

---

## ABSTRACT

A computer-implemented system and method for automated construction compliance analysis comprising: (1) a dual-source document ingestion pipeline that separately processes project specifications (CSI MasterFormat documents with extracted parameters) and building codes (regulatory text), storing each in dedicated database tables; (2) a parallel dual-source retrieval engine that simultaneously queries project specifications filtered by project identifier and building codes filtered by library/jurisdiction; (3) a hybrid search combining semantic vector search with keyword-based full-text search using weighted scoring with exact-match bonuses; (4) a four-tier evidence hierarchy where project design specifications supersede structured tabular data, which supersedes specific regulatory rules, which supersede general regulatory text; (5) a query intent classification system distinguishing between condition statements describing existing states versus requirement questions asking about code specifications; (6) a context assembly system that labels retrieved results as "Design Requirements" versus "Code Requirements" with instructions that design specifications override code when stricter; (7) a constrained artificial intelligence analyst with anti-hallucination guardrails that reports BOTH design and code limits and identifies the governing requirement; and (8) a robust response parser with default value handling for edge cases. The invention addresses technical problems of comparing project-specific design requirements against regulatory code minimums by retrieving from both sources, enforcing evidence prioritization, and correctly identifying which limit governs.

---

## FIELD OF THE INVENTION

The present invention relates generally to artificial intelligence systems for document analysis and retrieval-augmented generation, and more particularly to a dual-source compliance determination system that retrieves from both project-specific design specifications and regulatory building codes, combining document ingestion, hybrid search, hierarchical evidence prioritization, query intent classification, and constrained AI analysis to determine which requirement governs in construction compliance scenarios.

---

## BACKGROUND OF THE INVENTION

### Technical Problem

Regulatory compliance analysis in the construction industry presents significant technical challenges:

1. **Document Ingestion**: Building codes exist as large PDF documents requiring extraction, segmentation, and indexing while preserving section structure and relationships.

2. **Volume and Complexity**: Building codes comprise thousands of pages with interconnected requirements, exceptions, and cross-references.

3. **Specificity Hierarchy**: Regulatory codes contain both general rules and specific exceptions, where specific rules must override general rules in applicable contexts.

4. **Structured vs. Unstructured Data**: Building codes contain both narrative text and structured tables with numeric values, requiring different retrieval and interpretation approaches.

5. **Query Intent Ambiguity**: Users may describe existing conditions to check for compliance OR ask what the code requires - these require fundamentally different analysis approaches.

6. **Response Robustness**: AI systems may return incomplete or malformed responses requiring graceful handling.

7. **Accuracy Requirements**: Compliance determinations carry legal and safety implications, requiring high accuracy, transparent reasoning, and appropriate uncertainty handling.

### Limitations of Prior Art

**Traditional Document Search Systems:**
- Require manual PDF processing without automated section extraction
- Cannot generate semantic embeddings for meaning-based search
- No separation of structured tables from narrative text

**Pure Vector-Based Semantic Search:**
- May miss exact terminology critical in legal/regulatory contexts
- Cannot leverage structured tabular data effectively
- No inherent hierarchy for prioritizing evidence sources

**Standard RAG (Retrieval-Augmented Generation) Systems:**
- Treat all retrieved content equally without prioritization
- Do not distinguish between structured tables and narrative text
- Lack mechanisms to enforce specific-over-general rule application
- Cannot distinguish between condition statements and requirement questions
- No robust handling of AI response edge cases
- Prone to hallucination when context is insufficient

**The present invention overcomes these limitations through a comprehensive system comprising ingestion, hybrid retrieval, hierarchical prioritization, query intent classification, constrained AI analysis, and robust response parsing.**

---

## SUMMARY OF THE INVENTION

The present invention provides a system and method comprising:

1. **Document Ingestion Pipeline**: Automated extraction from PDF documents with intelligent text segmentation, section number and title identification via pattern matching, metadata enrichment, semantic embedding generation, and dual-path storage for text chunks and structured tables.

2. **Hybrid Retrieval Engine**: Parallel execution of semantic vector search and keyword-based full-text search with weighted score combination and exact section-number matching bonuses.

3. **Dual Content Retrieval**: Separate retrieval paths for narrative text chunks and structured tabular data stored as JSONB.

4. **Three-Tier Evidence Hierarchy**: Enforcement of prioritization where:
   - Tier 1 (Highest): Structured tabular data with numeric values
   - Tier 2 (Middle): Specific regulatory rules for identified element types
   - Tier 3 (Lowest): General regulatory text context

5. **Query Intent Classification**: Distinction between condition statements (describing existing states for compliance checking) and requirement questions (asking what the code specifies).

6. **Constrained AI Analysis**: Large language model operation under explicit hierarchy rules, query interpretation guidelines, and anti-hallucination guardrails.

7. **Robust Response Parsing**: Validation and default value handling for AI responses including null handling, value clamping, and graceful degradation.

8. **Structured Output Generation**: Compliance determinations with citations, risk scores, confidence levels, data source attribution, and audit trails.

---

## DETAILED DESCRIPTION OF THE INVENTION

### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    SUPER RAG SYSTEM ARCHITECTURE                            │
│                    (Patent Figure 1)                                        │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                         INGESTION SUBSYSTEM                                 │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │    PDF      │    │    Text     │    │  Section    │    │  Embedding  │ │
│  │   Loader    │───▶│  Splitter   │───▶│  Extractor  │───▶│  Generator  │ │
│  │             │    │             │    │             │    │             │ │
│  │ PyPDFLoader │    │ Recursive   │    │ Regex-based │    │ OpenAI      │ │
│  │ Page-by-    │    │ Character   │    │ section #   │    │ text-embed- │ │
│  │ page        │    │ 1000 chars  │    │ and title   │    │ ding-3-     │ │
│  │ extraction  │    │ 200 overlap │    │ extraction  │    │ small       │ │
│  └─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘ │
│                                                                   │        │
│                                    ┌──────────────────────────────┴──────┐ │
│                                    │                                     │ │
│                                    ▼                                     ▼ │
│                         ┌─────────────────────┐         ┌────────────────┐ │
│                         │   code_sections     │         │  code_tables   │ │
│                         │   (Text Chunks)     │         │  (JSONB Data)  │ │
│                         └─────────────────────┘         └────────────────┘ │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                         RETRIEVAL SUBSYSTEM                                 │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    HYBRID SEARCH ENGINE                               │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────┐     ┌─────────────────────────────────┐ │ │
│  │  │   VECTOR SEARCH         │     │   KEYWORD SEARCH                │ │ │
│  │  │                         │     │                                 │ │ │
│  │  │   HNSW Index            │     │   GIN Index (tsvector)         │ │ │
│  │  │   Cosine Similarity     │     │   plainto_tsquery              │ │ │
│  │  │   Weight: 1.0           │     │   Weight: 1.5                  │ │ │
│  │  └────────────┬────────────┘     └────────────┬────────────────────┘ │ │
│  │               │                               │                       │ │
│  │               └───────────┬───────────────────┘                       │ │
│  │                           ▼                                           │ │
│  │              ┌─────────────────────────┐                             │ │
│  │              │   SCORE COMBINER        │                             │ │
│  │              │                         │                             │ │
│  │              │   combined = V×1.0 +    │                             │ │
│  │              │   K×1.5 + section_bonus │                             │ │
│  │              └─────────────────────────┘                             │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                         ANALYSIS SUBSYSTEM                                  │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │              CONSTRAINED AI ANALYST (GPT-4o)                          │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │                 SYSTEM PROMPT CONSTRAINTS                       │ │ │
│  │  │                                                                 │ │ │
│  │  │  1. DATA HIERARCHY RULES                                       │ │ │
│  │  │     Tables > Specific Rules > General Text                     │ │ │
│  │  │                                                                 │ │ │
│  │  │  2. QUERY INTENT CLASSIFICATION                                │ │ │
│  │  │     Condition Statements vs Requirement Questions              │ │ │
│  │  │                                                                 │ │ │
│  │  │  3. ANTI-HALLUCINATION GUARDRAILS                             │ │ │
│  │  │     Use only provided data; return INSUFFICIENT_CONTEXT        │ │ │
│  │  │                                                                 │ │ │
│  │  │  4. STRUCTURED OUTPUT FORMAT                                   │ │ │
│  │  │     JSON schema with required fields                           │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                    RESPONSE PARSER                                    │ │
│  │                                                                       │ │
│  │  • JSON extraction and validation                                    │ │
│  │  • Status mapping (INSUFFICIENT_CONTEXT → WARNING)                   │ │
│  │  • Null handling with defaults (riskScore: 5, confidence: 0.3-0.5)  │ │
│  │  • Value clamping (riskScore: 1-10, confidence: 0-1)                │ │
│  │  • Default risk factors and recommendations                          │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Descriptions

#### 1. Document Ingestion Pipeline (Patent Figure 2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DOCUMENT INGESTION PIPELINE                              │
│                    (Patent Figure 2)                                        │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ STAGE 1: PDF LOADING                                                  │ │
│  │                                                                       │ │
│  │ Input: PDF document (e.g., Florida Building Code, 2000+ pages)       │ │
│  │ Process: PyPDFLoader extracts text page-by-page                      │ │
│  │ Output: List[Document] with page number metadata                     │ │
│  │                                                                       │ │
│  │ Technical Details:                                                    │ │
│  │ - Preserves page boundaries for citation accuracy                    │ │
│  │ - Handles multi-column layouts                                       │ │
│  │ - Extracts embedded text, not OCR (assumes digital PDF)             │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ STAGE 2: TEXT SEGMENTATION                                            │ │
│  │                                                                       │ │
│  │ Algorithm: RecursiveCharacterTextSplitter                            │ │
│  │                                                                       │ │
│  │ Separator Priority (building code optimized):                        │ │
│  │ 1. "\n\n\n"      - Major section breaks                             │ │
│  │ 2. "\n\n"        - Paragraph breaks                                 │ │
│  │ 3. "\nSection "  - Section headers                                  │ │
│  │ 4. "\nCHAPTER "  - Chapter headers                                  │ │
│  │ 5. "\nARTICLE "  - Article headers                                  │ │
│  │ 6. "\n§ "        - Section symbol                                   │ │
│  │ 7. "\n", ". "    - Fallback separators                              │ │
│  │                                                                       │ │
│  │ Configuration:                                                        │ │
│  │ - chunk_size: 1000 characters                                        │ │
│  │ - chunk_overlap: 200 characters (context preservation)               │ │
│  │ - keep_separator: true                                               │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ STAGE 3: SECTION IDENTIFICATION                                       │ │
│  │                                                                       │ │
│  │ Function: extract_section_info(text) → {section_number, section_title}│ │
│  │                                                                       │ │
│  │ Regex Patterns:                                                       │ │
│  │ Pattern 1: ^(\d{3,4}(?:\.\d+)*)\s*\.?\s+([A-Z][A-Za-z\s\-]+)        │ │
│  │   Matches: "1011.5.2 Handrails" → ("1011.5.2", "Handrails")         │ │
│  │                                                                       │ │
│  │ Pattern 2: ^Section\s+(\d+(?:\.\d+)*)\s*[-–—]\s*([A-Za-z\s\-]+)     │ │
│  │   Matches: "Section 1011.5 - Stairway Construction"                  │ │
│  │                                                                       │ │
│  │ Pattern 3: ^§\s*(\d+(?:\.\d+)*)\s+([A-Za-z\s\-]+)                   │ │
│  │   Matches: "§ 1011.5 Stairway Construction"                          │ │
│  │                                                                       │ │
│  │ Purpose: Enables precise citation and specific-rule identification   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ STAGE 4: METADATA ENRICHMENT                                          │ │
│  │                                                                       │ │
│  │ Each chunk receives:                                                  │ │
│  │ {                                                                     │ │
│  │   "source": "florida_building_code.pdf",                             │ │
│  │   "page_number": 245,                                                │ │
│  │   "chunk_index": 1247,                                               │ │
│  │   "jurisdiction": "Florida",                                         │ │
│  │   "code_name": "Florida Building Code",                              │ │
│  │   "code_version": "8th Edition (2023)",                              │ │
│  │   "section_number": "1011.10",        // Extracted                   │ │
│  │   "section_title": "Spiral Stairways", // Extracted                  │ │
│  │   "document_hash": "a1b2c3d4...",     // SHA-256, deduplication     │ │
│  │   "ingested_at": "2024-12-04T10:30:00Z"                              │ │
│  │ }                                                                     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │ STAGE 5: EMBEDDING GENERATION                                         │ │
│  │                                                                       │ │
│  │ Model: OpenAI text-embedding-3-small                                 │ │
│  │ Dimensions: 1536                                                      │ │
│  │ Batch Size: 100 chunks per API call                                  │ │
│  │                                                                       │ │
│  │ Properties:                                                           │ │
│  │ - Semantic similarity preserved in vector space                      │ │
│  │ - Similar meanings → similar vectors (cosine similarity)             │ │
│  │ - Enables retrieval of conceptually related content                  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                       │
│                    ▼                               ▼                       │
│  ┌─────────────────────────────┐    ┌─────────────────────────────────────┐│
│  │ STAGE 6A: TEXT STORAGE      │    │ STAGE 6B: TABLE STORAGE             ││
│  │                             │    │                                     ││
│  │ Table: code_sections        │    │ Table: code_tables                  ││
│  │                             │    │                                     ││
│  │ Columns:                    │    │ Columns:                            ││
│  │ - id (UUID)                 │    │ - id (UUID)                         ││
│  │ - content (TEXT)            │    │ - table_id (TEXT, unique)           ││
│  │ - embedding (VECTOR 1536)   │    │ - table_title (TEXT)                ││
│  │ - fts_vector (TSVECTOR)     │    │ - summary (TEXT)                    ││
│  │ - section_number (TEXT)     │    │ - data (JSONB)                      ││
│  │ - section_title (TEXT)      │    │ - summary_embedding (VECTOR)        ││
│  │ - jurisdiction, code_name   │    │ - fts_vector (TSVECTOR)             ││
│  │ - page_number, chunk_index  │    │ - jurisdiction, code_name           ││
│  │ - document_hash             │    │ - section_reference                 ││
│  │                             │    │                                     ││
│  │ Indexes:                    │    │ Indexes:                            ││
│  │ - HNSW (embedding)          │    │ - HNSW (summary_embedding)          ││
│  │ - GIN (fts_vector)          │    │ - GIN (fts_vector)                  ││
│  │                             │    │ - GIN (data) for JSONB queries      ││
│  └─────────────────────────────┘    └─────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 2. Hybrid Search Engine (Patent Figure 3)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HYBRID SEARCH SCORING ALGORITHM                          │
│                    (Patent Figure 3)                                        │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         SCORING FORMULA                               │ │
│  │                                                                       │ │
│  │   COMBINED_SCORE = (V × Wv) + (K × Wk) + B                           │ │
│  │                                                                       │ │
│  │   Where:                                                              │ │
│  │     V  = Vector similarity score (cosine, 0.0 - 1.0)                 │ │
│  │     Wv = Vector weight (1.0)                                         │ │
│  │     K  = Keyword match score (ts_rank_cd, normalized)                │ │
│  │     Wk = Keyword weight (1.5) - 50% boost for exact matches         │ │
│  │     B  = Section number exact match bonus (0.3)                      │ │
│  │                                                                       │ │
│  │   Rationale:                                                          │ │
│  │   - Keywords weighted higher because exact terminology matters       │ │
│  │     in legal/regulatory contexts                                     │ │
│  │   - Section number bonus enables precise citation matching           │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                         SEARCH FLOW                                   │ │
│  │                                                                       │ │
│  │   Query: "Is a 30-inch spiral stairway compliant?"                   │ │
│  │                          │                                            │ │
│  │                          ▼                                            │ │
│  │   ┌──────────────────────────────────────────┐                       │ │
│  │   │ EMBEDDING GENERATION                     │                       │ │
│  │   │ Query → [0.023, -0.089, 0.045, ...]     │                       │ │
│  │   └──────────────────────────────────────────┘                       │ │
│  │                          │                                            │ │
│  │          ┌───────────────┴───────────────┐                           │ │
│  │          ▼                               ▼                           │ │
│  │   ┌─────────────────────┐    ┌─────────────────────┐                │ │
│  │   │ VECTOR SEARCH       │    │ KEYWORD SEARCH      │   PARALLEL     │ │
│  │   │                     │    │                     │   EXECUTION    │ │
│  │   │ HNSW Index          │    │ GIN Index           │                │ │
│  │   │ cosine < threshold  │    │ @@ tsquery          │                │ │
│  │   │                     │    │                     │                │ │
│  │   │ Finds:              │    │ Finds:              │                │ │
│  │   │ - "spiral stairs"   │    │ - "spiral"          │                │ │
│  │   │ - "helical stairs"  │    │ - "stairway"        │                │ │
│  │   │ - "winding stairs"  │    │ - "30"              │                │ │
│  │   └──────────┬──────────┘    └──────────┬──────────┘                │ │
│  │              │                          │                            │ │
│  │              └────────────┬─────────────┘                            │ │
│  │                           ▼                                          │ │
│  │   ┌──────────────────────────────────────────┐                       │ │
│  │   │ SCORE COMBINATION                        │                       │ │
│  │   │                                          │                       │ │
│  │   │ Document: Section 1011.10 Spiral Stairs  │                       │ │
│  │   │ Vector Score (V): 0.85                   │                       │ │
│  │   │ Keyword Score (K): 0.72                  │                       │ │
│  │   │ Section Bonus (B): 0.00 (no exact match) │                       │ │
│  │   │                                          │                       │ │
│  │   │ Combined = (0.85 × 1.0) + (0.72 × 1.5)  │                       │ │
│  │   │          = 0.85 + 1.08 = 1.93           │                       │ │
│  │   └──────────────────────────────────────────┘                       │ │
│  │                           │                                          │ │
│  │                           ▼                                          │ │
│  │   ┌──────────────────────────────────────────┐                       │ │
│  │   │ RANKED RESULTS                           │                       │ │
│  │   │                                          │                       │ │
│  │   │ 1. Section 1011.10 Spiral Stairways     │                       │ │
│  │   │ 2. Section 1011.5 Stairway Construction │                       │ │
│  │   │ 3. Section 1011.2 Width and Capacity    │                       │ │
│  │   │ ...                                      │                       │ │
│  │   └──────────────────────────────────────────┘                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 3. Three-Tier Evidence Hierarchy (Patent Figure 4)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THREE-TIER EVIDENCE HIERARCHY                            │
│                    (Patent Figure 4)                                        │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │   TIER 1: STRUCTURED TABLE DATA (HIGHEST PRIORITY)                   │ │
│  │   ═══════════════════════════════════════════════                    │ │
│  │                                                                       │ │
│  │   Source: code_tables (JSONB data field)                             │ │
│  │                                                                       │ │
│  │   Characteristics:                                                    │ │
│  │   • Machine-extracted numeric values                                 │ │
│  │   • Pre-verified data accuracy                                       │ │
│  │   • Direct calculation capability                                    │ │
│  │   • No interpretation required                                       │ │
│  │                                                                       │ │
│  │   Enforcement Rule:                                                   │ │
│  │   "If structured table data provides a value for the query,          │ │
│  │    that value MUST be used, OVERRIDING any text descriptions."       │ │
│  │                                                                       │ │
│  │   Example:                                                            │ │
│  │   Query: "Occupant load for standing assembly"                       │ │
│  │   Table 1004.5 JSON: { "Standing space": 5 }                         │ │
│  │   Text says: "varies by use"                                         │ │
│  │   → USE TABLE VALUE: 5 sq ft per person                              │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                         OVERRIDES  ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │   TIER 2: SPECIFIC REGULATORY RULES (MEDIUM PRIORITY)                │ │
│  │   ═══════════════════════════════════════════════════                │ │
│  │                                                                       │ │
│  │   Source: code_sections with specific section_title                  │ │
│  │                                                                       │ │
│  │   Characteristics:                                                    │ │
│  │   • Addresses specific element types                                 │ │
│  │   • Contains exceptions to general rules                             │ │
│  │   • More narrowly scoped applicability                               │ │
│  │                                                                       │ │
│  │   Enforcement Rule:                                                   │ │
│  │   "If both a specific rule and general rule are found,               │ │
│  │    the SPECIFIC RULE MUST be applied."                               │ │
│  │                                                                       │ │
│  │   Specificity Examples:                                               │ │
│  │   • "Spiral Stairway" > "Stairway"                                   │ │
│  │   • "Accessible Ramp" > "Ramp"                                       │ │
│  │   • "Assembly Occupancy" > "General Occupancy"                       │ │
│  │                                                                       │ │
│  │   Example:                                                            │ │
│  │   Query: "Spiral stairway width"                                     │ │
│  │   Found: Section 1011.10 (Spiral) AND Section 1011.5 (General)      │ │
│  │   → USE SPECIFIC: Section 1011.10, 26" minimum                       │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│                         OVERRIDES  ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │   TIER 3: GENERAL TEXT CONTEXT (LOWEST PRIORITY)                     │ │
│  │   ══════════════════════════════════════════════                     │ │
│  │                                                                       │ │
│  │   Source: code_sections (all matches)                                │ │
│  │                                                                       │ │
│  │   Characteristics:                                                    │ │
│  │   • Broad regulatory requirements                                    │ │
│  │   • Contextual information                                           │ │
│  │   • Definitions and general principles                               │ │
│  │                                                                       │ │
│  │   Application:                                                        │ │
│  │   "Use general text when no tables or specific rules apply.          │ │
│  │    Provide supporting context for Tier 1 and Tier 2 findings."       │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 4. Query Intent Classification (Patent Figure 5)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    QUERY INTENT CLASSIFICATION                              │
│                    (Patent Figure 5)                                        │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │   CLASSIFICATION CATEGORIES                                           │ │
│  │                                                                       │ │
│  │   ┌─────────────────────────────────────────────────────────────┐    │ │
│  │   │ CATEGORY A: CONDITION STATEMENTS                            │    │ │
│  │   │                                                             │    │ │
│  │   │ Definition: User describes an EXISTING STATE for checking  │    │ │
│  │   │                                                             │    │ │
│  │   │ Examples:                                                   │    │ │
│  │   │ • "The room has 50 occupants"                              │    │ │
│  │   │ • "A 30-inch spiral stairway"                              │    │ │
│  │   │ • "7-inch risers on the stairs"                            │    │ │
│  │   │                                                             │    │ │
│  │   │ Analysis Approach:                                          │    │ │
│  │   │ 1. Determine code requirement from retrieved data          │    │ │
│  │   │ 2. Compare stated condition against requirement            │    │ │
│  │   │ 3. Return PASS if condition meets requirement              │    │ │
│  │   │ 4. Return FAIL if condition violates requirement           │    │ │
│  │   └─────────────────────────────────────────────────────────────┘    │ │
│  │                                                                       │ │
│  │   ┌─────────────────────────────────────────────────────────────┐    │ │
│  │   │ CATEGORY B: REQUIREMENT QUESTIONS                           │    │ │
│  │   │                                                             │    │ │
│  │   │ Definition: User asks what the CODE REQUIRES                │    │ │
│  │   │                                                             │    │ │
│  │   │ Examples:                                                   │    │ │
│  │   │ • "What is the maximum occupant load?"                     │    │ │
│  │   │ • "What width is required for egress?"                     │    │ │
│  │   │ • "What are the riser height limits?"                      │    │ │
│  │   │                                                             │    │ │
│  │   │ Analysis Approach:                                          │    │ │
│  │   │ 1. Retrieve applicable code requirements                   │    │ │
│  │   │ 2. Calculate if necessary (e.g., occupant load)           │    │ │
│  │   │ 3. Return the code-specified value(s)                      │    │ │
│  │   └─────────────────────────────────────────────────────────────┘    │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │   KEY INTERPRETATION RULE                                             │ │
│  │                                                                       │ │
│  │   "When a user states a number (e.g., '50 occupants', '30 inches'),  │ │
│  │    treat this as the ACTUAL CONDITION being inspected,               │ │
│  │    NOT as their assertion of what the code requires."                │ │
│  │                                                                       │ │
│  │   ─────────────────────────────────────────────────────────────────  │ │
│  │                                                                       │ │
│  │   CORRECT INTERPRETATION:                                             │ │
│  │                                                                       │ │
│  │   Query: "A 500 sq ft standing room has 50 occupants"                │ │
│  │                                                                       │ │
│  │   ✓ CORRECT: "50 is the actual count; check against max"            │ │
│  │     → Code max = 100, 50 < 100, therefore PASS                       │ │
│  │                                                                       │ │
│  │   ✗ INCORRECT: "User claims max is 50; that's wrong!"               │ │
│  │     → "The max should be 100, not 50" (misinterpretation)           │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 5. Response Parser with Default Handling (Patent Figure 6)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RESPONSE PARSER WITH DEFAULT HANDLING                    │
│                    (Patent Figure 6)                                        │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │   AI RESPONSE                        PARSING LOGIC                    │ │
│  │                                                                       │ │
│  │   {                                                                   │ │
│  │     "status": "INSUFFICIENT_CONTEXT", ──▶ Map to "WARNING"           │ │
│  │     "citation": null,               ──▶ Default: "N/A - Insufficient"│ │
│  │     "reasoning": "...",                                               │ │
│  │     "riskScore": null,              ──▶ Default: 5, Clamp: [1,10]   │ │
│  │     "riskFactors": null,            ──▶ Default: {MEDIUM,MEDIUM,LOW}│ │
│  │     "recommendations": null,        ──▶ Default: ["Provide details"]│ │
│  │     "confidence": null              ──▶ Default: 0.3, Clamp: [0,1]  │ │
│  │   }                                                                   │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │   PARSING ALGORITHM                                                   │ │
│  │                                                                       │ │
│  │   function parseAnalystResponse(content):                            │ │
│  │                                                                       │ │
│  │     // Step 1: Extract JSON                                          │ │
│  │     parsed = JSON.parse(content)                                     │ │
│  │                                                                       │ │
│  │     // Step 2: Validate status (required)                            │ │
│  │     if status not in ["PASS","FAIL","WARNING","INSUFFICIENT"]:      │ │
│  │       throw Error("Invalid status")                                  │ │
│  │                                                                       │ │
│  │     // Step 3: Map INSUFFICIENT_CONTEXT → WARNING                    │ │
│  │     mappedStatus = status == "INSUFFICIENT" ? "WARNING" : status     │ │
│  │                                                                       │ │
│  │     // Step 4: Handle null/missing riskScore                         │ │
│  │     riskScore = parsed.riskScore ?? 5                                │ │
│  │     riskScore = clamp(riskScore, 1, 10)                              │ │
│  │                                                                       │ │
│  │     // Step 5: Handle null/missing confidence                        │ │
│  │     confidence = parsed.confidence ??                                │ │
│  │       (status == "INSUFFICIENT" ? 0.3 : 0.5)                        │ │
│  │     confidence = clamp(confidence, 0, 1)                             │ │
│  │                                                                       │ │
│  │     // Step 6: Handle null/missing riskFactors                       │ │
│  │     riskFactors = parsed.riskFactors ?? {                           │ │
│  │       lifeSafety: "MEDIUM",                                          │ │
│  │       reworkCost: "MEDIUM",                                          │ │
│  │       scheduleImpact: "LOW"                                          │ │
│  │     }                                                                 │ │
│  │                                                                       │ │
│  │     // Step 7: Handle null/missing recommendations                   │ │
│  │     recommendations = parsed.recommendations ??                      │ │
│  │       ["Provide more specific details for accurate analysis."]      │ │
│  │                                                                       │ │
│  │     return validated result                                          │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                                                                       │ │
│  │   EDGE CASE HANDLING MATRIX                                          │ │
│  │                                                                       │ │
│  │   ┌────────────────────┬──────────────┬──────────────────────────┐  │ │
│  │   │ AI Returns         │ Parser Does  │ Result                   │  │ │
│  │   ├────────────────────┼──────────────┼──────────────────────────┤  │ │
│  │   │ riskScore: null    │ Default to 5 │ riskScore: 5             │  │ │
│  │   │ riskScore: 15      │ Clamp to 10  │ riskScore: 10            │  │ │
│  │   │ riskScore: -2      │ Clamp to 1   │ riskScore: 1             │  │ │
│  │   │ confidence: null   │ Default 0.3-5│ confidence: 0.3 or 0.5   │  │ │
│  │   │ confidence: 1.5    │ Clamp to 1   │ confidence: 1.0          │  │ │
│  │   │ riskFactors: null  │ Use defaults │ {MED, MED, LOW}          │  │ │
│  │   │ citation: null     │ Default msg  │ "N/A - Insufficient..."  │  │ │
│  │   │ status: "MAYBE"    │ Throw error  │ Error (invalid)          │  │ │
│  │   └────────────────────┴──────────────┴──────────────────────────┘  │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## CLAIMS

### Independent Claims

**Claim 1.** A computer-implemented method for regulatory compliance analysis, comprising:

(a) receiving, by an ingestion processor, a regulatory document in PDF format;

(b) extracting text from the regulatory document page by page, preserving page number metadata;

(c) segmenting the extracted text into chunks using recursive character splitting with regulatory-document-optimized separators;

(d) identifying, for each chunk, a section number and section title using pattern matching;

(e) generating, for each chunk, a semantic embedding using a neural network encoder;

(f) storing the chunks with embeddings, section identifiers, and metadata in a first database table;

(g) receiving, by a query processor, a natural language query regarding compliance of a building element;

(h) classifying the query as either a condition statement describing an existing state or a requirement question asking what the code specifies;

(i) generating a semantic embedding for the query;

(j) executing, in parallel, a hybrid search comprising:
   (i) a semantic vector search on the first database table; and
   (ii) a keyword-based full-text search on the first database table;

(k) combining search results using a weighted scoring formula that applies greater weight to keyword matches than semantic matches;

(l) retrieving structured tabular data from a second database table storing regulatory tables as JSONB;

(m) assembling retrieved evidence into a hierarchical context structure with three priority tiers:
   (i) a first tier comprising structured tabular data;
   (ii) a second tier comprising specific regulatory rules; and
   (iii) a third tier comprising general regulatory text;

(n) transmitting the hierarchical context, query, and query classification to a large language model operating under explicit hierarchy enforcement and query interpretation constraints;

(o) receiving from the large language model a response comprising status, citation, reasoning, and numeric scores;

(p) parsing the response with default value handling for null or missing fields; and

(q) presenting the compliance determination to a user interface.

**Claim 2.** A system for regulatory compliance analysis, comprising:

a memory storing instructions; and

a processor configured to execute the instructions to:

(a) ingest regulatory documents by extracting text, segmenting into chunks with section identification, generating semantic embeddings, and storing in a vector database;

(b) separately store structured regulatory tables as JSONB data;

(c) receive natural language compliance queries;

(d) classify queries as condition statements versus requirement questions;

(e) perform parallel hybrid searches combining semantic and keyword matching with weighted score combination;

(f) enforce a three-tier evidence hierarchy where structured tables override specific rules, which override general text;

(g) invoke a constrained large language model with query interpretation guidelines and anti-hallucination guardrails;

(h) parse AI responses with default value handling for edge cases; and

(i) generate compliance determinations with citations, risk scores, and confidence levels.

**Claim 3.** A non-transitory computer-readable medium storing instructions that, when executed by a processor, cause the processor to perform operations comprising:

implementing a retrieval-augmented generation system that:

(a) processes regulatory PDF documents into searchable chunks with extracted section numbers and semantic embeddings;

(b) stores structured regulatory tables separately from narrative text;

(c) combines semantic vector search with keyword full-text search using configurable weights;

(d) distinguishes between user queries describing existing conditions versus asking about requirements;

(e) applies a prioritization hierarchy favoring structured data over specific rules over general text;

(f) constrains AI analysis to use only provided evidence with query-intent-appropriate interpretation;

(g) handles null and edge-case AI responses with sensible defaults; and

(h) produces auditable compliance determinations with source attribution.

### Dependent Claims

**Claim 4.** The method of Claim 1, wherein segmenting the extracted text uses separators prioritized in order: triple newlines, double newlines, "Section " prefix, "CHAPTER " prefix, "ARTICLE " prefix, section symbol, single newlines, and sentence boundaries.

**Claim 5.** The method of Claim 1, wherein identifying section numbers uses regex patterns matching formats including:
- decimal section numbers followed by titles (e.g., "1011.5.2 Handrails");
- "Section" keyword with number and dash-separated title; and
- section symbol (§) with number and title.

**Claim 6.** The method of Claim 1, wherein the weighted scoring formula is:
```
COMBINED_SCORE = (VECTOR_SCORE × 1.0) + (KEYWORD_SCORE × 1.5) + SECTION_BONUS
```
where SECTION_BONUS is applied when the query contains an exact match to a regulatory section number.

**Claim 7.** The method of Claim 1, wherein classifying the query comprises recognizing numeric values stated by the user as existing conditions to be checked rather than claimed code requirements.

**Claim 8.** The method of Claim 1, wherein parsing the response with default value handling comprises:
- defaulting null risk scores to 5 and clamping to range 1-10;
- defaulting null confidence scores to 0.3 for insufficient context or 0.5 otherwise, and clamping to range 0-1;
- providing default risk factors of MEDIUM/MEDIUM/LOW when not specified; and
- providing a default recommendation requesting more details when not specified.

**Claim 9.** The method of Claim 1, wherein the large language model constraint framework includes:
- explicit instructions to use table data for any numeric calculations;
- instructions to select specific rules over general rules when both apply;
- query interpretation rules treating stated numbers as conditions, not requirements;
- anti-hallucination directives prohibiting invention of regulatory requirements; and
- mandatory "INSUFFICIENT_CONTEXT" response when evidence is lacking.

**Claim 10.** The method of Claim 1, further comprising:
generating, for structured regulatory tables, a summary text description;
generating an embedding for the summary; and
using the summary embedding for semantic search while returning the structured JSONB data for calculations.

**Claim 11.** The system of Claim 2, wherein the ingestion further comprises:
calculating a document hash for deduplication;
storing the hash with each chunk; and
supporting deletion of existing chunks before re-ingestion based on hash matching.

**Claim 12.** The system of Claim 2, wherein the three-tier evidence hierarchy is enforced through structured prompt engineering that:
- labels structured table data as "Section A: HIGHEST PRIORITY";
- labels text context as "Section B"; and
- includes explicit instructions that Section A overrides Section B for numeric determinations.

**Claim 13.** The system of Claim 2, wherein query classification is performed by the large language model based on explicit examples in the system prompt demonstrating correct interpretation of condition statements versus requirement questions.

**Claim 14.** The non-transitory computer-readable medium of Claim 3, wherein the structured regulatory tables include occupancy load factors, dimensional requirements, and egress width calculations stored as nested JSONB objects.

**Claim 15.** The non-transitory computer-readable medium of Claim 3, wherein handling null responses comprises mapping an INSUFFICIENT_CONTEXT status to WARNING status while applying conservative default values for risk assessment.

---

## ABSTRACT OF THE DISCLOSURE

A computer-implemented system and method for automated regulatory compliance analysis comprising: a document ingestion pipeline extracting text from regulatory PDFs with section identification, segmentation, and semantic embedding generation; dual storage for text chunks and structured JSONB tables; a hybrid retrieval engine combining semantic vector search with keyword-based full-text search using weighted scoring with keyword prioritization; a three-tier evidence hierarchy prioritizing structured tables over specific rules over general text; a query intent classification system distinguishing condition statements from requirement questions; a constrained AI analyst with explicit hierarchy rules, query interpretation guidelines, and anti-hallucination guardrails; and a robust response parser with null handling and default values. The system addresses technical challenges of regulatory document processing, accurate retrieval, correct user intent interpretation, and reliable AI response handling.

---

## DRAWINGS

The patent application should include the following figures:

1. **Figure 1**: Complete System Architecture
2. **Figure 2**: Document Ingestion Pipeline
3. **Figure 3**: Hybrid Search Scoring Algorithm
4. **Figure 4**: Three-Tier Evidence Hierarchy
5. **Figure 5**: Query Intent Classification
6. **Figure 6**: Response Parser with Default Handling
7. **Figure 7**: Database Schema Diagram
8. **Figure 8**: End-to-End Process Flow
9. **Figure 9**: User Interface Display

---

## PRIOR ART DIFFERENTIATION

| Prior Art Category | Limitation | SUPER RAG Innovation |
|-------------------|------------|---------------------|
| PDF extraction tools | No semantic embedding | Embedding + section extraction |
| Keyword search | No semantic understanding | Hybrid vector + keyword |
| Vector-only RAG | Misses exact terminology | Weighted keyword boost |
| Standard RAG | Equal treatment of sources | Three-tier hierarchy |
| Document Q&A | No query intent classification | Condition vs requirement |
| AI chatbots | No response validation | Robust null handling |
| Rule engines | Manual encoding required | AI-powered interpretation |

---

## TECHNICAL ADVANTAGES

1. **Complete Pipeline**: End-to-end from PDF ingestion to compliance determination
2. **Section Awareness**: Automatic extraction of regulatory section numbers and titles
3. **Dual Data Types**: Separate handling of narrative text and structured tables
4. **Hybrid Search**: Best of semantic and keyword matching
5. **Evidence Hierarchy**: Mirrors expert human reasoning
6. **Intent Understanding**: Correctly interprets conditions vs. requirements
7. **Robustness**: Graceful handling of AI edge cases
8. **Auditability**: Full citation and reasoning chain
9. **Scalability**: Vector indexing enables sub-second search on large corpora

---

**Document Classification:** Confidential - Patent Application Materials
**Prepared by:** Quantra Engineering Team
**Review Required:** Patent Counsel
**Date:** December 2024
