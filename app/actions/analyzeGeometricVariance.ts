"use server";

import { openai, MODELS } from "@/app/lib/openai";

// =============================================================================
// Types
// =============================================================================

export interface BimMetadata {
  /** The element identifier (e.g., "Stair_01", "Door_North_101") */
  element: string;
  /** The specific dimension being measured */
  dimensionType:
    | "riserHeight"
    | "treadDepth"
    | "stairWidth"
    | "headroom"
    | "doorWidth"
    | "doorHeight"
    | "corridorWidth"
    | "rampSlope"
    | "handrailHeight"
    | "custom";
  /** The designed/expected dimension value from BIM */
  designedValue: number;
  /** Unit of measurement */
  unit: "inches" | "feet" | "meters" | "centimeters" | "degrees" | "ratio";
  /** Optional: Human-readable label for the dimension */
  dimensionLabel?: string;
  /** Optional: Code requirement for this dimension */
  codeRequirement?: {
    minimum?: number;
    maximum?: number;
    codeReference?: string;
  };
}

export interface GeometricVarianceInput {
  /** Base64 data URL of the real construction photo (As-Built) */
  realImage: string;
  /** Base64 data URL of the BIM render from the same angle (As-Designed) */
  syntheticImage: string;
  /** BIM metadata containing the designed dimensions */
  bimMetadata: BimMetadata;
}

export interface GeometricVarianceResult {
  /** Whether a visual deviation was detected */
  hasVisualDeviation: boolean;
  /** The estimated real dimension based on visual analysis */
  estimatedDimension: number;
  /** The deviation percentage (positive = larger, negative = smaller) */
  deviationPercentage: number;
  /** The absolute difference from designed value */
  absoluteDeviation: number;
  /** Detailed explanation of the visual comparison */
  visualReasoning: string;
  /** Specific observations about the deviation */
  deviationDetails: {
    direction: "larger" | "smaller" | "aligned" | "unknown";
    confidence: number;
    affectedArea?: string;
  };
  /** Compliance assessment if code requirements were provided */
  complianceAssessment?: {
    meetsMinimum: boolean | null;
    meetsMaximum: boolean | null;
    isCompliant: boolean;
    codeReference?: string;
    explanation: string;
  };
  /** Processing metadata */
  metadata: {
    processingTimeMs: number;
    model: string;
  };
}

export interface GeometricVarianceError {
  error: string;
  code: "INVALID_INPUT" | "ANALYSIS_FAILED" | "CANNOT_COMPARE" | "LOW_CONFIDENCE";
}

// =============================================================================
// Vision Analysis System Prompt
// =============================================================================

const GEOMETRIC_VARIANCE_SYSTEM_PROMPT = `You are an expert Construction Superintendent with decades of experience comparing "As-Built" construction against "As-Designed" BIM models. Your specialty is detecting dimensional variances between real construction and design specifications.

## YOUR ROLE

You will receive two images for comparison:
1. **Image 1 (As-Built)**: A real photograph of the construction site showing the actual built element.
2. **Image 2 (As-Designed)**: A rendered image from the BIM model showing the designed/intended geometry.

Image 2 is the GROUND TRUTH. It represents the perfect design intent from the BIM model.

## YOUR TASK

Compare the specific element and dimension provided in the metadata. Analyze whether the real construction (Image 1) matches the designed geometry (Image 2).

## ANALYSIS METHODOLOGY

1. **Identify the Element**: Locate the specified element in both images.

2. **Establish Reference Points**: Use surrounding context (doors, windows, people, standard objects) to establish scale reference.

3. **Compare Proportions**: Compare the proportional relationships in Image 1 vs Image 2:
   - Is the element taller/shorter?
   - Is it wider/narrower?
   - Is the spacing different?
   - Are angles correct?

4. **Estimate Deviation**: Based on visual proportions, estimate the percentage deviation:
   - Positive percentage = element is LARGER than designed
   - Negative percentage = element is SMALLER than designed
   - Zero = element appears to match design

5. **Calculate Real Dimension**: Apply your estimated deviation to the provided designed dimension.
   - Formula: estimatedReal = designed × (1 + deviationPercentage/100)

## IMPORTANT GUIDELINES

- Be conservative in your estimates. Construction photography has perspective distortion.
- If you cannot make a reliable comparison, indicate low confidence.
- Focus on the SPECIFIC dimension mentioned, not general appearance.
- Consider that minor deviations (under 3%) may be within acceptable tolerance.
- Use visual cues like:
  - Standard brick/block sizes (typically 8" × 4" × 2.25")
  - Standard door heights (typically 80" or 84")
  - Human proportions if people are visible
  - Tile/flooring patterns

## RESPONSE FORMAT

You MUST respond with a valid JSON object:
{
  "hasVisualDeviation": true | false,
  "deviationPercentage": <number>,
  "direction": "larger" | "smaller" | "aligned" | "unknown",
  "estimatedDimension": <number>,
  "confidence": 0.0-1.0,
  "visualReasoning": "Detailed explanation of your comparison methodology and observations",
  "affectedArea": "Description of what part of the element shows deviation",
  "comparisonNotes": "Any additional observations about the comparison"
}

## CONFIDENCE LEVELS

- 0.9-1.0: Clear view, good reference points, obvious deviation or alignment
- 0.7-0.9: Reasonable view, some reference points, probable assessment
- 0.5-0.7: Partial view or limited reference, tentative assessment
- Below 0.5: Poor conditions, indicate "unknown" direction

Do not include any text outside the JSON object.`;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validates and normalizes a base64 image string
 */
function validateBase64Image(image: string): { valid: boolean; url: string; error?: string } {
  if (!image) {
    return { valid: false, url: "", error: "Image is required" };
  }

  // Check if it's already a data URL
  if (image.startsWith("data:image/")) {
    return { valid: true, url: image };
  }

  // Check if it's raw base64 and add data URL prefix
  if (/^[A-Za-z0-9+/=]+$/.test(image.substring(0, 100))) {
    // Default to PNG if we can't detect
    return { valid: true, url: `data:image/png;base64,${image}` };
  }

  return { valid: false, url: "", error: "Invalid image format" };
}

/**
 * Get a human-readable label for dimension types
 */
function getDimensionLabel(type: BimMetadata["dimensionType"], custom?: string): string {
  const labels: Record<string, string> = {
    riserHeight: "Stair Riser Height",
    treadDepth: "Stair Tread Depth",
    stairWidth: "Stair Width",
    headroom: "Headroom Clearance",
    doorWidth: "Door Width",
    doorHeight: "Door Height",
    corridorWidth: "Corridor Width",
    rampSlope: "Ramp Slope",
    handrailHeight: "Handrail Height",
    custom: custom || "Custom Dimension",
  };
  return labels[type] || type;
}

// =============================================================================
// Main Analysis Function
// =============================================================================

/**
 * Analyzes geometric variance between an as-built photo and a BIM render
 * to detect dimensional deviations in construction.
 *
 * @param input - The geometric variance analysis input
 * @returns The variance analysis result or an error
 */
export async function analyzeGeometricVariance(
  input: GeometricVarianceInput
): Promise<GeometricVarianceResult | GeometricVarianceError> {
  const startTime = Date.now();

  // Validate inputs
  const realImageValidation = validateBase64Image(input.realImage);
  if (!realImageValidation.valid) {
    return {
      error: `Invalid real image: ${realImageValidation.error}`,
      code: "INVALID_INPUT",
    };
  }

  const syntheticImageValidation = validateBase64Image(input.syntheticImage);
  if (!syntheticImageValidation.valid) {
    return {
      error: `Invalid synthetic image: ${syntheticImageValidation.error}`,
      code: "INVALID_INPUT",
    };
  }

  if (!input.bimMetadata || !input.bimMetadata.element) {
    return {
      error: "BIM metadata with element identifier is required",
      code: "INVALID_INPUT",
    };
  }

  if (typeof input.bimMetadata.designedValue !== "number" || isNaN(input.bimMetadata.designedValue)) {
    return {
      error: "Valid designed dimension value is required",
      code: "INVALID_INPUT",
    };
  }

  const dimensionLabel = getDimensionLabel(
    input.bimMetadata.dimensionType,
    input.bimMetadata.dimensionLabel
  );

  console.log("[GeometricVariance] Starting analysis...");
  console.log(`[GeometricVariance] Element: ${input.bimMetadata.element}`);
  console.log(`[GeometricVariance] Dimension: ${dimensionLabel} = ${input.bimMetadata.designedValue} ${input.bimMetadata.unit}`);

  try {
    // Build the user prompt with specific metadata
    const userPrompt = `Analyze these two images for geometric variance.

**Element to Compare:** ${input.bimMetadata.element}
**Dimension to Measure:** ${dimensionLabel}
**Designed Value (BIM):** ${input.bimMetadata.designedValue} ${input.bimMetadata.unit}
${input.bimMetadata.codeRequirement ? `
**Code Requirements:**
- Minimum: ${input.bimMetadata.codeRequirement.minimum ?? "N/A"} ${input.bimMetadata.unit}
- Maximum: ${input.bimMetadata.codeRequirement.maximum ?? "N/A"} ${input.bimMetadata.unit}
- Reference: ${input.bimMetadata.codeRequirement.codeReference ?? "N/A"}
` : ""}

Image 1 is the REAL construction photo (As-Built).
Image 2 is the BIM model render (As-Designed) - this is the ground truth.

Compare the ${dimensionLabel.toLowerCase()} of ${input.bimMetadata.element} between the two images. Estimate any deviation and calculate the estimated real dimension.`;

    // Call GPT-4o with vision capability
    const completion = await openai.chat.completions.create({
      model: MODELS.VISION,
      messages: [
        {
          role: "system",
          content: GEOMETRIC_VARIANCE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: realImageValidation.url,
                detail: "high",
              },
            },
            {
              type: "image_url",
              image_url: {
                url: syntheticImageValidation.url,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 1500,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      return {
        error: "No response received from vision model",
        code: "ANALYSIS_FAILED",
      };
    }

    console.log("[GeometricVariance] Got vision model response");

    // Parse the response
    let parsed: {
      hasVisualDeviation: boolean;
      deviationPercentage: number;
      direction: "larger" | "smaller" | "aligned" | "unknown";
      estimatedDimension: number;
      confidence: number;
      visualReasoning: string;
      affectedArea?: string;
      comparisonNotes?: string;
    };

    try {
      parsed = JSON.parse(responseContent);
    } catch {
      console.error("[GeometricVariance] Failed to parse response:", responseContent);
      return {
        error: "Failed to parse vision model response",
        code: "ANALYSIS_FAILED",
      };
    }

    // Validate confidence
    if (parsed.confidence < 0.3) {
      return {
        error: `Analysis confidence too low (${Math.round(parsed.confidence * 100)}%). Cannot make reliable comparison.`,
        code: "LOW_CONFIDENCE",
      };
    }

    // Calculate values (use model's estimate or calculate from deviation)
    const deviationPercentage = parsed.deviationPercentage || 0;
    const estimatedDimension = parsed.estimatedDimension ||
      input.bimMetadata.designedValue * (1 + deviationPercentage / 100);
    const absoluteDeviation = Math.abs(estimatedDimension - input.bimMetadata.designedValue);

    // Determine if there's a meaningful deviation (threshold: 2%)
    const hasVisualDeviation = parsed.hasVisualDeviation ?? Math.abs(deviationPercentage) > 2;

    // Assess compliance if code requirements were provided
    let complianceAssessment: GeometricVarianceResult["complianceAssessment"] | undefined;

    if (input.bimMetadata.codeRequirement) {
      const req = input.bimMetadata.codeRequirement;
      const meetsMinimum = req.minimum != null ? estimatedDimension >= req.minimum : null;
      const meetsMaximum = req.maximum != null ? estimatedDimension <= req.maximum : null;

      const isCompliant =
        (meetsMinimum === null || meetsMinimum) &&
        (meetsMaximum === null || meetsMaximum);

      let explanation = "";
      if (!isCompliant) {
        if (meetsMinimum === false) {
          explanation = `Estimated ${dimensionLabel.toLowerCase()} (${estimatedDimension.toFixed(2)} ${input.bimMetadata.unit}) is below minimum requirement of ${req.minimum} ${input.bimMetadata.unit}.`;
        } else if (meetsMaximum === false) {
          explanation = `Estimated ${dimensionLabel.toLowerCase()} (${estimatedDimension.toFixed(2)} ${input.bimMetadata.unit}) exceeds maximum requirement of ${req.maximum} ${input.bimMetadata.unit}.`;
        }
      } else {
        explanation = `Estimated ${dimensionLabel.toLowerCase()} (${estimatedDimension.toFixed(2)} ${input.bimMetadata.unit}) meets code requirements.`;
      }

      complianceAssessment = {
        meetsMinimum,
        meetsMaximum,
        isCompliant,
        codeReference: req.codeReference,
        explanation,
      };
    }

    const processingTimeMs = Date.now() - startTime;
    console.log(`[GeometricVariance] Analysis complete in ${processingTimeMs}ms`);

    // Build the result
    return {
      hasVisualDeviation,
      estimatedDimension: Math.round(estimatedDimension * 100) / 100, // Round to 2 decimal places
      deviationPercentage: Math.round(deviationPercentage * 10) / 10, // Round to 1 decimal place
      absoluteDeviation: Math.round(absoluteDeviation * 100) / 100,
      visualReasoning: parsed.visualReasoning,
      deviationDetails: {
        direction: parsed.direction || (deviationPercentage > 0 ? "larger" : deviationPercentage < 0 ? "smaller" : "aligned"),
        confidence: parsed.confidence,
        affectedArea: parsed.affectedArea,
      },
      complianceAssessment,
      metadata: {
        processingTimeMs,
        model: MODELS.VISION,
      },
    };
  } catch (error) {
    console.error("[GeometricVariance] Analysis error:", error);
    return {
      error: error instanceof Error ? error.message : "Unknown error during analysis",
      code: "ANALYSIS_FAILED",
    };
  }
}

// =============================================================================
// Convenience Function for Common Checks
// =============================================================================

/**
 * Quick check for stair riser height compliance
 */
export async function checkStairRiserVariance(
  realImage: string,
  syntheticImage: string,
  elementName: string,
  designedRiserHeight: number
): Promise<GeometricVarianceResult | GeometricVarianceError> {
  return analyzeGeometricVariance({
    realImage,
    syntheticImage,
    bimMetadata: {
      element: elementName,
      dimensionType: "riserHeight",
      designedValue: designedRiserHeight,
      unit: "inches",
      codeRequirement: {
        minimum: 4,
        maximum: 7.75, // FBC maximum riser height
        codeReference: "FBC 1011.5.2",
      },
    },
  });
}

/**
 * Quick check for stair tread depth compliance
 */
export async function checkStairTreadVariance(
  realImage: string,
  syntheticImage: string,
  elementName: string,
  designedTreadDepth: number
): Promise<GeometricVarianceResult | GeometricVarianceError> {
  return analyzeGeometricVariance({
    realImage,
    syntheticImage,
    bimMetadata: {
      element: elementName,
      dimensionType: "treadDepth",
      designedValue: designedTreadDepth,
      unit: "inches",
      codeRequirement: {
        minimum: 11, // FBC minimum tread depth
        codeReference: "FBC 1011.5.2",
      },
    },
  });
}

/**
 * Quick check for door width compliance
 */
export async function checkDoorWidthVariance(
  realImage: string,
  syntheticImage: string,
  elementName: string,
  designedDoorWidth: number
): Promise<GeometricVarianceResult | GeometricVarianceError> {
  return analyzeGeometricVariance({
    realImage,
    syntheticImage,
    bimMetadata: {
      element: elementName,
      dimensionType: "doorWidth",
      designedValue: designedDoorWidth,
      unit: "inches",
      codeRequirement: {
        minimum: 32, // FBC minimum egress door width
        codeReference: "FBC 1010.1.1",
      },
    },
  });
}

/**
 * Quick check for corridor width compliance
 */
export async function checkCorridorWidthVariance(
  realImage: string,
  syntheticImage: string,
  elementName: string,
  designedCorridorWidth: number
): Promise<GeometricVarianceResult | GeometricVarianceError> {
  return analyzeGeometricVariance({
    realImage,
    syntheticImage,
    bimMetadata: {
      element: elementName,
      dimensionType: "corridorWidth",
      designedValue: designedCorridorWidth,
      unit: "inches",
      codeRequirement: {
        minimum: 44, // FBC minimum corridor width
        codeReference: "FBC 1020.2",
      },
    },
  });
}
