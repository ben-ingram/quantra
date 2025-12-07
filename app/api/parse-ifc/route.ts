/**
 * API Route: Parse IFC File
 *
 * Server-side IFC parsing using web-ifc with Node.js WASM support.
 * This avoids browser WASM loading issues.
 */

import { NextRequest, NextResponse } from "next/server";
import * as WebIFC from "web-ifc";

// =============================================================================
// Types (matching the client-side types)
// =============================================================================

interface IfcEntityCount {
  type: string;
  label: string;
  count: number;
  icon?: string;
}

interface IfcElementDetail {
  expressId: number;
  type: string;
  name: string | null;
  description: string | null;
  properties: Record<string, unknown>;
}

interface IfcBuildingData {
  entityCounts: IfcEntityCount[];
  buildingName: string | null;
  siteName: string | null;
  projectName: string | null;
  storeyCount: number;
  storeyNames: string[];
  doors: IfcElementDetail[];
  windows: IfcElementDetail[];
  stairs: IfcElementDetail[];
  totalElements: number;
  parsedAt: string;
  parseTimeMs: number;
}

// IFC entity type mappings
const IFC_ENTITY_TYPES: Record<number, { label: string; icon: string; category: string }> = {
  [WebIFC.IFCDOOR]: { label: "Doors", icon: "door", category: "egress" },
  [WebIFC.IFCWINDOW]: { label: "Windows", icon: "window", category: "envelope" },
  [WebIFC.IFCSTAIR]: { label: "Stairs", icon: "stairs", category: "egress" },
  [WebIFC.IFCSTAIRFLIGHT]: { label: "Stair Flights", icon: "stairs", category: "egress" },
  [WebIFC.IFCRAILING]: { label: "Railings", icon: "railing", category: "egress" },
  [WebIFC.IFCRAMP]: { label: "Ramps", icon: "ramp", category: "accessibility" },
  [WebIFC.IFCRAMPFLIGHT]: { label: "Ramp Flights", icon: "ramp", category: "accessibility" },
  [WebIFC.IFCWALL]: { label: "Walls", icon: "wall", category: "structure" },
  [WebIFC.IFCWALLSTANDARDCASE]: { label: "Standard Walls", icon: "wall", category: "structure" },
  [WebIFC.IFCSLAB]: { label: "Slabs/Floors", icon: "slab", category: "structure" },
  [WebIFC.IFCROOF]: { label: "Roofs", icon: "roof", category: "structure" },
  [WebIFC.IFCCOLUMN]: { label: "Columns", icon: "column", category: "structure" },
  [WebIFC.IFCBEAM]: { label: "Beams", icon: "beam", category: "structure" },
  [WebIFC.IFCCURTAINWALL]: { label: "Curtain Walls", icon: "curtainwall", category: "envelope" },
  [WebIFC.IFCSPACE]: { label: "Spaces/Rooms", icon: "space", category: "spatial" },
  [WebIFC.IFCBUILDINGSTOREY]: { label: "Building Storeys", icon: "storey", category: "spatial" },
  [WebIFC.IFCFIRESUPPRESSIONTERMINAL]: { label: "Fire Suppression", icon: "fire", category: "fire" },
  [WebIFC.IFCFLOWSEGMENT]: { label: "Pipe/Duct Segments", icon: "pipe", category: "mep" },
  [WebIFC.IFCFLOWTERMINAL]: { label: "MEP Terminals", icon: "terminal", category: "mep" },
  [WebIFC.IFCLIGHTFIXTURE]: { label: "Light Fixtures", icon: "light", category: "electrical" },
  [WebIFC.IFCOUTLET]: { label: "Electrical Outlets", icon: "outlet", category: "electrical" },
  [WebIFC.IFCSANITARYTERMINAL]: { label: "Plumbing Fixtures", icon: "plumbing", category: "plumbing" },
  [WebIFC.IFCFURNITURE]: { label: "Furniture", icon: "furniture", category: "furnishing" },
};

// Priority order for display
const DISPLAY_PRIORITY = [
  "Doors",
  "Stairs",
  "Stair Flights",
  "Ramps",
  "Windows",
  "Fire Suppression",
  "Building Storeys",
  "Spaces/Rooms",
  "Railings",
  "Walls",
  "Standard Walls",
  "Columns",
  "Beams",
  "Slabs/Floors",
];

// =============================================================================
// IFC API Instance (reused across requests)
// =============================================================================

let ifcApiInstance: WebIFC.IfcAPI | null = null;

async function getIfcApi(): Promise<WebIFC.IfcAPI> {
  if (ifcApiInstance) return ifcApiInstance;

  // web-ifc has a hardcoded path issue in Turbopack builds
  // Ensure the WASM file exists at the expected location
  const fs = await import("fs");
  const path = await import("path");

  const expectedDir = "C:\\ROOT\\node_modules\\web-ifc";
  const expectedWasm = path.join(expectedDir, "web-ifc-node.wasm");
  const sourceWasm = path.join(process.cwd(), "node_modules", "web-ifc", "web-ifc-node.wasm");

  // Create directory and copy WASM if needed
  if (!fs.existsSync(expectedWasm)) {
    console.log("[IFC API] Copying WASM to expected location:", expectedDir);
    fs.mkdirSync(expectedDir, { recursive: true });
    fs.copyFileSync(sourceWasm, expectedWasm);
  }

  const ifcApi = new WebIFC.IfcAPI();
  await ifcApi.Init();

  ifcApiInstance = ifcApi;
  return ifcApi;
}

// =============================================================================
// Parsing Functions
// =============================================================================

function extractProjectInfo(
  ifcApi: WebIFC.IfcAPI,
  modelId: number
): { projectName: string | null; buildingName: string | null; siteName: string | null } {
  let projectName: string | null = null;
  let buildingName: string | null = null;
  let siteName: string | null = null;

  try {
    const projectIds = ifcApi.GetLineIDsWithType(modelId, WebIFC.IFCPROJECT);
    if (projectIds.size() > 0) {
      const project = ifcApi.GetLine(modelId, projectIds.get(0));
      projectName = project.Name?.value || project.LongName?.value || null;
    }

    const buildingIds = ifcApi.GetLineIDsWithType(modelId, WebIFC.IFCBUILDING);
    if (buildingIds.size() > 0) {
      const building = ifcApi.GetLine(modelId, buildingIds.get(0));
      buildingName = building.Name?.value || building.LongName?.value || null;
    }

    const siteIds = ifcApi.GetLineIDsWithType(modelId, WebIFC.IFCSITE);
    if (siteIds.size() > 0) {
      const site = ifcApi.GetLine(modelId, siteIds.get(0));
      siteName = site.Name?.value || site.LongName?.value || null;
    }
  } catch (e) {
    console.warn("[IFC API] Error extracting project info:", e);
  }

  return { projectName, buildingName, siteName };
}

function extractStoreyInfo(
  ifcApi: WebIFC.IfcAPI,
  modelId: number
): { count: number; names: string[] } {
  const names: string[] = [];

  try {
    const storeyIds = ifcApi.GetLineIDsWithType(modelId, WebIFC.IFCBUILDINGSTOREY);
    const count = storeyIds.size();

    for (let i = 0; i < count; i++) {
      const storey = ifcApi.GetLine(modelId, storeyIds.get(i));
      const name = storey.Name?.value || storey.LongName?.value || `Level ${i + 1}`;
      names.push(name);
    }

    names.sort();
    return { count, names };
  } catch (e) {
    console.warn("[IFC API] Error extracting storey info:", e);
    return { count: 0, names: [] };
  }
}

function extractElementDetails(
  ifcApi: WebIFC.IfcAPI,
  modelId: number,
  typeId: number
): IfcElementDetail[] {
  const elements: IfcElementDetail[] = [];

  try {
    const ids = ifcApi.GetLineIDsWithType(modelId, typeId);
    const count = Math.min(ids.size(), 100); // Limit for performance

    for (let i = 0; i < count; i++) {
      const expressId = ids.get(i);
      const element = ifcApi.GetLine(modelId, expressId);

      elements.push({
        expressId,
        type: element.constructor?.name || "Unknown",
        name: element.Name?.value || null,
        description: element.Description?.value || null,
        properties: extractBasicProperties(element),
      });
    }
  } catch (e) {
    console.warn("[IFC API] Error extracting element details:", e);
  }

  return elements;
}

function extractBasicProperties(element: unknown): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const el = element as Record<string, unknown>;

  const interestingProps = [
    "OverallHeight",
    "OverallWidth",
    "OverallDepth",
    "NumberOfRisers",
    "NumberOfTreads",
    "RiserHeight",
    "TreadLength",
    "FireRating",
    "IsExternal",
    "LoadBearing",
  ];

  for (const prop of interestingProps) {
    if (el[prop] !== undefined) {
      const value = el[prop];
      if (typeof value === "object" && value !== null && "value" in value) {
        props[prop] = (value as { value: unknown }).value;
      } else {
        props[prop] = value;
      }
    }
  }

  return props;
}

async function parseIfcData(fileData: ArrayBuffer): Promise<IfcBuildingData> {
  const startTime = performance.now();

  const ifcApi = await getIfcApi();
  const modelId = ifcApi.OpenModel(new Uint8Array(fileData));

  try {
    // Get entity counts
    const entityCounts: IfcEntityCount[] = [];
    let totalElements = 0;

    for (const [typeId, config] of Object.entries(IFC_ENTITY_TYPES)) {
      const typeIdNum = parseInt(typeId);
      const ids = ifcApi.GetLineIDsWithType(modelId, typeIdNum);
      const count = ids.size();

      if (count > 0) {
        entityCounts.push({
          type: typeIdNum.toString(),
          label: config.label,
          count,
          icon: config.icon,
        });
        totalElements += count;
      }
    }

    // Sort by display priority
    entityCounts.sort((a, b) => {
      const aIdx = DISPLAY_PRIORITY.indexOf(a.label);
      const bIdx = DISPLAY_PRIORITY.indexOf(b.label);
      if (aIdx === -1 && bIdx === -1) return b.count - a.count;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });

    // Get building info
    const projectInfo = extractProjectInfo(ifcApi, modelId);
    const storeyInfo = extractStoreyInfo(ifcApi, modelId);

    // Get detailed element info
    const doors = extractElementDetails(ifcApi, modelId, WebIFC.IFCDOOR);
    const windows = extractElementDetails(ifcApi, modelId, WebIFC.IFCWINDOW);
    const stairs = extractElementDetails(ifcApi, modelId, WebIFC.IFCSTAIR);

    const parseTimeMs = performance.now() - startTime;

    return {
      entityCounts,
      buildingName: projectInfo.buildingName,
      siteName: projectInfo.siteName,
      projectName: projectInfo.projectName,
      storeyCount: storeyInfo.count,
      storeyNames: storeyInfo.names,
      doors,
      windows,
      stairs,
      totalElements,
      parsedAt: new Date().toISOString(),
      parseTimeMs,
    };
  } finally {
    ifcApi.CloseModel(modelId);
  }
}

// =============================================================================
// API Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let fileData: ArrayBuffer;

    if (contentType.includes("multipart/form-data")) {
      // Handle FormData upload
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      fileData = await file.arrayBuffer();
    } else {
      // Handle raw binary upload
      fileData = await request.arrayBuffer();
    }

    if (fileData.byteLength === 0) {
      return NextResponse.json(
        { error: "Empty file provided" },
        { status: 400 }
      );
    }

    console.log(`[IFC API] Parsing file of size ${fileData.byteLength} bytes`);

    const result = await parseIfcData(fileData);

    console.log(`[IFC API] Parsed ${result.totalElements} elements in ${result.parseTimeMs.toFixed(0)}ms`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[IFC API] Parse error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse IFC file" },
      { status: 500 }
    );
  }
}

// Increase body size limit for this route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};
