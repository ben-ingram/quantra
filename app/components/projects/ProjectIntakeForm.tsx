"use client";

import { useState } from "react";
import {
  Building2,
  MapPin,
  Ruler,
  Flame,
  Wind,
  Waves,
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Save,
  Loader2,
  Info,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

export interface ProjectIntakeData {
  // Basic Info (from existing project)
  name: string;
  address: string;
  occupancy_group: string;
  construction_type: string;

  // Occupancy Details
  occupancy_subtype: string;
  mixed_occupancies: string[];
  occupant_load: number | null;

  // Building Characteristics
  number_of_stories: number | null;
  building_height_ft: number | null;
  total_area_sqft: number | null;
  is_sprinklered: boolean;
  fire_alarm_type: string;

  // Florida Location
  florida_county: string;
  flood_zone: string;
  wind_speed_mph: number | null;
  is_coastal_construction: boolean;

  // Special Features
  is_high_rise: boolean;
  has_assembly_areas: boolean;
  has_hazardous_materials: boolean;
  has_high_piled_storage: boolean;
  special_features: string[];

  // Project Phase
  project_phase: string;
}

interface ProjectIntakeFormProps {
  initialData?: Partial<ProjectIntakeData>;
  onSave: (data: ProjectIntakeData) => Promise<void>;
  onCancel?: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const OCCUPANCY_SUBTYPES: Record<string, { value: string; label: string; description: string }[]> = {
  "Assembly": [
    { value: "A-1", label: "A-1", description: "Fixed seating (theaters, concert halls)" },
    { value: "A-2", label: "A-2", description: "Food/drink consumption (restaurants, bars)" },
    { value: "A-3", label: "A-3", description: "Worship, recreation (churches, gyms)" },
    { value: "A-4", label: "A-4", description: "Indoor viewing (arenas)" },
    { value: "A-5", label: "A-5", description: "Outdoor activities (stadiums)" },
  ],
  "Business": [
    { value: "B", label: "B", description: "Office, professional, service" },
  ],
  "Educational": [
    { value: "E", label: "E", description: "Schools through 12th grade" },
    { value: "E-Daycare", label: "E (Daycare)", description: "Daycare facilities (>5 children)" },
  ],
  "Factory": [
    { value: "F-1", label: "F-1", description: "Moderate hazard manufacturing" },
    { value: "F-2", label: "F-2", description: "Low hazard manufacturing" },
  ],
  "High Hazard": [
    { value: "H-1", label: "H-1", description: "Detonation hazard" },
    { value: "H-2", label: "H-2", description: "Deflagration/accelerated burning" },
    { value: "H-3", label: "H-3", description: "Physical/health hazard materials" },
    { value: "H-4", label: "H-4", description: "Health hazard materials" },
    { value: "H-5", label: "H-5", description: "HPM facilities (semiconductor)" },
  ],
  "Institutional": [
    { value: "I-1", label: "I-1", description: "Supervised residential (assisted living)" },
    { value: "I-2", label: "I-2", description: "Medical care (hospitals, nursing homes)" },
    { value: "I-3", label: "I-3", description: "Restrained (prisons, jails)" },
    { value: "I-4", label: "I-4", description: "Daycare (adults/infants)" },
  ],
  "Mercantile": [
    { value: "M", label: "M", description: "Retail, wholesale, sales" },
  ],
  "Residential": [
    { value: "R-1", label: "R-1", description: "Transient (hotels, motels)" },
    { value: "R-2", label: "R-2", description: "Multi-family (apartments, condos)" },
    { value: "R-3", label: "R-3", description: "1-2 family dwellings" },
    { value: "R-4", label: "R-4", description: "Residential care (5-16 persons)" },
  ],
  "Storage": [
    { value: "S-1", label: "S-1", description: "Moderate hazard storage" },
    { value: "S-2", label: "S-2", description: "Low hazard storage (parking garages)" },
  ],
  "Utility": [
    { value: "U", label: "U", description: "Accessory, agricultural" },
  ],
};

const FLORIDA_COUNTIES = [
  "Alachua", "Baker", "Bay", "Bradford", "Brevard", "Broward", "Calhoun", "Charlotte",
  "Citrus", "Clay", "Collier", "Columbia", "DeSoto", "Dixie", "Duval", "Escambia",
  "Flagler", "Franklin", "Gadsden", "Gilchrist", "Glades", "Gulf", "Hamilton", "Hardee",
  "Hendry", "Hernando", "Highlands", "Hillsborough", "Holmes", "Indian River", "Jackson",
  "Jefferson", "Lafayette", "Lake", "Lee", "Leon", "Levy", "Liberty", "Madison", "Manatee",
  "Marion", "Martin", "Miami-Dade", "Monroe", "Nassau", "Okaloosa", "Okeechobee", "Orange",
  "Osceola", "Palm Beach", "Pasco", "Pinellas", "Polk", "Putnam", "Santa Rosa", "Sarasota",
  "Seminole", "St. Johns", "St. Lucie", "Sumter", "Suwannee", "Taylor", "Union", "Volusia",
  "Wakulla", "Walton", "Washington"
];

const FLOOD_ZONES = [
  { value: "A", label: "Zone A", description: "High risk, no base flood elevation" },
  { value: "AE", label: "Zone AE", description: "High risk with base flood elevation" },
  { value: "AH", label: "Zone AH", description: "High risk, shallow flooding" },
  { value: "AO", label: "Zone AO", description: "High risk, sheet flow" },
  { value: "V", label: "Zone V", description: "Coastal high hazard" },
  { value: "VE", label: "Zone VE", description: "Coastal high hazard with elevation" },
  { value: "X", label: "Zone X (shaded)", description: "Moderate risk (500-year)" },
  { value: "X-unshaded", label: "Zone X (unshaded)", description: "Minimal risk" },
  { value: "D", label: "Zone D", description: "Undetermined risk" },
];

const FIRE_ALARM_TYPES = [
  { value: "none", label: "None Required" },
  { value: "manual", label: "Manual Only" },
  { value: "automatic", label: "Automatic Detection" },
  { value: "addressable", label: "Addressable System" },
  { value: "voice", label: "Voice Evacuation" },
  { value: "mass-notification", label: "Mass Notification" },
];

const PROJECT_PHASES = [
  { value: "design", label: "Design/Schematic" },
  { value: "permit", label: "Permit Application" },
  { value: "construction", label: "Under Construction" },
  { value: "inspection", label: "Final Inspection" },
  { value: "certificate", label: "Certificate of Occupancy" },
];

const SPECIAL_FEATURES = [
  { value: "atrium", label: "Atrium" },
  { value: "covered_mall", label: "Covered Mall" },
  { value: "underground", label: "Underground Building" },
  { value: "ambulatory_care", label: "Ambulatory Care" },
  { value: "live_work", label: "Live/Work Units" },
  { value: "group_home", label: "Group Home" },
  { value: "motor_vehicle", label: "Motor Vehicle Service" },
  { value: "aircraft_hangar", label: "Aircraft Hangar" },
  { value: "repair_garage", label: "Repair Garage" },
  { value: "stages_platforms", label: "Stages/Platforms" },
  { value: "mezzanine", label: "Mezzanine" },
  { value: "smoke_control", label: "Smoke Control System" },
];

// =============================================================================
// Component
// =============================================================================

export function ProjectIntakeForm({
  initialData,
  onSave,
  onCancel,
}: ProjectIntakeFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["occupancy", "building", "location", "special"])
  );

  const [formData, setFormData] = useState<ProjectIntakeData>({
    name: initialData?.name || "",
    address: initialData?.address || "",
    occupancy_group: initialData?.occupancy_group || "",
    construction_type: initialData?.construction_type || "",
    occupancy_subtype: initialData?.occupancy_subtype || "",
    mixed_occupancies: initialData?.mixed_occupancies || [],
    occupant_load: initialData?.occupant_load || null,
    number_of_stories: initialData?.number_of_stories || null,
    building_height_ft: initialData?.building_height_ft || null,
    total_area_sqft: initialData?.total_area_sqft || null,
    is_sprinklered: initialData?.is_sprinklered || false,
    fire_alarm_type: initialData?.fire_alarm_type || "",
    florida_county: initialData?.florida_county || "",
    flood_zone: initialData?.flood_zone || "",
    wind_speed_mph: initialData?.wind_speed_mph || null,
    is_coastal_construction: initialData?.is_coastal_construction || false,
    is_high_rise: initialData?.is_high_rise || false,
    has_assembly_areas: initialData?.has_assembly_areas || false,
    has_hazardous_materials: initialData?.has_hazardous_materials || false,
    has_high_piled_storage: initialData?.has_high_piled_storage || false,
    special_features: initialData?.special_features || [],
    project_phase: initialData?.project_phase || "design",
  });

  const toggleSection = (section: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(section)) {
      newSet.delete(section);
    } else {
      newSet.add(section);
    }
    setExpandedSections(newSet);
  };

  const updateField = <K extends keyof ProjectIntakeData>(
    field: K,
    value: ProjectIntakeData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: "mixed_occupancies" | "special_features", item: string) => {
    setFormData((prev) => {
      const current = prev[field];
      if (current.includes(item)) {
        return { ...prev, [field]: current.filter((i) => i !== item) };
      } else {
        return { ...prev, [field]: [...current, item] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  // Get subtypes for current occupancy group
  const subtypes = formData.occupancy_group
    ? OCCUPANCY_SUBTYPES[formData.occupancy_group] || []
    : [];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Occupancy Details Section */}
      <FormSection
        title="Occupancy Classification"
        icon={<Building2 className="w-4 h-4" />}
        expanded={expandedSections.has("occupancy")}
        onToggle={() => toggleSection("occupancy")}
      >
        <div className="grid grid-cols-2 gap-4">
          {/* Occupancy Subtype */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1">
              Specific Occupancy Subtype
            </label>
            <select
              value={formData.occupancy_subtype}
              onChange={(e) => updateField("occupancy_subtype", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select subtype...</option>
              {subtypes.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label} - {st.description}
                </option>
              ))}
            </select>
          </div>

          {/* Mixed Occupancies */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1">
              Mixed/Accessory Occupancies
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(OCCUPANCY_SUBTYPES)
                .filter((g) => g !== formData.occupancy_group)
                .map((group) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => toggleArrayItem("mixed_occupancies", group)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      formData.mixed_occupancies.includes(group)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground-muted hover:border-primary/50"
                    }`}
                  >
                    {group}
                  </button>
                ))}
            </div>
            <p className="text-xs text-foreground-muted mt-1">
              Select any additional occupancy groups present in the building
            </p>
          </div>

          {/* Occupant Load */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Occupant Load
            </label>
            <input
              type="number"
              value={formData.occupant_load || ""}
              onChange={(e) => updateField("occupant_load", e.target.value ? Number(e.target.value) : null)}
              placeholder="Total occupants"
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Project Phase */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Project Phase
            </label>
            <select
              value={formData.project_phase}
              onChange={(e) => updateField("project_phase", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {PROJECT_PHASES.map((phase) => (
                <option key={phase.value} value={phase.value}>
                  {phase.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FormSection>

      {/* Building Characteristics Section */}
      <FormSection
        title="Building Characteristics"
        icon={<Ruler className="w-4 h-4" />}
        expanded={expandedSections.has("building")}
        onToggle={() => toggleSection("building")}
      >
        <div className="grid grid-cols-2 gap-4">
          {/* Stories */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Number of Stories
            </label>
            <input
              type="number"
              value={formData.number_of_stories || ""}
              onChange={(e) => updateField("number_of_stories", e.target.value ? Number(e.target.value) : null)}
              placeholder="Above grade"
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Building Height */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Building Height (ft)
            </label>
            <input
              type="number"
              value={formData.building_height_ft || ""}
              onChange={(e) => updateField("building_height_ft", e.target.value ? Number(e.target.value) : null)}
              placeholder="To highest roof"
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Total Area */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Total Building Area (sq ft)
            </label>
            <input
              type="number"
              value={formData.total_area_sqft || ""}
              onChange={(e) => updateField("total_area_sqft", e.target.value ? Number(e.target.value) : null)}
              placeholder="Total floor area"
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Sprinklered */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_sprinklered"
              checked={formData.is_sprinklered}
              onChange={(e) => updateField("is_sprinklered", e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="is_sprinklered" className="text-sm text-foreground flex items-center gap-2">
              <Flame className="w-4 h-4 text-danger" />
              Automatic Sprinkler System
            </label>
          </div>

          {/* Fire Alarm Type */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1">
              Fire Alarm System Type
            </label>
            <select
              value={formData.fire_alarm_type}
              onChange={(e) => updateField("fire_alarm_type", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select type...</option>
              {FIRE_ALARM_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </FormSection>

      {/* Florida Location Section */}
      <FormSection
        title="Florida Location & Environment"
        icon={<MapPin className="w-4 h-4" />}
        expanded={expandedSections.has("location")}
        onToggle={() => toggleSection("location")}
      >
        <div className="grid grid-cols-2 gap-4">
          {/* County */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Florida County
            </label>
            <select
              value={formData.florida_county}
              onChange={(e) => updateField("florida_county", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select county...</option>
              {FLORIDA_COUNTIES.map((county) => (
                <option key={county} value={county}>
                  {county} County
                </option>
              ))}
            </select>
          </div>

          {/* Wind Speed */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2">
              <Wind className="w-4 h-4" />
              Design Wind Speed (mph)
            </label>
            <select
              value={formData.wind_speed_mph || ""}
              onChange={(e) => updateField("wind_speed_mph", e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select speed...</option>
              <option value="120">120 mph (Inland)</option>
              <option value="130">130 mph</option>
              <option value="140">140 mph</option>
              <option value="150">150 mph</option>
              <option value="160">160 mph</option>
              <option value="170">170 mph</option>
              <option value="180">180+ mph (High Velocity)</option>
            </select>
          </div>

          {/* Flood Zone */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2">
              <Waves className="w-4 h-4" />
              FEMA Flood Zone
            </label>
            <select
              value={formData.flood_zone}
              onChange={(e) => updateField("flood_zone", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Select zone...</option>
              {FLOOD_ZONES.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label} - {zone.description}
                </option>
              ))}
            </select>
          </div>

          {/* Coastal Construction */}
          <div className="col-span-2 flex items-center gap-3">
            <input
              type="checkbox"
              id="is_coastal_construction"
              checked={formData.is_coastal_construction}
              onChange={(e) => updateField("is_coastal_construction", e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="is_coastal_construction" className="text-sm text-foreground">
              Within Coastal Construction Control Line (CCCL)
            </label>
          </div>
        </div>
      </FormSection>

      {/* Special Features Section */}
      <FormSection
        title="Special Features & Hazards"
        icon={<AlertTriangle className="w-4 h-4" />}
        expanded={expandedSections.has("special")}
        onToggle={() => toggleSection("special")}
      >
        <div className="space-y-4">
          {/* Boolean Flags */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_high_rise}
                onChange={(e) => updateField("is_high_rise", e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">High-Rise (75+ ft)</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_assembly_areas}
                onChange={(e) => updateField("has_assembly_areas", e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">Assembly Areas</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_hazardous_materials}
                onChange={(e) => updateField("has_hazardous_materials", e.target.checked)}
                className="w-4 h-4 rounded border-border text-danger focus:ring-danger"
              />
              <span className="text-sm text-foreground">Hazardous Materials</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_high_piled_storage}
                onChange={(e) => updateField("has_high_piled_storage", e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">High-Piled Storage</span>
            </label>
          </div>

          {/* Special Features */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Additional Special Features
            </label>
            <div className="flex flex-wrap gap-2">
              {SPECIAL_FEATURES.map((feature) => (
                <button
                  key={feature.value}
                  type="button"
                  onClick={() => toggleArrayItem("special_features", feature.value)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    formData.special_features.includes(feature.value)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground-muted hover:border-primary/50"
                  }`}
                >
                  {feature.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </FormSection>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-foreground-muted hover:text-foreground"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Project Details
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function FormSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface-hover hover:bg-surface-hover/80 transition-colors"
      >
        {icon}
        <span className="font-medium text-foreground">{title}</span>
        <div className="flex-1" />
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-foreground-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-foreground-muted" />
        )}
      </button>
      {expanded && (
        <div className="p-4 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}
