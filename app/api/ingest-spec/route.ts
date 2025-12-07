import { NextRequest, NextResponse } from "next/server";
import { ingestProjectSpecsFromBuffer } from "@/app/actions/spec-ingestion";

// Use Node.js runtime for buffer handling
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "No project ID provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { success: false, error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[IngestSpec API] Processing PDF: ${file.name}, size: ${buffer.length} bytes`);

    // Use the server action to ingest the PDF
    const result = await ingestProjectSpecsFromBuffer(projectId, buffer, file.name);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.errors.join(", ") || "PDF ingestion failed",
          errors: result.errors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully extracted ${result.totalSpecsInserted} specifications from ${result.totalChunks} CSI sections`,
      specsExtracted: result.totalSpecsExtracted,
      specsInserted: result.totalSpecsInserted,
      totalChunks: result.totalChunks,
      errors: result.errors,
    });
  } catch (error) {
    console.error("[IngestSpec API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
