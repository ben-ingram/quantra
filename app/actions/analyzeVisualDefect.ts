"use server";

import { openai, MODELS } from "@/app/lib/openai";
import type { ColorToIdEntry } from "@/app/components/dashboard/HiddenBimRenderer";

// =============================================================================
// Types
// =============================================================================

export interface VisualDefectInput {
  /** Base64 data URL of the user's uploaded photo (e.g., "data:image/png;base64,...") */
  realImage: string;
  /** Base64 data URL of the color-coded BIM snapshot */
  syntheticImage: string;
  /** JSON object mapping Hex Colors to BIM Element data */
  colorMap: Record<string, ColorToIdEntry>;
}

export interface VisualDefectResult {
  /** The BIM element ID that was identified */
  elementId: string;
  /** The mesh name of the identified element */
  elementName: string;
  /** Description of the visual defect detected */
  defectDescription: string;
  /** The hex color identified in the synthetic image */
  identifiedColor: string;
  /** Confidence score from 0-1 */
  confidence: number;
  /** Additional BIM metadata from the element */
  elementData?: ColorToIdEntry;
  /** Raw response from the vision model for debugging */
  rawAnalysis?: string;
}

export interface VisualDefectError {
  error: string;
  code: "NO_DEFECT_FOUND" | "COLOR_NOT_IN_MAP" | "ANALYSIS_FAILED" | "INVALID_INPUT";
}

// =============================================================================
// Vision Analysis System Prompt
// =============================================================================

const VISUAL_RAG_SYSTEM_PROMPT = `You are a construction defect detection AI with expertise in Building Information Modeling (BIM). You analyze construction site photos to identify defects and correlate them with BIM elements.

## YOUR TASK

You will receive two images:
1. **Image 1 (Real Photo)**: A construction site photograph that may contain a visual defect.
2. **Image 2 (ID Map)**: A color-coded synthetic rendering of the same view where each distinct color represents a unique BIM element.

## ANALYSIS STEPS

1. **Identify the Defect**: Examine Image 1 carefully. Look for:
   - Structural issues (cracks, misalignment, damage)
   - Code violations (incorrect dimensions, missing safety features)
   - Quality defects (surface imperfections, improper installation)
   - Safety hazards (exposed wiring, tripping hazards, missing guards)

2. **Locate Spatial Coordinates**: Determine where in Image 1 the defect is located (e.g., center-left, upper-right quadrant, etc.).

3. **Cross-Reference with ID Map**: Find the same spatial location in Image 2. Identify the hex color of the BIM element at those coordinates.

4. **Report Findings**: Return the hex color and a detailed description of the defect.

## RESPONSE FORMAT

You MUST respond with a valid JSON object:
{
  "defectFound": true | false,
  "hexColor": "#RRGGBB" | null,
  "defectDescription": "Detailed description of the visual defect observed",
  "spatialLocation": "Description of where in the image the defect is located",
  "confidence": 0.0-1.0,
  "reasoning": "Explanation of how you identified the defect and matched it to the ID map"
}

## IMPORTANT RULES

1. The hex color MUST be in uppercase format: #RRGGBB (e.g., #FF5733, #00AA22)
2. If no clear defect is visible, set defectFound to false
3. If you cannot determine the corresponding color in Image 2, set hexColor to null
4. Be specific in your defect description - include what type of defect, severity, and potential implications
5. The confidence score should reflect how certain you are about both the defect identification AND the color mapping

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
  if (/^[A-Za-z0-9+/=]+$/.test(image)) {
    // Detect image type from base64 header bytes
    const header = atob(image.substring(0, 16));
    let mimeType = "image/png"; // default

    if (header.startsWith("\xFF\xD8\xFF")) {
      mimeType = "image/jpeg";
    } else if (header.startsWith("\x89PNG")) {
      mimeType = "image/png";
    } else if (header.startsWith("GIF")) {
      mimeType = "image/gif";
    } else if (header.startsWith("RIFF") && header.includes("WEBP")) {
      mimeType = "image/webp";
    }

    return { valid: true, url: `data:${mimeType};base64,${image}` };
  }

  return { valid: false, url: "", error: "Invalid image format" };
}

/**
 * Normalizes a hex color to uppercase format
 */
function normalizeHexColor(color: string): string {
  if (!color) return "";

  // Remove any whitespace
  color = color.trim();

  // Ensure it starts with #
  if (!color.startsWith("#")) {
    color = "#" + color;
  }

  // Convert to uppercase
  return color.toUpperCase();
}

/**
 * Finds the closest matching color in the color map
 * Used as a fallback if exact match isn't found
 */
function findClosestColor(
  targetColor: string,
  colorMap: Record<string, ColorToIdEntry>
): { color: string; entry: ColorToIdEntry; distance: number } | null {
  if (!targetColor || Object.keys(colorMap).length === 0) {
    return null;
  }

  // Parse target color
  const target = hexToRgb(targetColor);
  if (!target) return null;

  let closestColor = "";
  let closestEntry: ColorToIdEntry | null = null;
  let minDistance = Infinity;

  for (const [color, entry] of Object.entries(colorMap)) {
    const rgb = hexToRgb(color);
    if (!rgb) continue;

    // Calculate Euclidean distance in RGB space
    const distance = Math.sqrt(
      Math.pow(target.r - rgb.r, 2) +
      Math.pow(target.g - rgb.g, 2) +
      Math.pow(target.b - rgb.b, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
      closestEntry = entry;
    }
  }

  if (closestEntry && minDistance < 50) {
    // Only return if reasonably close (threshold of 50 in RGB space)
    return { color: closestColor, entry: closestEntry, distance: minDistance };
  }

  return null;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// =============================================================================
// Main Analysis Function
// =============================================================================

/**
 * Analyzes a construction site photo against a BIM ID map to identify defects
 * and correlate them with specific BIM elements.
 *
 * @param input - The visual defect analysis input
 * @returns The identified element and defect description, or an error
 */
export async function analyzeVisualDefect(
  input: VisualDefectInput
): Promise<VisualDefectResult | VisualDefectError> {
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

  if (!input.colorMap || Object.keys(input.colorMap).length === 0) {
    return {
      error: "Color map is required and must not be empty",
      code: "INVALID_INPUT",
    };
  }

  console.log("[VisualRAG] Starting visual defect analysis...");
  console.log(`[VisualRAG] Color map has ${Object.keys(input.colorMap).length} entries`);

  try {
    // Call GPT-4o with vision capability
    const completion = await openai.chat.completions.create({
      model: MODELS.VISION,
      messages: [
        {
          role: "system",
          content: VISUAL_RAG_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze these two images. Image 1 is a construction site photo that may contain a defect. Image 2 is the color-coded BIM ID map of the same view. Identify any defects and return the corresponding hex color from the ID map.",
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
      max_tokens: 1000,
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

    console.log("[VisualRAG] Got vision model response");

    // Parse the response
    let parsed: {
      defectFound: boolean;
      hexColor: string | null;
      defectDescription: string;
      spatialLocation: string;
      confidence: number;
      reasoning: string;
    };

    try {
      parsed = JSON.parse(responseContent);
    } catch {
      console.error("[VisualRAG] Failed to parse response:", responseContent);
      return {
        error: "Failed to parse vision model response",
        code: "ANALYSIS_FAILED",
      };
    }

    // Check if a defect was found
    if (!parsed.defectFound) {
      return {
        error: "No visual defect detected in the image",
        code: "NO_DEFECT_FOUND",
      };
    }

    // Check if we got a hex color
    if (!parsed.hexColor) {
      return {
        error: "Could not determine the corresponding BIM element color",
        code: "ANALYSIS_FAILED",
      };
    }

    // Normalize the hex color
    const normalizedColor = normalizeHexColor(parsed.hexColor);
    console.log(`[VisualRAG] Identified color: ${normalizedColor}`);

    // Look up the element in the color map
    let elementData = input.colorMap[normalizedColor];
    let matchedColor = normalizedColor;

    // If exact match not found, try to find closest color
    if (!elementData) {
      console.log(`[VisualRAG] Exact color match not found, searching for closest...`);
      const closest = findClosestColor(normalizedColor, input.colorMap);

      if (closest) {
        console.log(`[VisualRAG] Found closest color: ${closest.color} (distance: ${closest.distance.toFixed(2)})`);
        elementData = closest.entry;
        matchedColor = closest.color;
      } else {
        return {
          error: `Color ${normalizedColor} not found in BIM color map`,
          code: "COLOR_NOT_IN_MAP",
        };
      }
    }

    const processingTimeMs = Date.now() - startTime;
    console.log(`[VisualRAG] Analysis complete in ${processingTimeMs}ms`);

    // Build the result
    return {
      elementId: elementData.meshId,
      elementName: elementData.meshName,
      defectDescription: parsed.defectDescription,
      identifiedColor: matchedColor,
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      elementData,
      rawAnalysis: JSON.stringify({
        spatialLocation: parsed.spatialLocation,
        reasoning: parsed.reasoning,
        processingTimeMs,
      }),
    };
  } catch (error) {
    console.error("[VisualRAG] Analysis error:", error);
    return {
      error: error instanceof Error ? error.message : "Unknown error during analysis",
      code: "ANALYSIS_FAILED",
    };
  }
}
