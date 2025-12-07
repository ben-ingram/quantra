#!/usr/bin/env python3
"""
Quantra - Batch FBC Ingestion Script

Ingests all Florida Building Code PDFs from the PDF folder into Supabase.

Usage:
    python ingest_all.py                    # Ingest all PDFs
    python ingest_all.py --dry-run          # Show what would be ingested
    python ingest_all.py --replace          # Replace existing chunks
    python ingest_all.py --chapter 10       # Ingest only Chapter 10
"""

import os
import sys
import argparse
import re
from pathlib import Path
from typing import List, Tuple

# Import from existing ingest.py
from ingest import ingest_pdf, validate_environment, get_supabase_client

# =============================================================================
# Configuration
# =============================================================================

PDF_FOLDER = Path(__file__).parent / "PDF"
JURISDICTION = "Florida"
CODE_NAME = "Florida Building Code"
CODE_VERSION = "8th Edition (2023)"

# =============================================================================
# PDF Discovery
# =============================================================================

def get_chapter_number(filename: str) -> Tuple[int, str]:
    """
    Extract chapter number and type from filename.
    Returns (sort_order, chapter_type) where chapter_type is 'chapter' or 'appendix'.
    """
    # Match "Chapter X" pattern
    chapter_match = re.search(r'Chapter\s+(\d+)', filename)
    if chapter_match:
        return (int(chapter_match.group(1)), 'chapter')

    # Match "Appendix X" pattern
    appendix_match = re.search(r'Appendix\s+([A-Z])', filename)
    if appendix_match:
        # Appendices come after chapters (100+)
        return (100 + ord(appendix_match.group(1)) - ord('A'), 'appendix')

    # Unknown - put at end
    return (999, 'unknown')


def discover_pdfs(folder: Path, chapter_filter: int = None) -> List[Path]:
    """
    Discover all PDF files in the folder, sorted by chapter number.
    """
    if not folder.exists():
        print(f"❌ PDF folder not found: {folder}")
        sys.exit(1)

    pdf_files = list(folder.glob("*.pdf"))

    if not pdf_files:
        print(f"❌ No PDF files found in: {folder}")
        sys.exit(1)

    # Sort by chapter number
    pdf_files.sort(key=lambda p: get_chapter_number(p.name))

    # Filter by chapter if specified
    if chapter_filter is not None:
        pdf_files = [
            p for p in pdf_files
            if get_chapter_number(p.name) == (chapter_filter, 'chapter')
        ]

    return pdf_files


def get_pdf_display_name(path: Path) -> str:
    """Get a clean display name for the PDF."""
    name = path.stem
    # Truncate long names
    if len(name) > 60:
        name = name[:57] + "..."
    return name


# =============================================================================
# Batch Ingestion
# =============================================================================

def ingest_all_pdfs(
    folder: Path,
    replace_existing: bool = False,
    dry_run: bool = False,
    chapter_filter: int = None,
    skip_tables: bool = False,
) -> dict:
    """
    Ingest all PDFs from the folder.
    """
    pdf_files = discover_pdfs(folder, chapter_filter)

    print("\n" + "=" * 70)
    print("🏗️  QUANTRA - BATCH FBC INGESTION")
    print("=" * 70)
    print(f"\n📁 Source folder: {folder}")
    print(f"📚 PDFs found: {len(pdf_files)}")
    print(f"🔄 Replace existing: {replace_existing}")
    print(f"📊 Include tables: {not skip_tables}")
    print()

    if dry_run:
        print("🔍 DRY RUN - No changes will be made\n")
        print("Files to be ingested:")
        for i, pdf in enumerate(pdf_files, 1):
            chapter_num, chapter_type = get_chapter_number(pdf.name)
            print(f"  {i:2}. [{chapter_type.upper():8}] {get_pdf_display_name(pdf)}")
        print(f"\nTotal: {len(pdf_files)} files")
        return {"dry_run": True, "files": len(pdf_files)}

    # Validate environment before starting
    validate_environment()

    results = {
        "total": len(pdf_files),
        "success": 0,
        "failed": 0,
        "total_chunks": 0,
        "total_pages": 0,
        "errors": [],
    }

    for i, pdf_path in enumerate(pdf_files, 1):
        chapter_num, chapter_type = get_chapter_number(pdf_path.name)
        display_name = get_pdf_display_name(pdf_path)

        print(f"\n{'='*70}")
        print(f"📄 [{i}/{len(pdf_files)}] {display_name}")
        print(f"{'='*70}")

        try:
            stats = ingest_pdf(
                file_path=str(pdf_path),
                jurisdiction=JURISDICTION,
                code_name=CODE_NAME,
                code_version=CODE_VERSION,
                replace_existing=replace_existing,
                # Only include sample tables for the first PDF to avoid duplicates
                include_sample_tables=(i == 1 and not skip_tables),
            )

            results["success"] += 1
            results["total_chunks"] += stats.get("chunks", 0)
            results["total_pages"] += stats.get("pages", 0)

        except Exception as e:
            print(f"❌ Error processing {pdf_path.name}: {e}")
            results["failed"] += 1
            results["errors"].append({
                "file": pdf_path.name,
                "error": str(e),
            })

    # Print summary
    print("\n" + "=" * 70)
    print("✅ BATCH INGESTION COMPLETE")
    print("=" * 70)
    print(f"\n📊 Summary:")
    print(f"   Total files: {results['total']}")
    print(f"   Successful: {results['success']}")
    print(f"   Failed: {results['failed']}")
    print(f"   Total pages: {results['total_pages']}")
    print(f"   Total chunks: {results['total_chunks']}")

    if results["errors"]:
        print(f"\n⚠️  Errors:")
        for err in results["errors"]:
            print(f"   - {err['file']}: {err['error']}")

    print()
    return results


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Batch ingest all FBC PDFs into Supabase",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be ingested without making changes",
    )

    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace existing chunks from the same documents",
    )

    parser.add_argument(
        "--chapter",
        type=int,
        help="Only ingest a specific chapter number (e.g., --chapter 10)",
    )

    parser.add_argument(
        "--skip-tables",
        action="store_true",
        help="Skip ingesting sample structured tables",
    )

    parser.add_argument(
        "--folder",
        type=str,
        default=str(PDF_FOLDER),
        help=f"PDF folder path (default: {PDF_FOLDER})",
    )

    args = parser.parse_args()

    folder = Path(args.folder)

    ingest_all_pdfs(
        folder=folder,
        replace_existing=args.replace,
        dry_run=args.dry_run,
        chapter_filter=args.chapter,
        skip_tables=args.skip_tables,
    )


if __name__ == "__main__":
    main()
