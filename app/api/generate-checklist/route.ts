import { NextRequest, NextResponse } from "next/server";
import { openai, MODELS } from "@/app/lib/openai";
import { getServiceClient } from "@/app/lib/supabase";
import { retrieveComplianceData, type RAGProjectContext } from "@/app/actions/retrieveComplianceData";

// =============================================================================
// Types
// =============================================================================

interface GenerateChecklistRequest {
  projectId: string;
  projectDescription: string;
  checklistTitle?: string;
  focusAreas?: string[];
  occupancyGroup?: string;
  constructionType?: string;
  state?: string; // For multi-state support
  libraryId?: string; // Direct library reference
}

// Extended project data from intake form
interface ProjectIntakeData {
  occupancy_subtype?: string | null;
  mixed_occupancies?: string[] | null;
  occupant_load?: number | null;
  number_of_stories?: number | null;
  building_height_ft?: number | null;
  total_area_sqft?: number | null;
  is_sprinklered?: boolean | null;
  fire_alarm_type?: string | null;
  florida_county?: string | null;
  flood_zone?: string | null;
  wind_speed_mph?: number | null;
  is_coastal_construction?: boolean | null;
  is_high_rise?: boolean | null;
  has_assembly_areas?: boolean | null;
  has_hazardous_materials?: boolean | null;
  has_high_piled_storage?: boolean | null;
  special_features?: string[] | null;
  project_phase?: string | null;
}

interface GeneratedChecklistItem {
  requirement: string;
  codeReference: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  category: string;
}

// Parameter extraction types for measurable code requirements
interface ExtractedParameter {
  parameter: string; // e.g., "Riser Height"
  codeLimit: number | { min?: number; max?: number }; // Numeric limit or range
  operator: "less_than" | "less_than_or_equal" | "greater_than" | "greater_than_or_equal" | "equal" | "between";
  unit: string; // e.g., "inches", "feet", "percent"
  citation: string; // e.g., "FBC 1011.5.2"
  context?: string; // Additional context about when this applies
}

interface ParameterExtractionResult {
  parameters: ExtractedParameter[];
}

// =============================================================================
// Project Intake Context Builder
// =============================================================================

function buildProjectIntakeContext(intake: ProjectIntakeData): string {
  const sections: string[] = [];

  // Occupancy Details
  const occupancyDetails: string[] = [];
  if (intake.occupancy_subtype) {
    occupancyDetails.push(`Occupancy Subtype: ${intake.occupancy_subtype}`);
  }
  if (intake.mixed_occupancies?.length) {
    occupancyDetails.push(`Mixed Occupancies: ${intake.mixed_occupancies.join(", ")}`);
  }
  if (intake.occupant_load) {
    occupancyDetails.push(`Occupant Load: ${intake.occupant_load} persons`);
  }
  if (occupancyDetails.length) {
    sections.push(`OCCUPANCY DETAILS:\n${occupancyDetails.join("\n")}`);
  }

  // Building Characteristics
  const buildingDetails: string[] = [];
  if (intake.number_of_stories) {
    buildingDetails.push(`Number of Stories: ${intake.number_of_stories}`);
  }
  if (intake.building_height_ft) {
    buildingDetails.push(`Building Height: ${intake.building_height_ft} ft`);
  }
  if (intake.total_area_sqft) {
    buildingDetails.push(`Total Area: ${intake.total_area_sqft.toLocaleString()} sq ft`);
  }
  if (intake.is_high_rise) {
    buildingDetails.push(`HIGH-RISE BUILDING (75+ feet) - Chapter 4 High-Rise Requirements Apply`);
  }
  if (intake.is_sprinklered !== null && intake.is_sprinklered !== undefined) {
    buildingDetails.push(`Sprinklered: ${intake.is_sprinklered ? "Yes - NFPA 13/13R/13D" : "No - Non-sprinklered requirements apply"}`);
  }
  if (intake.fire_alarm_type) {
    buildingDetails.push(`Fire Alarm System: ${intake.fire_alarm_type}`);
  }
  if (buildingDetails.length) {
    sections.push(`BUILDING CHARACTERISTICS:\n${buildingDetails.join("\n")}`);
  }

  // Florida Location
  const floridaDetails: string[] = [];
  if (intake.florida_county) {
    floridaDetails.push(`County: ${intake.florida_county} - Check local amendments`);
  }
  if (intake.wind_speed_mph) {
    floridaDetails.push(`Design Wind Speed: ${intake.wind_speed_mph} mph`);
    if (intake.wind_speed_mph >= 150) {
      floridaDetails.push(`HIGH-VELOCITY HURRICANE ZONE (HVHZ) - Enhanced requirements apply`);
    } else if (intake.wind_speed_mph >= 130) {
      floridaDetails.push(`Wind-Borne Debris Region - Impact protection required`);
    }
  }
  if (intake.flood_zone) {
    floridaDetails.push(`Flood Zone: ${intake.flood_zone}`);
    if (["A", "AE", "AH", "AO", "V", "VE"].includes(intake.flood_zone)) {
      floridaDetails.push(`SPECIAL FLOOD HAZARD AREA - Elevation and flood-resistant construction required`);
    }
  }
  if (intake.is_coastal_construction) {
    floridaDetails.push(`COASTAL CONSTRUCTION CONTROL LINE (CCCL) - DEP requirements apply`);
  }
  if (floridaDetails.length) {
    sections.push(`FLORIDA LOCATION REQUIREMENTS:\n${floridaDetails.join("\n")}`);
  }

  // Special Features
  const specialFeatures: string[] = [];
  if (intake.has_assembly_areas) {
    specialFeatures.push(`Contains Assembly Areas - Assembly occupancy requirements apply to those spaces`);
  }
  if (intake.has_hazardous_materials) {
    specialFeatures.push(`Hazardous Materials Storage - H occupancy control area requirements`);
  }
  if (intake.has_high_piled_storage) {
    specialFeatures.push(`High-Piled Storage - NFPA 13 Chapter 20+ and FBC 3206 requirements`);
  }
  if (intake.special_features?.length) {
    specialFeatures.push(`Special Features: ${intake.special_features.join(", ")}`);
  }
  if (specialFeatures.length) {
    sections.push(`SPECIAL FEATURES & HAZARDS:\n${specialFeatures.join("\n")}`);
  }

  // Project Phase
  if (intake.project_phase) {
    sections.push(`PROJECT PHASE: ${intake.project_phase.toUpperCase()} - Focus checklist items on ${getPhaseGuidance(intake.project_phase)}`);
  }

  return sections.join("\n\n");
}

function getPhaseGuidance(phase: string): string {
  const phaseGuidance: Record<string, string> = {
    design: "code compliance verification, occupancy classification confirmation, height/area calculations, fire-resistance ratings",
    permit: "plan review items, required documentation, structural calculations, fire protection system plans",
    construction: "rough-in inspections, structural connections, fire-stopping, MEP coordination",
    inspection: "field verification, dimensional compliance, equipment testing, life safety systems",
    final: "certificate of occupancy items, final inspections, documentation completion, testing/commissioning",
  };
  return phaseGuidance[phase] || "general code compliance";
}

// =============================================================================
// Occupancy Context Builder
// =============================================================================

interface OccupancyContext {
  queryPrefix: string;
  systemPromptAddition: string;
  priorityChapters: string[];
  ignoreChapters: string[];
}

function buildOccupancyContext(occupancyGroup?: string, constructionType?: string): OccupancyContext {
  const defaultContext: OccupancyContext = {
    queryPrefix: "",
    systemPromptAddition: "",
    priorityChapters: [],
    ignoreChapters: [],
  };

  if (!occupancyGroup) return defaultContext;

  // Map occupancy groups to comprehensive FBC-specific contexts
  const occupancyContextMap: Record<string, OccupancyContext> = {
    "Institutional": {
      queryPrefix: `Occupancy Group I (Institutional) - Healthcare, detention, assisted living facilities.`,
      systemPromptAddition: `OCCUPANCY: INSTITUTIONAL (Group I)

CRITICAL RISK ITEMS (mark as "critical"):
- Smoke compartment requirements and horizontal exits
- Emergency egress for non-ambulatory occupants
- Locking arrangements on doors in I-2 and I-3
- Automatic sprinkler requirements
- Fire alarm with voice notification

HIGH RISK ITEMS (mark as "high"):
- Nurse call systems
- Medical gas storage and piping
- Corridor width (8' min for I-2)
- Fire-resistance ratings between compartments
- Emergency power for life safety systems

INCLUDE comprehensive items for: structural, plumbing fixtures (higher ratios), accessibility, interior finishes (Class A/B required), HVAC/ventilation, emergency systems.`,
      priorityChapters: [],
      ignoreChapters: [],
    },
    "Assembly": {
      queryPrefix: `Occupancy Group A (Assembly) - Places of assembly, theaters, restaurants, stadiums.`,
      systemPromptAddition: `OCCUPANCY: ASSEMBLY (Group A)

CRITICAL RISK ITEMS (mark as "critical"):
- Occupant load calculations and posting
- Egress width based on occupant load
- Panic hardware on doors serving 50+ occupants
- Main exit capacity (50% of total)
- Emergency lighting and exit signs

HIGH RISK ITEMS (mark as "high"):
- Aisle width and dead-end aisle limits
- Stage/platform flame spread requirements
- Sprinkler requirements based on occupant load
- Fire alarm with voice evacuation
- Assembly seating row spacing

INCLUDE comprehensive items for: structural for occupancy loads, accessibility for assembly seating, interior finishes (Class A/B), sound systems, kitchen hood suppression if applicable.`,
      priorityChapters: [],
      ignoreChapters: [],
    },
    "Business": {
      queryPrefix: `Occupancy Group B (Business) - Offices, professional services, banks, outpatient clinics.`,
      systemPromptAddition: `OCCUPANCY: BUSINESS (Group B)

CRITICAL RISK ITEMS (mark as "critical"):
- Exit access travel distance limits
- Number of exits based on occupant load
- Exit discharge to public way
- Stairway width and construction

HIGH RISK ITEMS (mark as "high"):
- Corridor fire-resistance ratings
- Dead-end corridor limits (20'/50')
- Common path of egress travel
- Accessibility throughout public areas
- Fire alarm requirements

INCLUDE comprehensive items for: structural, accessibility (5% of parking), interior environment (lighting/ventilation), energy code, plumbing fixtures, elevator requirements for multi-story.`,
      priorityChapters: [],
      ignoreChapters: [],
    },
    "Educational": {
      queryPrefix: `Occupancy Group E (Educational) - Schools, daycare, training facilities.`,
      systemPromptAddition: `OCCUPANCY: EDUCATIONAL (Group E)

CRITICAL RISK ITEMS (mark as "critical"):
- Panic hardware on all egress doors
- Classroom door hardware (lockdown capability)
- Emergency egress windows in rooms below 4th floor
- Maximum travel distance to exits
- Fire alarm with mass notification

HIGH RISK ITEMS (mark as "high"):
- Corridor width (6' min, 8' with lockers)
- Dead-end corridor limits (20')
- Interior finish Class A/B in corridors
- Playground equipment safety zones
- Daycare specific requirements if applicable

INCLUDE comprehensive items for: accessibility (playgrounds), structural for occupancy, science lab ventilation, gymnasium requirements, kitchen/cafeteria, toilet fixture counts.`,
      priorityChapters: [],
      ignoreChapters: [],
    },
    "Factory": {
      queryPrefix: `Occupancy Group F (Factory/Industrial) - Manufacturing, workshops, processing facilities.`,
      systemPromptAddition: `OCCUPANCY: FACTORY/INDUSTRIAL (Group F)

CRITICAL RISK ITEMS (mark as "critical"):
- Hazardous material storage limits (MAQ)
- Exit access through production areas
- Industrial ventilation/exhaust systems
- Explosion relief venting if applicable
- Emergency shutoffs for equipment

HIGH RISK ITEMS (mark as "high"):
- Fire separation from storage areas
- Sprinkler design for specific hazards
- Equipment clearances and access
- Electrical classifications for hazardous areas
- Chemical storage containment

INCLUDE comprehensive items for: structural for equipment loads, F-1 vs F-2 classification requirements, energy code for industrial, loading dock requirements, office areas within factory.`,
      priorityChapters: [],
      ignoreChapters: [],
    },
    "High Hazard": {
      queryPrefix: `Occupancy Group H (High Hazard) - Explosives, flammables, toxic materials.`,
      systemPromptAddition: `OCCUPANCY: HIGH HAZARD (Group H) - MOST STRINGENT REQUIREMENTS

CRITICAL RISK ITEMS (mark as "critical"):
- Hazardous material quantities and classifications
- Explosion control (venting/suppression)
- Separation distances from other occupancies
- Emergency ventilation systems
- Spill containment and secondary containment
- Fire suppression specific to hazard type
- Electrical equipment ratings for classified areas

HIGH RISK ITEMS (mark as "high"):
- Control area design and limits
- Emergency alarm systems
- Gas detection systems
- Emergency power for ventilation
- Personnel protective equipment storage

INCLUDE ALL applicable items - this occupancy has the most stringent requirements across all code chapters.`,
      priorityChapters: [],
      ignoreChapters: [],
    },
    "Mercantile": {
      queryPrefix: `Occupancy Group M (Mercantile) - Retail stores, markets, sales rooms.`,
      systemPromptAddition: `OCCUPANCY: MERCANTILE (Group M)

CRITICAL RISK ITEMS (mark as "critical"):
- Exit access through sales floor
- Occupant load based on floor area (30 sf/person)
- Main entrance as required exit
- Panic hardware for 50+ occupants
- Exit sign visibility through displays

HIGH RISK ITEMS (mark as "high"):
- Aisle width and arrangement
- Display fixture height limits
- Sprinkler requirements (>12,000 sf)
- Accessibility throughout sales areas
- Storage/stockroom separation

INCLUDE comprehensive items for: structural for display loads, accessibility (checkout counters, fitting rooms), fire protection, interior finishes, covered mall requirements if applicable.`,
      priorityChapters: [],
      ignoreChapters: [],
    },
    "Residential": {
      queryPrefix: `Occupancy Group R (Residential) - Dwellings, apartments, hotels, dormitories.`,
      systemPromptAddition: `OCCUPANCY: RESIDENTIAL (Group R)

CRITICAL RISK ITEMS (mark as "critical"):
- Smoke alarms in sleeping rooms and areas
- Carbon monoxide detectors
- Emergency escape windows (5.7 sf, 24" min height/width)
- Fire separation between dwelling units
- Stair guards and handrails

HIGH RISK ITEMS (mark as "high"):
- Bedroom window fall prevention (R-2/R-3)
- Balcony/deck guards (42" height, 4" baluster spacing)
- Unit separation fire-resistance rating
- Means of egress from sleeping areas
- HVAC combustion air requirements

INCLUDE comprehensive items for: energy code (insulation, windows, HVAC), accessibility (Type A/B units), plumbing fixtures, electrical (AFCI/GFCI), structural, Florida wind requirements.`,
      priorityChapters: [],
      ignoreChapters: [],
    },
    "Storage": {
      queryPrefix: `Occupancy Group S (Storage) - Warehouses, storage facilities, parking garages.`,
      systemPromptAddition: `OCCUPANCY: STORAGE (Group S)

CRITICAL RISK ITEMS (mark as "critical"):
- High-piled storage fire protection
- Rack storage sprinkler design
- Aisle width for fire department access
- Exit access through storage areas
- Hazardous storage limits (MAQ)

HIGH RISK ITEMS (mark as "high"):
- Storage arrangement and pile stability
- Commodity classification for sprinklers
- Ventilation for enclosed storage
- Fire department access roads
- S-1 vs S-2 classification compliance

INCLUDE comprehensive items for: structural for storage loads, parking garage requirements (if S-2), open vs enclosed parking, EV charging requirements, ramp slopes.`,
      priorityChapters: [],
      ignoreChapters: [],
    },
    "Utility": {
      queryPrefix: `Occupancy Group U (Utility/Miscellaneous) - Accessory structures, agricultural buildings, carports.`,
      systemPromptAddition: `OCCUPANCY: UTILITY/MISCELLANEOUS (Group U)

CRITICAL RISK ITEMS (mark as "critical"):
- Separation from main building
- Agricultural building occupancy limits
- Flood zone requirements

HIGH RISK ITEMS (mark as "high"):
- Structural requirements for intended use
- Fire-resistance to property line
- Access and egress requirements

MEDIUM/LOW RISK: Most U occupancies have reduced requirements. Focus on Florida-specific: wind resistance, flood elevation, and accessory structure setbacks.`,
      priorityChapters: [],
      ignoreChapters: [],
    },
  };

  const context = occupancyContextMap[occupancyGroup] || defaultContext;

  // Add construction type context if provided
  if (constructionType) {
    context.queryPrefix += ` Construction Type: ${constructionType}.`;
    context.systemPromptAddition += `

CONSTRUCTION TYPE: ${constructionType}
Include checklist items for:
- Fire-resistance ratings per Table 601
- Allowable height and area per Tables 504.3, 504.4, 506.2
- Exterior wall fire-resistance based on fire separation distance (Table 602)
- Structural frame protection requirements
- Floor/ceiling and roof/ceiling assembly ratings
- Shaft enclosure requirements`;
  }

  return context;
}

// =============================================================================
// System Prompt
// =============================================================================

const SYSTEM_PROMPT = `You are an expert QA Auditor and Building Code Compliance Specialist for the Florida Building Code (FBC).

Your task is to generate a COMPREHENSIVE, ALL-INCLUSIVE QA inspection checklist based on:
1. A project description
2. Relevant code sections retrieved from the FBC vector database

SCOPE - Generate checklist items covering ALL applicable code areas:
- Chapter 3: Use and Occupancy Classification
- Chapter 4: Special Detailed Requirements
- Chapter 5: General Building Heights and Areas
- Chapter 6: Types of Construction
- Chapter 7: Fire and Smoke Protection Features
- Chapter 8: Interior Finishes
- Chapter 9: Fire Protection Systems
- Chapter 10: Means of Egress
- Chapter 11: Accessibility
- Chapter 12: Interior Environment (lighting, ventilation)
- Chapter 14: Exterior Walls
- Chapter 15: Roof Assemblies
- Chapter 16: Structural Design
- Chapter 17: Special Inspections
- Chapter 29: Plumbing Systems
- Chapter 30: Elevators and Conveying Systems
- Energy Code Requirements
- Florida-Specific Amendments

RISK LEVEL CLASSIFICATION:
- "critical": Life safety items - egress, fire protection, structural integrity, fall hazards. Failure could result in death or serious injury.
- "high": Major code violations - accessibility barriers, fire-resistance ratings, ventilation. Failure could result in injury or significant code violation.
- "medium": Standard compliance - interior finishes, energy requirements, general dimensions. Failure results in code violation but lower safety impact.
- "low": Minor items - labeling, documentation, signage placement. Administrative or minor violations.

OUTPUT FORMAT:
Return a JSON object with an "items" array. Each item must have:
- "requirement": A clear, actionable inspection requirement with specific measurements/values (e.g., "Verify stair riser height is between 4" minimum and 7" maximum per FBC 1011.5.2")
- "codeReference": The specific FBC section (e.g., "FBC 1011.5.2")
- "riskLevel": "critical", "high", "medium", or "low" based on safety impact
- "category": The inspection category (e.g., "Egress - Stairs", "Fire Protection - Sprinklers", "Accessibility - Doors", "Structural - Foundations")

GUIDELINES:
- Generate 25-40 comprehensive items covering all applicable code areas
- Include specific dimensional requirements, quantities, and measurable criteria
- Each item should be independently verifiable during inspection
- Sort items by risk level (critical first, then high, medium, low)
- Only include items relevant to the occupancy type and construction
- Reference actual FBC section numbers from the provided context`;

// =============================================================================
// Parameter Extraction Prompt
// =============================================================================

const PARAMETER_EXTRACTION_PROMPT = `You are a building code analyst. Extract measurable numeric parameters from the provided Florida Building Code sections.

For each requirement that has a specific numeric limit, extract:
- parameter: Name of what's being measured (e.g., "Stair Riser Height", "Door Width", "Corridor Width")
- codeLimit: The numeric value OR an object with min/max for ranges
  - For maximum limits: just the number (e.g., 7 for max 7 inches)
  - For minimum limits: just the number (e.g., 32 for min 32 inches)
  - For ranges: {"min": X, "max": Y}
- operator: How to compare measured values
  - "less_than_or_equal" for maximum limits (value must be ≤ limit)
  - "greater_than_or_equal" for minimum limits (value must be ≥ limit)
  - "between" for ranges (value must be within min and max)
  - "equal" for exact requirements
- unit: Unit of measurement (inches, feet, mm, percent, degrees, count, etc.)
- citation: The specific FBC section number (e.g., "FBC 1011.5.2")
- context: When this requirement applies (e.g., "residential stairs", "assembly occupancy")

EXAMPLES:
- "Maximum riser height 7 inches" → {"parameter": "Riser Height", "codeLimit": 7, "operator": "less_than_or_equal", "unit": "inches", "citation": "FBC 1011.5.2"}
- "Minimum door width 32 inches" → {"parameter": "Door Width", "codeLimit": 32, "operator": "greater_than_or_equal", "unit": "inches", "citation": "FBC 1010.1.1"}
- "Handrail height between 34 and 38 inches" → {"parameter": "Handrail Height", "codeLimit": {"min": 34, "max": 38}, "operator": "between", "unit": "inches", "citation": "FBC 1014.3.1"}

OUTPUT FORMAT:
Return a JSON object with a "parameters" array containing extracted parameters.
Only include requirements that have specific numeric values. Skip qualitative requirements.
Focus on: dimensions, heights, widths, clearances, slopes, counts, percentages, ratings (fire-resistance), distances.`;

// =============================================================================
// Extract Parameters from Code Sections
// =============================================================================

async function extractParametersFromCode(
  codeContext: string,
  tableContext: string,
  projectDescription: string
): Promise<ExtractedParameter[]> {
  try {
    const userPrompt = `PROJECT: ${projectDescription}

FLORIDA BUILDING CODE SECTIONS:
${codeContext}

${tableContext ? `CODE TABLES:\n${tableContext}` : ""}

Extract all measurable numeric parameters from the code sections above that would apply to this project.`;

    const completion = await openai.chat.completions.create({
      model: MODELS.FAST, // Use faster model for extraction
      messages: [
        { role: "system", content: PARAMETER_EXTRACTION_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1, // Very low for consistent extraction
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      console.log("[ParameterExtraction] No response from LLM");
      return [];
    }

    const parsed = JSON.parse(responseContent) as ParameterExtractionResult;
    console.log(`[ParameterExtraction] Extracted ${parsed.parameters?.length || 0} parameters`);
    return parsed.parameters || [];
  } catch (error) {
    console.error("[ParameterExtraction] Error:", error);
    return [];
  }
}

// =============================================================================
// Build target_value JSONB from extracted parameter
// =============================================================================

function buildTargetValue(param: ExtractedParameter): Record<string, unknown> {
  const targetValue: Record<string, unknown> = {
    unit: param.unit,
    code_ref: param.citation,
  };

  if (typeof param.codeLimit === "number") {
    // Single value - determine if it's min or max based on operator
    if (param.operator === "less_than" || param.operator === "less_than_or_equal") {
      targetValue.max = param.codeLimit;
    } else if (param.operator === "greater_than" || param.operator === "greater_than_or_equal") {
      targetValue.min = param.codeLimit;
    } else {
      targetValue.value = param.codeLimit;
    }
  } else if (param.codeLimit && typeof param.codeLimit === "object") {
    // Range value
    if ("min" in param.codeLimit) targetValue.min = param.codeLimit.min;
    if ("max" in param.codeLimit) targetValue.max = param.codeLimit.max;
  }

  if (param.context) {
    targetValue.context = param.context;
  }

  return targetValue;
}

// =============================================================================
// Map operator to comparison_logic
// =============================================================================

function mapOperatorToComparisonLogic(operator: ExtractedParameter["operator"]): string {
  const mapping: Record<string, string> = {
    less_than: "less_than",
    less_than_or_equal: "less_than_or_equal",
    greater_than: "greater_than",
    greater_than_or_equal: "greater_than_or_equal",
    equal: "equal",
    between: "between",
  };
  return mapping[operator] || "equal";
}

// =============================================================================
// API Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: GenerateChecklistRequest = await request.json();
    const { projectId, projectDescription, checklistTitle, focusAreas, occupancyGroup, constructionType } = body;

    // Validate input
    if (!projectId || !projectDescription) {
      return NextResponse.json(
        { error: "Missing required fields: projectId and projectDescription" },
        { status: 400 }
      );
    }

    // Fetch full project data including intake fields
    const supabase = getServiceClient();
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError) {
      console.log("[GenerateChecklist] Could not fetch project data:", projectError.message);
    }

    // Extract intake data from project
    const intakeData: ProjectIntakeData = projectData ? {
      occupancy_subtype: projectData.occupancy_subtype,
      mixed_occupancies: projectData.mixed_occupancies,
      occupant_load: projectData.occupant_load,
      number_of_stories: projectData.number_of_stories,
      building_height_ft: projectData.building_height_ft,
      total_area_sqft: projectData.total_area_sqft,
      is_sprinklered: projectData.is_sprinklered,
      fire_alarm_type: projectData.fire_alarm_type,
      florida_county: projectData.florida_county,
      flood_zone: projectData.flood_zone,
      wind_speed_mph: projectData.wind_speed_mph,
      is_coastal_construction: projectData.is_coastal_construction,
      is_high_rise: projectData.is_high_rise,
      has_assembly_areas: projectData.has_assembly_areas,
      has_hazardous_materials: projectData.has_hazardous_materials,
      has_high_piled_storage: projectData.has_high_piled_storage,
      special_features: projectData.special_features,
      project_phase: projectData.project_phase,
    } : {};

    // Build project intake context string
    const intakeContext = buildProjectIntakeContext(intakeData);
    const hasIntakeData = intakeContext.length > 0;

    // Get BIM summary text if available (from IFC entity extraction)
    const bimSummaryText = projectData?.bim_summary_text || null;
    const hasBimData = !!bimSummaryText;

    console.log("[GenerateChecklist] Project intake data available:", hasIntakeData);
    console.log("[GenerateChecklist] BIM data available:", hasBimData);
    if (hasIntakeData) {
      console.log("[GenerateChecklist] Intake context preview:", intakeContext.substring(0, 200));
    }
    if (hasBimData) {
      console.log("[GenerateChecklist] BIM context preview:", bimSummaryText.substring(0, 200));
    }

    // Step 1: Build a comprehensive query for FBC retrieval with occupancy context
    const focusAreasText = focusAreas?.length
      ? `Focus areas: ${focusAreas.join(", ")}.`
      : "Focus on egress, stairs, doors, corridors, and fire safety.";

    // Build occupancy-specific context for the retrieval query
    const occupancyContext = buildOccupancyContext(occupancyGroup, constructionType);

    // Build enhanced retrieval query with intake data for better vector matching
    const intakeQueryTerms: string[] = [];
    if (intakeData.is_high_rise) intakeQueryTerms.push("high-rise building requirements Section 403");
    if (intakeData.is_sprinklered === false) intakeQueryTerms.push("non-sprinklered building requirements");
    if (intakeData.is_sprinklered === true) intakeQueryTerms.push("sprinklered building requirements NFPA 13");
    if (intakeData.wind_speed_mph && intakeData.wind_speed_mph >= 150) intakeQueryTerms.push("high-velocity hurricane zone HVHZ requirements");
    if (intakeData.flood_zone) intakeQueryTerms.push(`flood zone ${intakeData.flood_zone} flood-resistant construction`);
    if (intakeData.is_coastal_construction) intakeQueryTerms.push("coastal construction control line CCCL");
    if (intakeData.has_assembly_areas) intakeQueryTerms.push("assembly occupancy requirements");
    if (intakeData.has_hazardous_materials) intakeQueryTerms.push("hazardous materials control areas");
    if (intakeData.has_high_piled_storage) intakeQueryTerms.push("high-piled combustible storage requirements");
    if (intakeData.occupancy_subtype) intakeQueryTerms.push(`${intakeData.occupancy_subtype} occupancy`);

    const intakeQueryAddition = intakeQueryTerms.length ? ` ${intakeQueryTerms.join(". ")}.` : "";

    // Add BIM-derived query terms based on element counts
    const bimQueryTerms: string[] = [];
    if (projectData?.bim_element_counts) {
      const elementCounts = projectData.bim_element_counts as Array<{ label: string; count: number }>;
      const hasDoors = elementCounts.find(e => e.label === "Doors")?.count || 0;
      const hasStairs = elementCounts.find(e => e.label === "Stairs" || e.label === "Stair Flights")?.count || 0;
      const hasRamps = elementCounts.find(e => e.label === "Ramps" || e.label === "Ramp Flights")?.count || 0;
      const hasRailings = elementCounts.find(e => e.label === "Railings")?.count || 0;

      if (hasDoors > 0) bimQueryTerms.push(`door requirements egress doors (${hasDoors} doors)`);
      if (hasStairs > 0) bimQueryTerms.push(`stair requirements egress stairs (${hasStairs} stairs)`);
      if (hasRamps > 0) bimQueryTerms.push(`ramp requirements accessibility ramps (${hasRamps} ramps)`);
      if (hasRailings > 0) bimQueryTerms.push("handrail guardrail requirements");
    }
    if (projectData?.bim_storey_count && projectData.bim_storey_count > 1) {
      bimQueryTerms.push(`multi-story building ${projectData.bim_storey_count} floors vertical egress`);
    }
    const bimQueryAddition = bimQueryTerms.length ? ` ${bimQueryTerms.join(". ")}.` : "";

    const retrievalQuery = `Building code requirements for: ${projectDescription}. ${occupancyContext.queryPrefix} ${focusAreasText}${intakeQueryAddition}${bimQueryAddition} Include dimensional requirements, occupancy limits, and safety provisions.`;

    console.log("[GenerateChecklist] Retrieving compliance data...");
    console.log("[GenerateChecklist] Query:", retrievalQuery.substring(0, 300));

    // Build RAG project context for library-aware retrieval
    const ragProjectContext: RAGProjectContext = {
      id: projectId,
      state: body.state || projectData?.state || "Florida",
      libraryId: body.libraryId || projectData?.library_id,
      jurisdiction: projectData?.florida_county || "Florida",
    };

    console.log("[GenerateChecklist] RAG context:", ragProjectContext);

    // Step 2: Retrieve relevant FBC sections using SUPER RAG
    const complianceData = await retrieveComplianceData(retrievalQuery, ragProjectContext, {
      textMatchCount: 12, // Get more context for checklist generation
      tableMatchThreshold: 0.75, // Lower threshold to get more tables
      tableMatchCount: 5,
      enableChapterRouting: !!ragProjectContext.libraryId, // Enable chapter routing if library specified
    });

    console.log(
      `[GenerateChecklist] Retrieved ${complianceData.textChunks.length} text chunks, ${complianceData.tableContext.length} tables`
    );

    // Step 3: Format context for LLM
    const tableContext = complianceData.tableContext
      .map(
        (table) =>
          `Table ${table.tableId}: ${table.tableTitle || "Untitled"}\nSection: ${table.sectionReference || "N/A"}\nSummary: ${table.summary}\nData: ${JSON.stringify(table.data, null, 2)}`
      )
      .join("\n\n---\n\n");

    // Build the BIM data context section
    const bimContextSection = hasBimData
      ? `\n\n${bimSummaryText}

IMPORTANT: The BIM model analysis above shows actual element counts from the building model. Use this to:
- Generate specific checklist items for EACH type of element found (e.g., if 45 doors, include door-specific items)
- Focus egress items on the actual stair/ramp counts and floor configuration
- Include accessibility items proportional to the number of spaces/rooms
- Reference element quantities in checklist items where relevant`
      : "";

    // Build the detailed project context section for the prompt
    const projectContextSection = hasIntakeData
      ? `\n\nDETAILED PROJECT SPECIFICATIONS:
${intakeContext}

IMPORTANT: Use the detailed project specifications above to customize the checklist. Include items specific to:
${intakeData.is_high_rise ? "- HIGH-RISE: Firefighter access, standpipes, smoke compartmentalization, emergency power\n" : ""}${intakeData.is_sprinklered === false ? "- NON-SPRINKLERED: Additional fire separation, reduced allowable areas, stricter finishes\n" : ""}${intakeData.is_sprinklered === true ? "- SPRINKLERED: NFPA 13 compliance, hydraulic calculations, water supply adequacy\n" : ""}${intakeData.wind_speed_mph && intakeData.wind_speed_mph >= 130 ? "- HIGH WIND: Impact protection, opening protection, continuous load path\n" : ""}${intakeData.flood_zone ? "- FLOOD ZONE: Elevation requirements, flood-resistant materials, utility protection\n" : ""}${intakeData.has_hazardous_materials ? "- HAZMAT: Control area quantities, ventilation, spill containment\n" : ""}`
      : "";

    const userPrompt = `PROJECT DESCRIPTION:
${projectDescription}
${projectContextSection}${bimContextSection}

RELEVANT FLORIDA BUILDING CODE SECTIONS:
${complianceData.textContext}

${tableContext ? `\nRELEVANT CODE TABLES:\n${tableContext}` : ""}

Based on the project description${hasIntakeData ? ", detailed specifications," : ""}${hasBimData ? ", BIM model data," : ""} and the FBC sections above, generate a comprehensive QA inspection checklist. Focus on verifiable requirements that can be checked during site inspection.${hasIntakeData ? " ENSURE checklist items are specific to this project's characteristics (building height, area, sprinkler status, location, and special features)." : ""}${hasBimData ? " USE the BIM element counts to generate relevant egress, door, stair, and accessibility items." : ""}`;

    // Step 4: Extract measurable parameters from code sections (parallel with checklist generation)
    console.log("[GenerateChecklist] Extracting parameters from code sections...");
    const extractedParametersPromise = extractParametersFromCode(
      complianceData.textContext,
      tableContext,
      projectDescription
    );

    // Step 5: Call LLM to generate checklist
    console.log("[GenerateChecklist] Calling LLM for checklist generation...");
    console.log("[GenerateChecklist] Occupancy context:", occupancyGroup, constructionType);

    // Build the full system prompt with occupancy-specific additions
    const fullSystemPrompt = occupancyContext.systemPromptAddition
      ? `${SYSTEM_PROMPT}\n\n---\nOCCUPANCY-SPECIFIC INSTRUCTIONS:\n${occupancyContext.systemPromptAddition}`
      : SYSTEM_PROMPT;

    const completion = await openai.chat.completions.create({
      model: MODELS.REASONING,
      messages: [
        { role: "system", content: fullSystemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent output
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;
    console.log("[GenerateChecklist] Raw LLM response:", responseContent?.substring(0, 500));

    if (!responseContent) {
      throw new Error("No response from LLM");
    }

    // Step 5: Parse LLM response
    let parsedResponse: Record<string, unknown>;
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("[GenerateChecklist] Failed to parse LLM response:", responseContent);
      throw new Error("Failed to parse checklist from LLM response");
    }

    console.log("[GenerateChecklist] Parsed response keys:", Object.keys(parsedResponse));

    // Handle various response formats: array, { items: [...] }, { checklist: [...] }, etc.
    let generatedItems: GeneratedChecklistItem[] = [];

    if (Array.isArray(parsedResponse)) {
      generatedItems = parsedResponse as GeneratedChecklistItem[];
    } else if (Array.isArray(parsedResponse.items)) {
      generatedItems = parsedResponse.items as GeneratedChecklistItem[];
    } else if (Array.isArray(parsedResponse.checklist)) {
      generatedItems = parsedResponse.checklist as GeneratedChecklistItem[];
    } else if (Array.isArray(parsedResponse.checklistItems)) {
      generatedItems = parsedResponse.checklistItems as GeneratedChecklistItem[];
    } else {
      // Try to find any array property
      for (const key of Object.keys(parsedResponse)) {
        if (Array.isArray(parsedResponse[key])) {
          console.log(`[GenerateChecklist] Found array in key: ${key}`);
          generatedItems = parsedResponse[key] as GeneratedChecklistItem[];
          break;
        }
      }
    }

    console.log(`[GenerateChecklist] Found ${generatedItems.length} items`);

    if (!generatedItems.length) {
      console.error("[GenerateChecklist] Full parsed response:", JSON.stringify(parsedResponse, null, 2));
      throw new Error("LLM returned empty checklist");
    }

    console.log(`[GenerateChecklist] Generated ${generatedItems.length} checklist items`);
    console.log(`[GenerateChecklist] Using intake data: ${hasIntakeData}`);
    console.log(`[GenerateChecklist] Using BIM data: ${hasBimData}`);

    // Await parameter extraction (started earlier in parallel)
    const extractedParameters = await extractedParametersPromise;
    console.log(`[GenerateChecklist] Extracted ${extractedParameters.length} measurable parameters`);

    // Log the extracted parameters for debugging
    for (const param of extractedParameters) {
      console.log(`[GenerateChecklist] Parameter: "${param.parameter}" (${param.citation}) - ${param.operator} ${JSON.stringify(param.codeLimit)} ${param.unit}`);
    }

    // Create maps for parameter lookup by citation AND by parameter name keywords
    const parametersByReference = new Map<string, ExtractedParameter>();
    const parametersByKeyword = new Map<string, ExtractedParameter>();

    for (const param of extractedParameters) {
      // Normalize citation for matching (e.g., "FBC 1011.5.2" -> "1011.5.2")
      const normalizedRef = param.citation.replace(/^FBC\s*/i, "").trim();
      parametersByReference.set(normalizedRef, param);
      parametersByReference.set(param.citation, param); // Also store original

      // Also index by parameter name keywords for fuzzy matching
      const keywords = param.parameter.toLowerCase().split(/\s+/);
      for (const keyword of keywords) {
        if (keyword.length > 3) { // Skip short words
          parametersByKeyword.set(keyword, param);
        }
      }
    }

    // Step 6: Save to database (reuse supabase client from earlier)
    // Create the checklist
    const { data: checklist, error: checklistError } = await supabase
      .from("checklists")
      .insert({
        project_id: projectId,
        title: checklistTitle || `${projectDescription.slice(0, 50)}... Inspection Checklist`,
        description: `Auto-generated checklist for: ${projectDescription}`,
        status: "active",
      })
      .select()
      .single();

    if (checklistError) {
      console.error("[GenerateChecklist] Failed to create checklist:", checklistError);
      throw new Error(`Failed to create checklist: ${checklistError.message}`);
    }

    // Create checklist items with parameter data when available
    const checklistItems = generatedItems.map((item, index) => {
      // Try to match this item to an extracted parameter
      const normalizedRef = item.codeReference?.replace(/^FBC\s*/i, "").trim() || "";
      let matchedParam = parametersByReference.get(normalizedRef) || parametersByReference.get(item.codeReference);

      // If no match by reference, try keyword matching on requirement text
      if (!matchedParam) {
        const reqWords = item.requirement.toLowerCase().split(/\s+/);
        for (const word of reqWords) {
          if (parametersByKeyword.has(word)) {
            matchedParam = parametersByKeyword.get(word);
            console.log(`[GenerateChecklist] Keyword match "${word}" found for: ${item.requirement.substring(0, 40)}...`);
            break;
          }
        }
      }

      // Build base item
      const checklistItem: Record<string, unknown> = {
        checklist_id: checklist.id,
        requirement_text: item.requirement,
        code_reference: item.codeReference,
        sort_order: index,
        notes: JSON.stringify({ riskLevel: item.riskLevel, category: item.category }),
      };

      // Add parameter fields if we found a matching parameter
      if (matchedParam) {
        checklistItem.parameter_name = matchedParam.parameter;
        checklistItem.target_value = buildTargetValue(matchedParam);
        checklistItem.unit = matchedParam.unit;
        checklistItem.comparison_logic = mapOperatorToComparisonLogic(matchedParam.operator);
        checklistItem.validation_result = "not_measured"; // Default until measured

        console.log(`[GenerateChecklist] Matched parameter "${matchedParam.parameter}" to item: ${item.requirement.substring(0, 50)}...`);
      }

      return checklistItem;
    });

    const { data: insertedItems, error: itemsError } = await supabase
      .from("checklist_items")
      .insert(checklistItems)
      .select();

    if (itemsError) {
      console.error("[GenerateChecklist] Failed to create checklist items:", itemsError);
      // Clean up the checklist if items failed
      await supabase.from("checklists").delete().eq("id", checklist.id);
      throw new Error(`Failed to create checklist items: ${itemsError.message}`);
    }

    // Count items with parameters
    const itemsWithParameters = insertedItems?.filter(
      (item) => item.parameter_name != null
    ).length || 0;
    console.log(`[GenerateChecklist] Saved checklist ${checklist.id} with ${insertedItems?.length} items (${itemsWithParameters} with parameters)`);

    // Step 7: Return response
    return NextResponse.json({
      success: true,
      checklist: {
        id: checklist.id,
        title: checklist.title,
        description: checklist.description,
        status: checklist.status,
        itemCount: insertedItems?.length || 0,
        parametersCount: itemsWithParameters,
      },
      items: insertedItems?.map((item) => ({
        id: item.id,
        requirementText: item.requirement_text,
        codeReference: item.code_reference,
        sortOrder: item.sort_order,
        metadata: item.notes ? JSON.parse(item.notes) : null,
        // Include parameter fields if present
        parameterName: item.parameter_name || null,
        targetValue: item.target_value || null,
        unit: item.unit || null,
        comparisonLogic: item.comparison_logic || null,
        validationResult: item.validation_result || null,
        designedValue: item.designed_value || null,
      })),
      stats: {
        textChunksUsed: complianceData.textChunks.length,
        tablesUsed: complianceData.tableContext.length,
        embeddingTime: complianceData.embeddingTime,
        searchTime: complianceData.searchTime,
        usedIntakeData: hasIntakeData,
        usedBimData: hasBimData,
        bimElementCount: projectData?.bim_total_elements || 0,
        extractedParameters: extractedParameters.length,
        itemsWithParameters,
      },
    });
  } catch (error) {
    console.error("[GenerateChecklist] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate checklist",
      },
      { status: 500 }
    );
  }
}
