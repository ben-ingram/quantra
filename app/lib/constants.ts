// =============================================================================
// Project Constants
// =============================================================================

export type OccupancyGroup =
  | "Assembly"
  | "Business"
  | "Educational"
  | "Factory"
  | "High Hazard"
  | "Institutional"
  | "Mercantile"
  | "Residential"
  | "Storage"
  | "Utility";

export type ConstructionType =
  | "Type I-A"
  | "Type I-B"
  | "Type II-A"
  | "Type II-B"
  | "Type III-A"
  | "Type III-B"
  | "Type IV"
  | "Type V-A"
  | "Type V-B";

export const OCCUPANCY_GROUPS: OccupancyGroup[] = [
  "Assembly",
  "Business",
  "Educational",
  "Factory",
  "High Hazard",
  "Institutional",
  "Mercantile",
  "Residential",
  "Storage",
  "Utility",
];

export const CONSTRUCTION_TYPES: ConstructionType[] = [
  "Type I-A",
  "Type I-B",
  "Type II-A",
  "Type II-B",
  "Type III-A",
  "Type III-B",
  "Type IV",
  "Type V-A",
  "Type V-B",
];
