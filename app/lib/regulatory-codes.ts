/**
 * Regulatory Code Retrieval
 *
 * This module handles retrieval of relevant building code sections.
 * Currently using mock data - will be replaced with vector store retrieval.
 */

import type { RegulatoryCodeSnippet } from "./types/compliance";

/**
 * Mock regulatory code database
 * In production, this would be retrieved from a vector store (e.g., Pinecone, Supabase pgvector)
 * based on semantic similarity to the defect description.
 */
const MOCK_CODE_DATABASE: Record<string, RegulatoryCodeSnippet[]> = {
  florida: [
    {
      codeId: "FBC",
      codeName: "Florida Building Code",
      version: "2023 (8th Edition)",
      jurisdiction: "Florida",
      section: "1012.2",
      sectionTitle: "Slope",
      content: `1012.2 Slope. Ramp runs shall have a running slope not steeper than one unit vertical in 12 units horizontal (8.33-percent slope). The slope measured along the center of the ramp run shall be uniform and consistent with the cross slope. Where existing site constraints make it impractical to provide a ramp with a slope of 1:12 or less, ramps shall be permitted with slopes and rises as follows:

1. A slope not steeper than 1:10 is permitted for a maximum rise of 6 inches (152 mm).
2. A slope not steeper than 1:8 is permitted for a maximum rise of 3 inches (76 mm).

Exception: An aisle ramp in assembly seating areas shall comply with Section 1029.14.`,
      relatedSections: ["1012.3", "1012.4", "1012.5"],
    },
    {
      codeId: "FBC",
      codeName: "Florida Building Code",
      version: "2023 (8th Edition)",
      jurisdiction: "Florida",
      section: "1012.3",
      sectionTitle: "Cross Slope",
      content: `1012.3 Cross slope. The cross slope of ramp runs shall not be steeper than one unit vertical in 48 units horizontal (2-percent slope).`,
      relatedSections: ["1012.2"],
    },
    {
      codeId: "FBC",
      codeName: "Florida Building Code",
      version: "2023 (8th Edition)",
      jurisdiction: "Florida",
      section: "1012.4",
      sectionTitle: "Rise",
      content: `1012.4 Rise. The maximum rise of any ramp run shall be 30 inches (762 mm).`,
      relatedSections: ["1012.2"],
    },
    {
      codeId: "FBC",
      codeName: "Florida Building Code",
      version: "2023 (8th Edition)",
      jurisdiction: "Florida",
      section: "1009.3",
      sectionTitle: "Stairway Width",
      content: `1009.3 Stairway width. The width of stairways shall be determined as specified in Section 1005.1, but such width shall not be less than 44 inches (1118 mm). Stairways serving an occupant load of less than 50 shall have a width of not less than 36 inches (914 mm).

Exceptions:
1. Spiral stairways shall comply with Section 1009.12.
2. Alternating tread devices shall comply with Section 1009.13.`,
      relatedSections: ["1009.4", "1009.5", "1005.1"],
    },
    {
      codeId: "FBC",
      codeName: "Florida Building Code",
      version: "2023 (8th Edition)",
      jurisdiction: "Florida",
      section: "1003.5",
      sectionTitle: "Egress Floor Surface",
      content: `1003.5 Floor surface. Walking surfaces of the means of egress shall have a slip-resistant surface and be securely attached. The coefficient of friction shall be not less than 0.50 when tested in accordance with ASTM C1028.`,
      relatedSections: ["1003.4"],
    },
    {
      codeId: "FBC",
      codeName: "Florida Building Code",
      version: "2023 (8th Edition)",
      jurisdiction: "Florida",
      section: "1020.1",
      sectionTitle: "Corridor Width and Capacity",
      content: `1020.1 Construction. Corridors shall be fire-resistance rated in accordance with Table 1020.1. The corridor walls required to be fire-resistance rated shall comply with Section 708 for fire partitions.

Corridors shall have a ceiling height of not less than 7 feet 6 inches (2286 mm). The required width of corridors shall be unobstructed.

Exception: Doors complying with Section 1005.2.`,
      relatedSections: ["1020.2", "708"],
    },
    {
      codeId: "FBC-FIRE",
      codeName: "Florida Fire Prevention Code",
      version: "2023 (8th Edition)",
      jurisdiction: "Florida",
      section: "903.2.1",
      sectionTitle: "Automatic Sprinkler Systems - Group A",
      content: `903.2.1 Group A. An automatic sprinkler system shall be provided throughout buildings containing a Group A occupancy where one of the following conditions exists:

1. The fire area exceeds 12,000 square feet (1115 m²).
2. The fire area has an occupant load of 300 or more.
3. The fire area is located on a floor other than a level of exit discharge serving such occupancies.`,
      relatedSections: ["903.2.2", "903.3"],
    },
    {
      codeId: "FBC",
      codeName: "Florida Building Code",
      version: "2023 (8th Edition)",
      jurisdiction: "Florida",
      section: "1011.5.2",
      sectionTitle: "Riser Height and Tread Depth",
      content: `1011.5.2 Riser height and tread depth. Stair riser heights shall be 7 inches (178 mm) maximum and 4 inches (102 mm) minimum. Stair tread depths shall be 11 inches (279 mm) minimum. The riser height shall be measured vertically between the nosings of adjacent treads. The tread depth shall be measured horizontally between the vertical planes of the foremost projection of adjacent treads and at a right angle to the tread's nosing.

Winder treads shall have a minimum tread depth of 11 inches (279 mm) measured at a point 12 inches (305 mm) from the side where the treads are narrower.`,
      relatedSections: ["1011.5.3", "1011.5.4"],
    },
  ],
  california: [
    {
      codeId: "CBC",
      codeName: "California Building Code",
      version: "2022",
      jurisdiction: "California",
      section: "1133B.5.1",
      sectionTitle: "Ramp Slope",
      content: `1133B.5.1 Slope. The least possible slope shall be used for any ramp. The maximum slope of a ramp in new construction shall be 1:12. The maximum rise for any run shall be 30 inches (762 mm).

Exception: Ramps for changes in level of 6 inches (152 mm) or less may have a slope of 1:10. Ramps for changes in level of 3 inches (76 mm) or less may have slopes of 1:8.`,
      relatedSections: ["1133B.5.2", "1133B.5.3"],
    },
  ],
  // Add more jurisdictions as needed
};

/**
 * Retrieves relevant code snippets based on the jurisdiction and defect description.
 *
 * TODO: Replace with actual vector store retrieval using:
 * - Supabase pgvector for semantic search
 * - Or Pinecone/Weaviate for dedicated vector DB
 *
 * The implementation would:
 * 1. Generate embeddings for the defect description using OpenAI
 * 2. Query the vector store for semantically similar code sections
 * 3. Return the top-k most relevant snippets
 */
export async function retrieveRelevantCodes(
  defectDescription: string,
  jurisdiction: string
): Promise<RegulatoryCodeSnippet[]> {
  // Normalize jurisdiction
  const normalizedJurisdiction = jurisdiction.toLowerCase().trim();

  // Get codes for the jurisdiction
  const jurisdictionCodes = MOCK_CODE_DATABASE[normalizedJurisdiction] || [];

  if (jurisdictionCodes.length === 0) {
    // Fall back to a default/international code if jurisdiction not found
    console.warn(`No codes found for jurisdiction: ${jurisdiction}. Using default codes.`);
    return MOCK_CODE_DATABASE["florida"] || [];
  }

  // Mock semantic search: In production, this would use vector similarity
  // For now, we do simple keyword matching to simulate retrieval
  const keywords = extractKeywords(defectDescription);

  const scoredCodes = jurisdictionCodes.map((code) => {
    const contentLower = code.content.toLowerCase();
    const titleLower = code.sectionTitle.toLowerCase();

    let score = 0;
    for (const keyword of keywords) {
      if (contentLower.includes(keyword)) score += 2;
      if (titleLower.includes(keyword)) score += 3;
    }

    return { code, score };
  });

  // Sort by relevance score and return top matches
  const relevantCodes = scoredCodes
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.code);

  // If no relevant codes found, return the most commonly applicable ones
  if (relevantCodes.length === 0) {
    return jurisdictionCodes.slice(0, 2);
  }

  return relevantCodes;
}

/**
 * Extract keywords from defect description for mock retrieval
 */
function extractKeywords(text: string): string[] {
  const commonWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "to", "of",
    "in", "for", "on", "with", "at", "by", "from", "as", "into", "through",
    "during", "before", "after", "above", "below", "between", "under", "over",
    "detected", "found", "observed", "noted", "measured", "approximately",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !commonWords.has(word));
}

/**
 * Get all available jurisdictions
 */
export function getAvailableJurisdictions(): string[] {
  return Object.keys(MOCK_CODE_DATABASE);
}

/**
 * Get all codes for a specific jurisdiction
 */
export function getCodesForJurisdiction(jurisdiction: string): RegulatoryCodeSnippet[] {
  return MOCK_CODE_DATABASE[jurisdiction.toLowerCase()] || [];
}
