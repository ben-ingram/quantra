"use client";

import { useState } from "react";

type ComplianceStatus = "PASS" | "FAIL" | "WARNING" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface ComplianceCheckItem {
  id: string;
  timestamp: string;
  description: string;
  status: ComplianceStatus;
  citation?: string;
  riskScore: number;
  area: string;
}

interface ComplianceFeedProps {
  items?: ComplianceCheckItem[];
  maxItems?: number;
}

// Default mock data for when no real data is provided
const DEFAULT_ITEMS: ComplianceCheckItem[] = [
  {
    id: "CHK-001",
    timestamp: "2 min ago",
    description: "Fire exit door swing direction verification",
    status: "FAIL",
    citation: "FBC 1010.1.2",
    riskScore: 8,
    area: "Floor 12 - East Wing",
  },
  {
    id: "CHK-002",
    timestamp: "8 min ago",
    description: "Stairwell handrail height compliance",
    status: "PASS",
    citation: "FBC 1014.3.1",
    riskScore: 2,
    area: "Floor 12 - Stairwell A",
  },
];

// Map database status to display status
function normalizeStatus(status: ComplianceStatus): "PASS" | "FAIL" | "WARNING" {
  if (status === "COMPLETED") {
    return "PASS";
  }
  if (status === "FAILED" || status === "FAIL") {
    return "FAIL";
  }
  if (status === "PENDING" || status === "IN_PROGRESS" || status === "WARNING") {
    return "WARNING";
  }
  return "PASS";
}

export function ComplianceFeed({ items, maxItems = 8 }: ComplianceFeedProps) {
  const displayItems = items && items.length > 0 ? items : DEFAULT_ITEMS;
  const [filter, setFilter] = useState<"all" | "FAIL" | "WARNING" | "PASS">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const normalizedItems = displayItems.map((item) => ({
    ...item,
    normalizedStatus: normalizeStatus(item.status),
  }));

  const filteredItems = normalizedItems
    .filter((item) => filter === "all" || item.normalizedStatus === filter)
    .slice(0, maxItems);

  const statusCounts = {
    PASS: normalizedItems.filter((i) => i.normalizedStatus === "PASS").length,
    FAIL: normalizedItems.filter((i) => i.normalizedStatus === "FAIL").length,
    WARNING: normalizedItems.filter((i) => i.normalizedStatus === "WARNING").length,
  };

  return (
    <div className="h-full flex flex-col rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border bg-surface-hover/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 text-primary">
              <ShieldIcon />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Compliance Feed</h3>
              <p className="text-xs text-foreground-muted">
                {displayItems.length} analysis results
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="status-dot status-dot-success animate-pulse-status" />
            <span className="text-xs text-foreground-muted">Live</span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 p-1 bg-background rounded-lg">
          {(["all", "FAIL", "WARNING", "PASS"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`
                flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all
                ${filter === status
                  ? status === "FAIL"
                    ? "bg-danger text-white"
                    : status === "WARNING"
                    ? "bg-warning text-black"
                    : status === "PASS"
                    ? "bg-success text-white"
                    : "bg-primary text-white"
                  : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
                }
              `}
            >
              {status === "all" ? "All" : status}
              <span className="ml-1 opacity-70">
                {status === "all" ? displayItems.length : statusCounts[status]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-foreground-muted text-sm">
            No checks match the filter
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredItems.map((item) => (
              <ComplianceCheckCard
                key={item.id}
                item={item}
                normalizedStatus={item.normalizedStatus}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-3 border-t border-border bg-surface-hover/30">
        <button className="w-full py-2 text-sm text-primary hover:text-primary-hover font-medium transition-colors">
          View Full Audit Log →
        </button>
      </div>
    </div>
  );
}

function ComplianceCheckCard({
  item,
  normalizedStatus,
  expanded,
  onToggle,
}: {
  item: ComplianceCheckItem;
  normalizedStatus: "PASS" | "FAIL" | "WARNING";
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusConfig = {
    PASS: {
      bg: "bg-success/10",
      border: "border-success/30",
      text: "text-success",
      icon: <CheckIcon />,
      glow: "",
    },
    FAIL: {
      bg: "bg-danger/10",
      border: "border-danger/30",
      text: "text-danger",
      icon: <XIcon />,
      glow: "shadow-[0_0_12px_rgba(239,68,68,0.15)]",
    },
    WARNING: {
      bg: "bg-warning/10",
      border: "border-warning/30",
      text: "text-warning",
      icon: <AlertTriangleIcon />,
      glow: "",
    },
  };

  const config = statusConfig[normalizedStatus];

  return (
    <div
      className={`
        p-3 cursor-pointer transition-all duration-200
        hover:bg-surface-hover
        ${normalizedStatus === "FAIL" ? "bg-danger/5" : ""}
        ${expanded ? "bg-surface-hover" : ""}
      `}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className={`
          flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
          ${config.bg} ${config.text} ${config.glow}
        `}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground line-clamp-2">
              {item.description}
            </p>
            <span className="flex-shrink-0 text-xs text-foreground-muted">
              {item.timestamp}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {/* Citation Badge */}
            {item.citation && (
              <span className={`
                inline-flex items-center px-2 py-0.5 rounded text-xs font-mono
                ${normalizedStatus === "FAIL"
                  ? "bg-danger/20 text-danger border border-danger/30"
                  : normalizedStatus === "WARNING"
                  ? "bg-warning/20 text-warning border border-warning/30"
                  : "bg-surface-hover text-foreground-secondary border border-border"
                }
              `}>
                {item.citation}
              </span>
            )}

            {/* Risk Score */}
            <span className="text-xs text-foreground-muted">
              Risk: {item.riskScore}/10
            </span>
          </div>

          {/* Expanded Details */}
          {expanded && (
            <div className="mt-3 pt-3 border-t border-border-subtle space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <LocationIcon />
                <span className="text-foreground-secondary">{item.area}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-foreground-muted">Check ID:</span>
                <span className="font-mono text-foreground-secondary">{item.id}</span>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                  View Details
                </button>
                {normalizedStatus === "FAIL" && (
                  <button className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md bg-danger/10 text-danger hover:bg-danger/20 transition-colors">
                    Create Issue
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Icons
function ShieldIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-foreground-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}
