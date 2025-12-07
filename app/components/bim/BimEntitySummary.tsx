"use client";

import { useState } from "react";
import {
  Building2,
  DoorOpen,
  Layers,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Box,
  Flame,
  Accessibility,
} from "lucide-react";
import type { BimEntityData, BimEntityCount } from "@/app/actions/files";

interface BimEntitySummaryProps {
  data: BimEntityData | null;
  isLoading?: boolean;
  isParsing?: boolean;
  error?: string | null;
  compact?: boolean;
}

// Category groupings for display
const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  egress: { label: "Egress", icon: <DoorOpen className="w-4 h-4" />, color: "text-primary" },
  fire: { label: "Fire Protection", icon: <Flame className="w-4 h-4" />, color: "text-danger" },
  accessibility: { label: "Accessibility", icon: <Accessibility className="w-4 h-4" />, color: "text-success" },
  spatial: { label: "Spatial", icon: <Layers className="w-4 h-4" />, color: "text-foreground-muted" },
  structure: { label: "Structure", icon: <Building2 className="w-4 h-4" />, color: "text-foreground-muted" },
  other: { label: "Other Elements", icon: <Box className="w-4 h-4" />, color: "text-foreground-muted" },
};

// Map element labels to categories
function getCategory(label: string): string {
  if (["Doors", "Stairs", "Stair Flights", "Railings", "Ramps", "Ramp Flights"].includes(label)) return "egress";
  if (label.includes("Fire")) return "fire";
  if (["Ramps", "Ramp Flights"].includes(label)) return "accessibility";
  if (["Spaces/Rooms", "Building Storeys"].includes(label)) return "spatial";
  if (["Walls", "Standard Walls", "Columns", "Beams", "Slabs/Floors", "Roofs", "Curtain Walls"].includes(label)) return "structure";
  return "other";
}

export function BimEntitySummary({
  data,
  isLoading,
  isParsing,
  error,
  compact = false,
}: BimEntitySummaryProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["egress", "fire", "spatial"])
  );

  const toggleCategory = (category: string) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setExpandedCategories(newSet);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (isParsing) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
        <p className="text-sm font-medium text-foreground">Analyzing BIM Model...</p>
        <p className="text-xs text-foreground-muted mt-1">Extracting building elements</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-danger/10 border border-danger/20">
        <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-danger">Failed to parse BIM</p>
          <p className="text-xs text-foreground-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-6 text-foreground-muted">
        <Box className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No BIM data available</p>
        <p className="text-xs mt-1">Upload an IFC file to analyze</p>
      </div>
    );
  }

  // Group entities by category
  const groupedEntities = data.entityCounts.reduce<Record<string, BimEntityCount[]>>((acc, entity) => {
    const category = getCategory(entity.label);
    if (!acc[category]) acc[category] = [];
    acc[category].push(entity);
    return acc;
  }, {});

  if (compact) {
    return <CompactView data={data} groupedEntities={groupedEntities} />;
  }

  return (
    <div className="space-y-3">
      {/* Header with building info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {data.buildingName || "Building Model"}
          </h3>
          {data.storeyCount > 0 && (
            <p className="text-xs text-foreground-muted">
              {data.storeyCount} floors • {data.totalElements.toLocaleString()} elements
            </p>
          )}
        </div>
        <div className="text-xs text-foreground-muted">
          Parsed {new Date(data.parsedAt).toLocaleDateString()}
        </div>
      </div>

      {/* Storey List */}
      {data.storeyNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.storeyNames.map((name, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 text-xs rounded bg-surface-hover text-foreground-muted"
            >
              {name}
            </span>
          ))}
        </div>
      )}

      {/* Entity Categories */}
      <div className="space-y-2">
        {Object.entries(CATEGORY_CONFIG).map(([categoryKey, config]) => {
          const entities = groupedEntities[categoryKey];
          if (!entities || entities.length === 0) return null;

          const isExpanded = expandedCategories.has(categoryKey);
          const totalCount = entities.reduce((sum, e) => sum + e.count, 0);

          return (
            <div key={categoryKey} className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(categoryKey)}
                className="w-full flex items-center gap-3 px-3 py-2 bg-surface-hover hover:bg-surface-hover/80 transition-colors"
              >
                <span className={config.color}>{config.icon}</span>
                <span className="text-sm font-medium text-foreground flex-1 text-left">
                  {config.label}
                </span>
                <span className="text-xs text-foreground-muted">{totalCount}</span>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-foreground-muted" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-foreground-muted" />
                )}
              </button>

              {isExpanded && (
                <div className="px-3 py-2 space-y-1 border-t border-border">
                  {entities.map((entity, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-foreground-muted">
                        {entity.icon} {entity.label}
                      </span>
                      <span className="font-mono text-foreground">{entity.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompactView({
  data,
  groupedEntities,
}: {
  data: BimEntityData;
  groupedEntities: Record<string, BimEntityCount[]>;
}) {
  // Show key metrics in a compact horizontal layout
  const keyMetrics = [
    { label: "Floors", value: data.storeyCount, icon: <Layers className="w-3.5 h-3.5" /> },
    {
      label: "Doors",
      value: groupedEntities.egress?.find((e) => e.label === "Doors")?.count || 0,
      icon: <DoorOpen className="w-3.5 h-3.5" />,
    },
    {
      label: "Stairs",
      value: (groupedEntities.egress?.find((e) => e.label === "Stairs")?.count || 0) +
        (groupedEntities.egress?.find((e) => e.label === "Stair Flights")?.count || 0),
      icon: "🪜",
    },
    {
      label: "Rooms",
      value: groupedEntities.spatial?.find((e) => e.label === "Spaces/Rooms")?.count || 0,
      icon: <Box className="w-3.5 h-3.5" />,
    },
  ].filter((m) => m.value > 0);

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {keyMetrics.map((metric, idx) => (
        <div key={idx} className="flex items-center gap-1.5 text-sm">
          <span className="text-foreground-muted">
            {typeof metric.icon === "string" ? metric.icon : metric.icon}
          </span>
          <span className="font-medium text-foreground">{metric.value}</span>
          <span className="text-foreground-muted">{metric.label}</span>
        </div>
      ))}
      <span className="text-xs text-foreground-muted">
        ({data.totalElements.toLocaleString()} total)
      </span>
    </div>
  );
}
