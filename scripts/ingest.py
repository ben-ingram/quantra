#!/usr/bin/env python3
"""
Quantra - SUPER RAG Building Code Ingestion Pipeline

This script ingests PDF building codes into a Supabase Vector Database
with support for hybrid search (semantic + keyword) and structured tables.

Usage:
    python ingest.py sample_code.pdf
    python ingest.py --file path/to/code.pdf --jurisdiction "Florida" --code-name "FBC" --code-version "2023"

Requirements:
    - Supabase project with pgvector extension enabled
    - OpenAI API key for embeddings
    - See requirements.txt for Python dependencies
"""

import os
import sys
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pathlib import Path

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from supabase import create_client, Client

# Load environment variables from .env file (check both script dir and parent)
script_dir = Path(__file__).parent
load_dotenv(script_dir / ".env")
load_dotenv(script_dir.parent / ".env")

# =============================================================================
# Configuration
# =============================================================================

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# OpenAI configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Vector store configuration - SUPER RAG uses code_sections table
CODE_SECTIONS_TABLE = "code_sections"
CODE_TABLES_TABLE = "code_tables"
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536

# Chunking configuration optimized for building codes
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

# Building code specific separators
CODE_SEPARATORS = [
    "\n\n\n",
    "\n\n",
    "\nSection ",
    "\nCHAPTER ",
    "\nARTICLE ",
    "\n§ ",
    "\n",
    ". ",
    "; ",
    ", ",
    " ",
]


# =============================================================================
# Validation
# =============================================================================

def validate_environment() -> None:
    """Validate that all required environment variables are set."""
    missing = []

    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_SERVICE_KEY:
        missing.append("SUPABASE_SERVICE_KEY")
    if not OPENAI_API_KEY:
        missing.append("OPENAI_API_KEY")

    if missing:
        print("❌ Missing required environment variables:")
        for var in missing:
            print(f"   - {var}")
        print("\nPlease set these in your .env file.")
        sys.exit(1)


# =============================================================================
# Database Setup
# =============================================================================

def get_supabase_client() -> Client:
    """Create and return a Supabase client."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def setup_vector_table(client: Client) -> None:
    """Ensure the code_sections table exists."""
    try:
        client.table(CODE_SECTIONS_TABLE).select("id").limit(1).execute()
        print(f"✓ Table '{CODE_SECTIONS_TABLE}' exists")
    except Exception as e:
        print(f"❌ Table '{CODE_SECTIONS_TABLE}' does not exist.")
        print("\nPlease run the Phase 1 SQL in your Supabase SQL Editor first.")
        print("See the SUPER RAG setup instructions.")
        sys.exit(1)


# =============================================================================
# Section Title Extraction
# =============================================================================

def extract_section_info(text: str) -> Dict[str, Optional[str]]:
    """
    Extract section number and title from text.

    Returns dict with 'section_number' and 'section_title'.
    """
    result = {"section_number": None, "section_title": None}

    # Common patterns for section headers in building codes
    patterns = [
        # Pattern: "1011.5.2 Handrails" or "1011.5.2. Handrails"
        r"^(\d{3,4}(?:\.\d+)*)\s*\.?\s+([A-Z][A-Za-z\s\-]+?)(?:\.|$|\n)",
        # Pattern: "Section 1011.5 - Stairway Construction"
        r"^Section\s+(\d+(?:\.\d+)*)\s*[-–—]\s*([A-Za-z\s\-]+?)(?:\.|$|\n)",
        # Pattern: "§ 1011.5 Stairway Construction"
        r"^§\s*(\d+(?:\.\d+)*)\s+([A-Za-z\s\-]+?)(?:\.|$|\n)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text.strip(), re.MULTILINE)
        if match:
            result["section_number"] = match.group(1)
            result["section_title"] = match.group(2).strip()
            return result

    # Fallback: just try to get section number
    simple_patterns = [
        r"^(\d{3,4}\.\d+(?:\.\d+)?)",
        r"^Section\s+(\d+(?:\.\d+)*)",
        r"^§\s*(\d+(?:\.\d+)*)",
    ]

    for pattern in simple_patterns:
        match = re.search(pattern, text.strip(), re.IGNORECASE)
        if match:
            result["section_number"] = match.group(1)
            return result

    return result


# =============================================================================
# Document Processing
# =============================================================================

def load_pdf(file_path: str) -> List[Document]:
    """Load a PDF file and return a list of documents (one per page)."""
    print(f"📄 Loading PDF: {file_path}")

    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        sys.exit(1)

    loader = PyPDFLoader(file_path)
    documents = loader.load()

    print(f"   ✓ Loaded {len(documents)} pages")
    return documents


def create_text_splitter() -> RecursiveCharacterTextSplitter:
    """Create a text splitter optimized for building codes."""
    return RecursiveCharacterTextSplitter(
        separators=CODE_SEPARATORS,
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len,
        is_separator_regex=False,
        keep_separator=True,
    )


def split_documents(
    documents: List[Document],
    jurisdiction: str,
    code_name: str,
    code_version: str,
    source_file: str,
) -> List[Document]:
    """Split documents into chunks and enrich metadata."""
    print("✂️  Splitting documents into chunks...")

    splitter = create_text_splitter()

    # Calculate document hash for deduplication
    full_text = "".join(doc.page_content for doc in documents)
    document_hash = hashlib.sha256(full_text.encode()).hexdigest()[:16]

    all_chunks: List[Document] = []
    chunk_index = 0

    for doc in documents:
        page_number = doc.metadata.get("page", 0) + 1

        chunks = splitter.split_text(doc.page_content)

        for chunk_text in chunks:
            if not chunk_text.strip():
                continue

            # Extract section info
            section_info = extract_section_info(chunk_text)

            # Create enriched metadata
            metadata = {
                "source": source_file,
                "page_number": page_number,
                "chunk_index": chunk_index,
                "jurisdiction": jurisdiction,
                "code_name": code_name,
                "code_version": code_version,
                "section_number": section_info["section_number"],
                "section_title": section_info["section_title"],
                "document_hash": document_hash,
                "ingested_at": datetime.now(timezone.utc).isoformat(),
                "char_count": len(chunk_text),
            }

            all_chunks.append(Document(
                page_content=chunk_text,
                metadata=metadata,
            ))

            chunk_index += 1

    print(f"   ✓ Created {len(all_chunks)} chunks")
    if all_chunks:
        avg_size = sum(len(c.page_content) for c in all_chunks) // len(all_chunks)
        print(f"   ✓ Average chunk size: {avg_size} chars")

    return all_chunks


# =============================================================================
# Embedding & Storage
# =============================================================================

def create_embeddings(chunks: List[Document]) -> List[List[float]]:
    """Generate embeddings for all chunks using OpenAI."""
    print("🧠 Generating embeddings...")

    embeddings_model = OpenAIEmbeddings(
        model=EMBEDDING_MODEL,
        openai_api_key=OPENAI_API_KEY,
    )

    texts = [chunk.page_content for chunk in chunks]

    batch_size = 100
    all_embeddings: List[List[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        batch_embeddings = embeddings_model.embed_documents(batch)
        all_embeddings.extend(batch_embeddings)

        progress = min(i + batch_size, len(texts))
        print(f"   ✓ Embedded {progress}/{len(texts)} chunks")

    return all_embeddings


def store_in_supabase(
    client: Client,
    chunks: List[Document],
    embeddings: List[List[float]],
    delete_existing: bool = False,
    document_hash: Optional[str] = None,
) -> int:
    """Store chunks and embeddings in Supabase code_sections table."""
    print("💾 Storing in Supabase (code_sections)...")

    # Optionally delete existing documents with same hash
    if delete_existing and document_hash:
        print(f"   ⚠ Deleting existing chunks with hash: {document_hash}")
        client.table(CODE_SECTIONS_TABLE).delete().eq("document_hash", document_hash).execute()

    # Prepare records for SUPER RAG schema
    records = []
    for chunk, embedding in zip(chunks, embeddings):
        meta = chunk.metadata

        # Build the metadata JSONB (extra fields not in columns)
        metadata_json = {
            "source": meta.get("source"),
            "ingested_at": meta.get("ingested_at"),
            "char_count": meta.get("char_count"),
        }

        record = {
            # Content and embedding
            "content": chunk.page_content,
            "embedding": embedding,
            "metadata": metadata_json,

            # Denormalized columns for filtering and FTS
            "jurisdiction": meta.get("jurisdiction"),
            "code_name": meta.get("code_name"),
            "code_version": meta.get("code_version"),
            "section_number": meta.get("section_number"),
            "section_title": meta.get("section_title"),
            "page_number": meta.get("page_number"),
            "chunk_index": meta.get("chunk_index"),
            "document_hash": meta.get("document_hash"),
        }
        records.append(record)

    # Insert in batches
    batch_size = 100
    total_inserted = 0

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        try:
            client.table(CODE_SECTIONS_TABLE).insert(batch).execute()
            total_inserted += len(batch)
            print(f"   ✓ Inserted {total_inserted}/{len(records)} records")
        except Exception as e:
            print(f"   ❌ Error inserting batch: {e}")
            raise

    return total_inserted


# =============================================================================
# Table Ingestion (for structured data)
# =============================================================================

def ingest_table(
    client: Client,
    table_id: str,
    table_title: str,
    summary: str,
    data: Dict[str, Any],
    jurisdiction: str = "Unknown",
    code_name: str = "Unknown",
    code_version: str = "Unknown",
    section_reference: Optional[str] = None,
    page_number: Optional[int] = None,
) -> bool:
    """
    Ingest a structured table into the code_tables table.

    This is for complex tables like occupancy load factors,
    egress width calculations, etc.

    Args:
        client: Supabase client
        table_id: Unique ID like "Table 1004.5"
        table_title: Human-readable title
        summary: Description of what the table contains (used for semantic search)
        data: The actual table data as JSON
        jurisdiction: Code jurisdiction
        code_name: Name of the building code
        code_version: Version/year
        section_reference: Which code section references this table
        page_number: Page number in source document

    Returns:
        True if successful
    """
    print(f"📊 Ingesting table: {table_id}")

    # Generate embedding for the summary
    embeddings_model = OpenAIEmbeddings(
        model=EMBEDDING_MODEL,
        openai_api_key=OPENAI_API_KEY,
    )
    summary_embedding = embeddings_model.embed_query(summary)

    # Build record
    record = {
        "table_id": table_id,
        "table_title": table_title,
        "summary": summary,
        "summary_embedding": summary_embedding,
        "data": data,
        "metadata": {
            "ingested_at": datetime.now(timezone.utc).isoformat(),
        },
        "jurisdiction": jurisdiction,
        "code_name": code_name,
        "code_version": code_version,
        "section_reference": section_reference,
        "page_number": page_number,
    }

    try:
        # Upsert (update if exists, insert if not)
        client.table(CODE_TABLES_TABLE).upsert(record, on_conflict="table_id").execute()
        print(f"   ✓ Table '{table_id}' ingested successfully")
        return True
    except Exception as e:
        print(f"   ❌ Error ingesting table: {e}")
        return False


def ingest_sample_tables(client: Client, jurisdiction: str, code_name: str, code_version: str) -> int:
    """
    Ingest sample structured tables for demonstration.

    In production, you'd extract these from PDFs or enter manually.
    """
    print("\n📊 Ingesting sample structured tables...")

    tables = [
        {
            "table_id": "Table 1004.5",
            "table_title": "Maximum Floor Area Allowances Per Occupant",
            "summary": "Occupancy load factors for calculating maximum floor area per occupant. Used to determine egress requirements based on building use and function. Covers assembly, business, educational, factory, institutional, mercantile, residential, and storage occupancies.",
            "section_reference": "1004.5",
            "data": {
                "description": "Maximum Floor Area Allowances Per Occupant",
                "unit": "square feet per occupant",
                "occupancies": {
                    "Assembly": {
                        "Concentrated (chairs only, not fixed)": 7,
                        "Standing space": 5,
                        "Unconcentrated (tables and chairs)": 15,
                        "Bowling centers, allow 5 persons for each lane": 50,
                        "Gaming floors (keno, slots, etc.)": 11
                    },
                    "Business": {
                        "General": 150,
                        "Concentrated business use areas": 50
                    },
                    "Educational": {
                        "Classroom area": 20,
                        "Shops and other vocational room areas": 50
                    },
                    "Exercise rooms": 50,
                    "Industrial": {
                        "General": 100
                    },
                    "Institutional": {
                        "Inpatient treatment areas": 240,
                        "Outpatient areas": 100,
                        "Sleeping areas": 120
                    },
                    "Mercantile": {
                        "Basement and grade floor areas": 30,
                        "Areas on other floors": 60,
                        "Storage, stock, shipping areas": 300
                    },
                    "Residential": 200,
                    "Storage": {
                        "General": 300
                    }
                }
            }
        },
        {
            "table_id": "Table 1011.5.2",
            "table_title": "Stairway Riser Height and Tread Depth",
            "summary": "Dimensional requirements for stairway risers and treads. Specifies minimum and maximum dimensions for riser height and tread depth in different stairway types including general stairways, spiral stairways, and aisle stairs.",
            "section_reference": "1011.5.2",
            "data": {
                "description": "Stair Riser Heights and Tread Depths",
                "stairway_types": {
                    "General Stairways": {
                        "riser_height": {
                            "minimum_inches": 4,
                            "maximum_inches": 7
                        },
                        "tread_depth": {
                            "minimum_inches": 11
                        }
                    },
                    "Spiral Stairways (Section 1011.10)": {
                        "riser_height": {
                            "maximum_inches": 9.5
                        },
                        "tread_depth": {
                            "minimum_at_12_inches_from_narrow_edge": 7.5
                        },
                        "clear_width_minimum_inches": 26,
                        "headroom_minimum_inches": 78
                    },
                    "Aisle Stairs": {
                        "riser_height": {
                            "minimum_inches": 4,
                            "maximum_inches": 8
                        },
                        "tread_depth": {
                            "minimum_inches": 11
                        }
                    }
                }
            }
        },
        {
            "table_id": "Table 1006.2.1",
            "table_title": "Egress Width Per Occupant Served",
            "summary": "Required egress width in inches per occupant for stairways and other egress components. Differentiates between sprinklered and non-sprinklered buildings. Used to calculate minimum width of exits based on occupant load.",
            "section_reference": "1006.2.1",
            "data": {
                "description": "Egress Width Per Occupant Served",
                "unit": "inches per occupant",
                "components": {
                    "Stairways": {
                        "with_sprinkler_system": 0.2,
                        "without_sprinkler_system": 0.3
                    },
                    "Other egress components": {
                        "with_sprinkler_system": 0.15,
                        "without_sprinkler_system": 0.2
                    }
                },
                "notes": [
                    "Sprinkler system must be installed throughout per Section 903.3.1.1 or 903.3.1.2",
                    "Minimum width requirements in other sections still apply"
                ]
            }
        }
    ]

    success_count = 0
    for table in tables:
        if ingest_table(
            client=client,
            table_id=table["table_id"],
            table_title=table["table_title"],
            summary=table["summary"],
            data=table["data"],
            jurisdiction=jurisdiction,
            code_name=code_name,
            code_version=code_version,
            section_reference=table.get("section_reference"),
        ):
            success_count += 1

    print(f"   ✓ Ingested {success_count}/{len(tables)} tables")
    return success_count


# =============================================================================
# Main Pipeline
# =============================================================================

def ingest_pdf(
    file_path: str,
    jurisdiction: str = "Unknown",
    code_name: str = "Unknown",
    code_version: str = "Unknown",
    replace_existing: bool = False,
    include_sample_tables: bool = True,
) -> Dict[str, Any]:
    """
    Main ingestion pipeline for SUPER RAG.
    """
    start_time = datetime.now()

    print("\n" + "=" * 60)
    print("🏗️  QUANTRA - SUPER RAG Ingestion Pipeline")
    print("=" * 60)
    print(f"\n📋 Configuration:")
    print(f"   File: {file_path}")
    print(f"   Jurisdiction: {jurisdiction}")
    print(f"   Code: {code_name} ({code_version})")
    print(f"   Chunk size: {CHUNK_SIZE} chars")
    print(f"   Overlap: {CHUNK_OVERLAP} chars")
    print(f"   Embedding model: {EMBEDDING_MODEL}")
    print(f"   Target table: {CODE_SECTIONS_TABLE}")
    print()

    validate_environment()

    client = get_supabase_client()
    setup_vector_table(client)

    # Load and process PDF
    documents = load_pdf(file_path)
    chunks = split_documents(
        documents=documents,
        jurisdiction=jurisdiction,
        code_name=code_name,
        code_version=code_version,
        source_file=os.path.basename(file_path),
    )

    if not chunks:
        print("❌ No chunks created. The PDF may be empty or unreadable.")
        sys.exit(1)

    document_hash = chunks[0].metadata.get("document_hash")

    # Generate embeddings and store
    embeddings = create_embeddings(chunks)
    inserted_count = store_in_supabase(
        client=client,
        chunks=chunks,
        embeddings=embeddings,
        delete_existing=replace_existing,
        document_hash=document_hash,
    )

    # Optionally ingest sample tables
    tables_ingested = 0
    if include_sample_tables:
        tables_ingested = ingest_sample_tables(client, jurisdiction, code_name, code_version)

    # Calculate stats
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    stats = {
        "file": file_path,
        "pages": len(documents),
        "chunks": len(chunks),
        "inserted": inserted_count,
        "tables_ingested": tables_ingested,
        "duration_seconds": round(duration, 2),
        "document_hash": document_hash,
    }

    print("\n" + "=" * 60)
    print("✅ SUPER RAG INGESTION COMPLETE")
    print("=" * 60)
    print(f"\n📊 Statistics:")
    print(f"   Pages processed: {stats['pages']}")
    print(f"   Text chunks created: {stats['chunks']}")
    print(f"   Records inserted: {stats['inserted']}")
    print(f"   Tables ingested: {stats['tables_ingested']}")
    print(f"   Duration: {stats['duration_seconds']}s")
    print(f"   Document hash: {stats['document_hash']}")
    print()

    return stats


# =============================================================================
# CLI Interface
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Ingest building code PDFs into Supabase for SUPER RAG",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python ingest.py sample_code.pdf
  python ingest.py --file florida_building_code.pdf -j "Florida" -n "FBC" -v "2023"
  python ingest.py codes/fbc_section10.pdf -j "Florida" -n "Florida Building Code" -v "8th Edition (2023)" --replace
  python ingest.py --tables-only -j "Florida" -n "FBC" -v "2023"
        """,
    )

    parser.add_argument(
        "file",
        nargs="?",
        default="sample_code.pdf",
        help="Path to the PDF file (default: sample_code.pdf)",
    )

    parser.add_argument(
        "-f", "--file",
        dest="file_override",
        help="Path to the PDF file (alternative to positional argument)",
    )

    parser.add_argument(
        "-j", "--jurisdiction",
        default="Florida",
        help="Jurisdiction (default: Florida)",
    )

    parser.add_argument(
        "-n", "--code-name",
        default="Florida Building Code",
        help="Code name (default: Florida Building Code)",
    )

    parser.add_argument(
        "-v", "--code-version",
        default="8th Edition (2023)",
        help="Code version/year (default: 8th Edition (2023))",
    )

    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace existing chunks from the same document",
    )

    parser.add_argument(
        "--no-tables",
        action="store_true",
        help="Skip ingesting sample structured tables",
    )

    parser.add_argument(
        "--tables-only",
        action="store_true",
        help="Only ingest sample tables (no PDF processing)",
    )

    args = parser.parse_args()

    # Tables-only mode
    if args.tables_only:
        validate_environment()
        client = get_supabase_client()
        print("\n" + "=" * 60)
        print("🏗️  QUANTRA - SUPER RAG Table Ingestion")
        print("=" * 60)
        ingest_sample_tables(client, args.jurisdiction, args.code_name, args.code_version)
        print("\n✅ Table ingestion complete!")
        return

    # Full ingestion
    file_path = args.file_override or args.file

    ingest_pdf(
        file_path=file_path,
        jurisdiction=args.jurisdiction,
        code_name=args.code_name,
        code_version=args.code_version,
        replace_existing=args.replace,
        include_sample_tables=not args.no_tables,
    )


if __name__ == "__main__":
    main()
