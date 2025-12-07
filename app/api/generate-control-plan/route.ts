import { NextRequest, NextResponse } from "next/server";
import { openai, MODELS } from "@/app/lib/openai";
import { getServiceClient } from "@/app/lib/supabase";
import { retrieveComplianceData, type RAGProjectContext } from "@/app/actions/retrieveComplianceData";
import { generateEmbedding } from "@/app/lib/ingestion/embeddings";

// =============================================================================
// Types
// =============================================================================

interface GenerateControlPlanRequest {
  projectId: string;
  constructionPhase: string; // e.g., "Foundation", "Framing", "MEP Rough-In", "Finishes"
  date?: string; // Optional: specific date for the control plan
}

// CSI Division mapping for construction phases
const PHASE_TO_CSI_DIVISIONS: Record<string, string[]> = {
  "Site Work": ["02", "31", "32", "33"],
  "Foundation": ["03", "31"], // Concrete, Earthwork
  "Concrete": ["03"],
  "Structural": ["03", "05"], // Concrete, Metals
  "Framing": ["05", "06"], // Metals, Wood/Plastics
  "Masonry": ["04"],
  "Roofing": ["07"], // Thermal/Moisture Protection
  "Exterior": ["07", "08", "14"], // Thermal/Moisture, Openings, Exterior Walls
  "MEP Rough-In": ["21", "22", "23", "26"], // Fire Suppression, Plumbing, HVAC, Electrical
  "Mechanical": ["23"], // HVAC
  "Electrical": ["26", "27", "28"], // Electrical, Communications, Security
  "Plumbing": ["22"],
  "Fire Protection": ["21", "09"], // Fire Suppression, Fire-rated assemblies
  "Insulation": ["07"],
  "Drywall": ["09"],
  "Finishes": ["09", "10", "12"], // Finishes, Specialties, Furnishings
  "Flooring": ["09"],
  "Paint": ["09"],
  "Final": ["01", "10", "11", "14"], // General Requirements, Specialties, Equipment, Conveying
};

// Chapter routing for code searches
const PHASE_TO_CODE_CHAPTERS: Record<string, string[]> = {
  "Site Work": ["16", "18", "31", "32", "33"],
  "Foundation": ["16", "18", "19"], // Structural, Soils, Concrete
  "Concrete": ["16", "19"], // Structural, Concrete
  "Structural": ["16", "17", "18", "19"], // Structural, Special Inspections
  "Framing": ["16", "17", "23"], // Structural, Special Inspections, Wood
  "Masonry": ["16", "17", "21"], // Structural, Special Inspections, Masonry
  "Roofing": ["15"], // Roof Assemblies
  "Exterior": ["14", "15", "26"], // Exterior Walls, Roofs, Plastic
  "MEP Rough-In": ["9", "12", "29", "30"], // Fire Protection, Interior Environment, Plumbing, Elevators
  "Mechanical": ["12", "28"], // Interior Environment, Mechanical
  "Electrical": ["27"], // Electrical
  "Plumbing": ["29"], // Plumbing
  "Fire Protection": ["7", "9"], // Fire Protection Features, Fire Protection Systems
  "Insulation": ["7", "14"], // Fire Resistance, Exterior Walls
  "Drywall": ["7", "8"], // Fire Resistance, Interior Finishes
  "Finishes": ["8", "9", "11"], // Interior Finishes, Fire Protection, Accessibility
  "Flooring": ["8", "11"], // Interior Finishes, Accessibility
  "Final": ["10", "11", "30"], // Means of Egress, Accessibility, Elevators
};

interface ProjectSpec {
  id: string;
  csi_division: string;
  section_title: string | null;
  requirement_text: string;
  parameter_name: string;
  min_value: number | null;
  max_value: number | null;
  target_value: number | null;
  unit: string | null;
  tolerance: number | null;
  tolerance_type: string | null;
  spec_type: string | null;
  priority: string | null;
  source_document: string | null;
}

interface ControlPlanItem {
  inspection_item: string;
  parameter_name: string;
  spec_limit: string | null;
  code_limit: string | null;
  target_value: string;
  unit: string;
  priority: "critical" | "high" | "medium" | "low";
  source: "spec" | "code" | "both";
  spec_reference: string | null;
  code_reference: string | null;
  inspection_method: string;
}

interface ControlPlanResult {
  items: ControlPlanItem[];
}

// =============================================================================
// System Prompt for Control Plan Generation
// =============================================================================

const CONTROL_PLAN_SYSTEM_PROMPT = `You are an expert Construction Quality Control specialist. Your task is to generate a "Daily Inspection Control Plan" for inspectors.

## YOUR ROLE
Given project specifications (from the design documents) and building code requirements, create a prioritized list of inspection items for the specified construction phase.

## IMPORTANT: MERGE SPEC AND CODE REQUIREMENTS
When both a Project Specification and a Building Code apply to the same parameter:
- Use the MORE STRINGENT value as the target
- Note BOTH sources in your output
- Example: If Spec says "Concrete slump 4 inches +/- 1 inch" and Code says "Slump 3-5 inches", the target should reference both

## OUTPUT FORMAT
Return a JSON object with an "items" array. Each item must have:
- "inspection_item": Clear description of what to inspect (e.g., "Check footing depth")
- "parameter_name": The measurable parameter (e.g., "Footing Depth")
- "spec_limit": The limit from project specs, or null if no spec applies (e.g., "Min 24 inches")
- "code_limit": The limit from building code, or null if no code applies (e.g., "Min 12 inches per FBC 1809.4")
- "target_value": The value the inspector should verify against - USE THE MORE STRINGENT of spec/code (e.g., "≥24 inches")
- "unit": Unit of measurement (e.g., "inches", "psi", "%", "°F")
- "priority": "critical", "high", "medium", or "low" based on structural/safety importance
- "source": "spec" if only spec applies, "code" if only code applies, "both" if both apply
- "spec_reference": Source document/section from specs, or null
- "code_reference": Code section reference (e.g., "FBC 1809.4"), or null
- "inspection_method": Brief description of how to inspect (e.g., "Measure with tape from bottom of excavation")

## PRIORITY CLASSIFICATION
- "critical": Structural integrity, life safety, load-bearing elements, fire-resistance ratings
- "high": Major code compliance items, waterproofing, insulation values
- "medium": Standard dimensional checks, material specifications
- "low": Aesthetic items, minor tolerances, documentation

## GUIDELINES
- Generate 10-25 inspection items appropriate for the construction phase
- ALWAYS include the more stringent requirement when both spec and code apply
- Focus on MEASURABLE, VERIFIABLE items with specific numeric values
- Sort by priority (critical first, then high, medium, low)
- Include practical inspection methods for field verification
- Reference specific code sections and spec documents`;

// =============================================================================
// Query Project Specs by CSI Division
// =============================================================================

async function getProjectSpecsForPhase(
  supabase: ReturnType<typeof getServiceClient>,
  projectId: string,
  constructionPhase: string
): Promise<ProjectSpec[]> {
  // Get CSI divisions relevant to this phase
  const csiDivisions = PHASE_TO_CSI_DIVISIONS[constructionPhase] || [];

  if (csiDivisions.length === 0) {
    console.log(`[ControlPlan] No CSI division mapping for phase: ${constructionPhase}`);
    return [];
  }

  console.log(`[ControlPlan] Querying project_specs for CSI divisions: ${csiDivisions.join(", ")}`);

  // Build query with ILIKE for each division
  let query = supabase
    .from("project_specs")
    .select("*")
    .eq("project_id", projectId);

  // Build OR conditions for CSI divisions
  const divisionFilters = csiDivisions.map(div => `csi_division.ilike.%${div}%`);
  query = query.or(divisionFilters.join(","));

  const { data, error } = await query
    .order("priority", { ascending: true }) // critical first
    .order("parameter_name");

  if (error) {
    console.error("[ControlPlan] Error querying project_specs:", error);
    return [];
  }

  console.log(`[ControlPlan] Found ${data?.length || 0} project specs for phase ${constructionPhase}`);
  return data || [];
}

// =============================================================================
// Query Project Specs by Semantic Search
// =============================================================================

async function searchProjectSpecsSemantic(
  supabase: ReturnType<typeof getServiceClient>,
  projectId: string,
  constructionPhase: string
): Promise<ProjectSpec[]> {
  try {
    // Generate embedding for the construction phase query
    const queryText = `${constructionPhase} construction inspection requirements specifications tolerances`;
    const embeddingResult = await generateEmbedding(queryText);

    if (!embeddingResult.embedding) {
      console.log("[ControlPlan] Failed to generate embedding for spec search");
      return [];
    }

    // Call the semantic search function
    const { data, error } = await supabase.rpc("search_project_specs", {
      p_project_id: projectId,
      p_query_embedding: `[${embeddingResult.embedding.join(",")}]`,
      p_match_threshold: 0.6, // Lower threshold to get more results
      p_match_count: 20,
      p_csi_division: null, // Don't filter by division for semantic search
    });

    if (error) {
      console.error("[ControlPlan] Error in semantic spec search:", error);
      return [];
    }

    console.log(`[ControlPlan] Semantic search found ${data?.length || 0} specs`);
    return data || [];
  } catch (error) {
    console.error("[ControlPlan] Semantic search error:", error);
    return [];
  }
}

// =============================================================================
// Format Specs for LLM Context
// =============================================================================

function formatSpecsForContext(specs: ProjectSpec[]): string {
  if (specs.length === 0) {
    return "NO PROJECT SPECIFICATIONS FOUND FOR THIS PHASE";
  }

  return specs.map((spec, i) => {
    const limits: string[] = [];
    if (spec.min_value !== null) limits.push(`Min: ${spec.min_value}`);
    if (spec.max_value !== null) limits.push(`Max: ${spec.max_value}`);
    if (spec.target_value !== null) limits.push(`Target: ${spec.target_value}`);
    if (spec.tolerance !== null) {
      const toleranceStr = spec.tolerance_type === "percentage"
        ? `±${spec.tolerance}%`
        : `±${spec.tolerance}`;
      limits.push(`Tolerance: ${toleranceStr}`);
    }

    const limitsStr = limits.length > 0 ? limits.join(", ") : "N/A";
    const unitStr = spec.unit ? ` ${spec.unit}` : "";

    return `### Spec ${i + 1}: ${spec.parameter_name}
**CSI Division:** ${spec.csi_division}
**Section:** ${spec.section_title || "N/A"}
**Requirement:** ${spec.requirement_text}
**Limits:** ${limitsStr}${unitStr}
**Priority:** ${spec.priority || "medium"}
**Type:** ${spec.spec_type || "N/A"}
**Source:** ${spec.source_document || "Project Specs"}`;
  }).join("\n\n---\n\n");
}

// =============================================================================
// Format Code Sections for LLM Context
// =============================================================================

function formatCodeSectionsForContext(
  textContext: string,
  tableContext: Array<{
    tableId: string;
    tableTitle: string | null;
    summary: string;
    data: unknown;
  }>
): string {
  let context = textContext;

  if (tableContext.length > 0) {
    context += "\n\n## RELEVANT CODE TABLES\n\n";
    context += tableContext.map(table =>
      `### ${table.tableId}: ${table.tableTitle || "Untitled"}
**Summary:** ${table.summary}
**Data:**
\`\`\`json
${JSON.stringify(table.data, null, 2)}
\`\`\``
    ).join("\n\n");
  }

  return context;
}

// =============================================================================
// Build Target Value JSONB for Checklist Items
// =============================================================================

function buildTargetValueFromControlItem(item: ControlPlanItem): Record<string, unknown> {
  const targetValue: Record<string, unknown> = {
    unit: item.unit,
  };

  // Parse the target_value string to extract numeric limits
  const targetStr = item.target_value.toLowerCase();

  if (targetStr.includes("≥") || targetStr.includes(">=") || targetStr.includes("min")) {
    const match = targetStr.match(/[\d.]+/);
    if (match) {
      targetValue.min = parseFloat(match[0]);
    }
  } else if (targetStr.includes("≤") || targetStr.includes("<=") || targetStr.includes("max")) {
    const match = targetStr.match(/[\d.]+/);
    if (match) {
      targetValue.max = parseFloat(match[0]);
    }
  } else if (targetStr.includes("-") || targetStr.includes("to")) {
    const matches = targetStr.match(/[\d.]+/g);
    if (matches && matches.length >= 2) {
      targetValue.min = parseFloat(matches[0]);
      targetValue.max = parseFloat(matches[1]);
    }
  } else {
    const match = targetStr.match(/[\d.]+/);
    if (match) {
      targetValue.value = parseFloat(match[0]);
    }
  }

  // Add code reference if available
  if (item.code_reference) {
    targetValue.code_ref = item.code_reference;
  }

  // Add spec reference if available
  if (item.spec_reference) {
    targetValue.spec_ref = item.spec_reference;
  }

  return targetValue;
}

// =============================================================================
// Determine Comparison Logic from Target Value
// =============================================================================

function determineComparisonLogic(targetStr: string): string {
  const lower = targetStr.toLowerCase();

  if (lower.includes("≥") || lower.includes(">=") || lower.includes("min") || lower.includes("minimum")) {
    return "greater_than_or_equal";
  } else if (lower.includes("≤") || lower.includes("<=") || lower.includes("max") || lower.includes("maximum")) {
    return "less_than_or_equal";
  } else if (lower.includes("-") || lower.includes("to") || lower.includes("between")) {
    return "between";
  } else if (lower.includes(">") && !lower.includes("=")) {
    return "greater_than";
  } else if (lower.includes("<") && !lower.includes("=")) {
    return "less_than";
  }

  return "equal";
}

// =============================================================================
// API Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: GenerateControlPlanRequest = await request.json();
    const { projectId, constructionPhase, date } = body;

    // Validate input
    if (!projectId || !constructionPhase) {
      return NextResponse.json(
        { error: "Missing required fields: projectId and constructionPhase" },
        { status: 400 }
      );
    }

    console.log(`[ControlPlan] Generating control plan for project ${projectId}, phase: ${constructionPhase}`);

    const supabase = getServiceClient();

    // Fetch project data for context
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (projectError) {
      console.error("[ControlPlan] Failed to fetch project:", projectError);
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // ==========================================================================
    // Step 1: Query Project Specs (Design Compliance)
    // ==========================================================================

    console.log("[ControlPlan] Step 1: Querying project specifications...");

    // Query by CSI division
    const specsByDivision = await getProjectSpecsForPhase(supabase, projectId, constructionPhase);

    // Also do semantic search for additional relevant specs
    const specsBySemantic = await searchProjectSpecsSemantic(supabase, projectId, constructionPhase);

    // Combine and deduplicate specs
    const allSpecs = [...specsByDivision];
    const seenSpecIds = new Set(specsByDivision.map(s => s.id));

    for (const spec of specsBySemantic) {
      if (!seenSpecIds.has(spec.id)) {
        allSpecs.push(spec);
        seenSpecIds.add(spec.id);
      }
    }

    console.log(`[ControlPlan] Total unique specs: ${allSpecs.length}`);

    // ==========================================================================
    // Step 2: Query Code Sections (Code Compliance) via Super RAG
    // ==========================================================================

    console.log("[ControlPlan] Step 2: Querying building code sections...");

    // Build RAG query based on construction phase
    const codeChapters = PHASE_TO_CODE_CHAPTERS[constructionPhase] || [];
    const ragQuery = `${constructionPhase} construction inspection requirements. Include dimensional requirements, material specifications, tolerances, and testing requirements for ${constructionPhase.toLowerCase()} work.`;

    // Build project context for library-aware retrieval
    const ragProjectContext: RAGProjectContext = {
      id: projectId,
      state: projectData?.state || "Florida",
      libraryId: projectData?.library_id,
      jurisdiction: projectData?.florida_county || "Florida",
    };

    // Retrieve code sections using Super RAG
    const complianceData = await retrieveComplianceData(ragQuery, ragProjectContext, {
      textMatchCount: 15,
      tableMatchThreshold: 0.7,
      tableMatchCount: 5,
      enableChapterRouting: true,
    });

    console.log(`[ControlPlan] Retrieved ${complianceData.textChunks.length} code sections, ${complianceData.tableContext.length} tables`);

    // ==========================================================================
    // Step 3: Format Context for LLM
    // ==========================================================================

    const specContext = formatSpecsForContext(allSpecs);
    const codeContext = formatCodeSectionsForContext(
      complianceData.textContext,
      complianceData.tableContext
    );

    // ==========================================================================
    // Step 4: Generate Control Plan via LLM
    // ==========================================================================

    console.log("[ControlPlan] Step 3: Synthesizing control plan with LLM...");

    const userPrompt = `## CONSTRUCTION PHASE: ${constructionPhase.toUpperCase()}
${date ? `## DATE: ${date}` : ""}

## PROJECT INFORMATION
**Name:** ${projectData?.name || "Unknown"}
**Description:** ${projectData?.description || "N/A"}
**Occupancy:** ${projectData?.occupancy_group || "N/A"}
**Construction Type:** ${projectData?.construction_type || "N/A"}

---

## PROJECT SPECIFICATIONS (Design Requirements)

${specContext}

---

## BUILDING CODE REQUIREMENTS (Code Compliance)

${codeContext}

---

## YOUR TASK

Generate a Daily Inspection Control Plan for the **${constructionPhase}** phase.

For each inspection item:
1. If BOTH spec AND code apply to a parameter, use the MORE STRINGENT requirement as the target
2. Always cite the source (spec document, code section, or both)
3. Include practical inspection methods

Focus on MEASURABLE items that an inspector can verify in the field today.`;

    const completion = await openai.chat.completions.create({
      model: MODELS.REASONING,
      messages: [
        { role: "system", content: CONTROL_PLAN_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2, // Low for consistent output
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No response from LLM");
    }

    // Parse LLM response
    let parsedResponse: Record<string, unknown>;
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("[ControlPlan] Failed to parse LLM response:", responseContent);
      throw new Error("Failed to parse control plan from LLM response");
    }

    // Extract items array
    let controlPlanItems: ControlPlanItem[] = [];

    if (Array.isArray(parsedResponse.items)) {
      controlPlanItems = parsedResponse.items as ControlPlanItem[];
    } else if (Array.isArray(parsedResponse)) {
      controlPlanItems = parsedResponse as ControlPlanItem[];
    } else {
      // Try to find any array property
      for (const key of Object.keys(parsedResponse)) {
        if (Array.isArray(parsedResponse[key])) {
          controlPlanItems = parsedResponse[key] as ControlPlanItem[];
          break;
        }
      }
    }

    console.log(`[ControlPlan] Generated ${controlPlanItems.length} control plan items`);

    if (controlPlanItems.length === 0) {
      throw new Error("LLM returned empty control plan");
    }

    // ==========================================================================
    // Step 5: Create Checklist and Insert Items
    // ==========================================================================

    console.log("[ControlPlan] Step 4: Creating checklist and inserting items...");

    // Create a new checklist for this control plan
    const checklistTitle = date
      ? `${constructionPhase} Control Plan - ${date}`
      : `${constructionPhase} Control Plan - ${new Date().toISOString().split("T")[0]}`;

    const { data: checklist, error: checklistError } = await supabase
      .from("checklists")
      .insert({
        project_id: projectId,
        title: checklistTitle,
        description: `Automated control plan for ${constructionPhase} phase inspection. Generated from project specifications and building code requirements.`,
        status: "active",
      })
      .select()
      .single();

    if (checklistError) {
      console.error("[ControlPlan] Failed to create checklist:", checklistError);
      throw new Error(`Failed to create checklist: ${checklistError.message}`);
    }

    // Build checklist items with parameter data and source tagging
    const checklistItems = controlPlanItems.map((item, index) => {
      // Build the requirement text combining inspection item and method
      const requirementText = `${item.inspection_item}${item.inspection_method ? ` (Method: ${item.inspection_method})` : ""}`;

      // Build code reference combining spec and code references
      const codeRefs: string[] = [];
      if (item.code_reference) codeRefs.push(item.code_reference);
      if (item.spec_reference) codeRefs.push(`Spec: ${item.spec_reference}`);
      const codeReference = codeRefs.length > 0 ? codeRefs.join(" | ") : null;

      // Build notes with source and limits info
      const notes: Record<string, unknown> = {
        source: "automated_control_plan",
        control_plan_source: item.source,
        riskLevel: item.priority,
        category: constructionPhase,
        spec_limit: item.spec_limit,
        code_limit: item.code_limit,
        inspection_method: item.inspection_method,
        generated_at: new Date().toISOString(),
      };

      return {
        checklist_id: checklist.id,
        requirement_text: requirementText,
        code_reference: codeReference,
        sort_order: index,
        notes: JSON.stringify(notes),
        // Parameter validation fields
        parameter_name: item.parameter_name,
        target_value: buildTargetValueFromControlItem(item),
        unit: item.unit,
        comparison_logic: determineComparisonLogic(item.target_value),
        validation_result: "not_measured",
      };
    });

    const { data: insertedItems, error: itemsError } = await supabase
      .from("checklist_items")
      .insert(checklistItems)
      .select();

    if (itemsError) {
      console.error("[ControlPlan] Failed to insert items:", itemsError);
      // Clean up checklist
      await supabase.from("checklists").delete().eq("id", checklist.id);
      throw new Error(`Failed to create checklist items: ${itemsError.message}`);
    }

    console.log(`[ControlPlan] Created checklist ${checklist.id} with ${insertedItems?.length} items`);

    // ==========================================================================
    // Step 6: Return Response
    // ==========================================================================

    return NextResponse.json({
      success: true,
      checklist: {
        id: checklist.id,
        title: checklist.title,
        description: checklist.description,
        status: checklist.status,
        itemCount: insertedItems?.length || 0,
      },
      controlPlan: {
        phase: constructionPhase,
        date: date || new Date().toISOString().split("T")[0],
        items: controlPlanItems.map((item, index) => ({
          ...item,
          id: insertedItems?.[index]?.id,
        })),
      },
      stats: {
        projectSpecsUsed: allSpecs.length,
        codeSectionsUsed: complianceData.textChunks.length,
        tablesUsed: complianceData.tableContext.length,
        itemsGenerated: controlPlanItems.length,
        itemsBySource: {
          spec: controlPlanItems.filter(i => i.source === "spec").length,
          code: controlPlanItems.filter(i => i.source === "code").length,
          both: controlPlanItems.filter(i => i.source === "both").length,
        },
        itemsByPriority: {
          critical: controlPlanItems.filter(i => i.priority === "critical").length,
          high: controlPlanItems.filter(i => i.priority === "high").length,
          medium: controlPlanItems.filter(i => i.priority === "medium").length,
          low: controlPlanItems.filter(i => i.priority === "low").length,
        },
      },
    });
  } catch (error) {
    console.error("[ControlPlan] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate control plan",
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET Handler - List Available Construction Phases
// =============================================================================

export async function GET() {
  return NextResponse.json({
    phases: Object.keys(PHASE_TO_CSI_DIVISIONS),
    csiDivisionMapping: PHASE_TO_CSI_DIVISIONS,
    codeChapterMapping: PHASE_TO_CODE_CHAPTERS,
  });
}
