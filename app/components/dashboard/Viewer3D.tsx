"use client";

import { useState } from "react";

interface Viewer3DProps {
  projectName?: string;
  scanDate?: string;
  modelUrl?: string;
}

export function Viewer3D({ projectName = "Project Model", scanDate }: Viewer3DProps) {
  const [activeLayer, setActiveLayer] = useState<"all" | "structural" | "mep" | "issues">("all");

  const layers = [
    { id: "all", label: "All Layers", icon: LayersIcon },
    { id: "structural", label: "Structural", icon: BuildingIcon },
    { id: "mep", label: "MEP", icon: BoltIcon },
    { id: "issues", label: "Issues", icon: AlertIcon },
  ] as const;

  return (
    <div className="relative h-full min-h-[400px] rounded-xl border border-border bg-background-secondary overflow-hidden">
      {/* Viewer Header */}
      <div className="absolute top-0 left-0 right-0 z-10 glass border-b border-border-subtle">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 text-primary">
              <CubeIcon />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{projectName}</h3>
              {scanDate && (
                <p className="text-xs text-foreground-muted">Last scan: {scanDate}</p>
              )}
            </div>
          </div>

          {/* Viewer Controls */}
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors" title="Reset View">
              <RefreshIcon />
            </button>
            <button className="p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors" title="Fullscreen">
              <ExpandIcon />
            </button>
            <button className="p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-surface-hover transition-colors" title="Settings">
              <SettingsIcon />
            </button>
          </div>
        </div>
      </div>

      {/* 3D Viewport Placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Grid pattern background */}
        <div className="absolute inset-0 pattern-grid opacity-30" />

        {/* Animated gradient orbs for visual interest */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-info/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-accent/5 rounded-full blur-2xl animate-pulse" style={{ animationDelay: "0.5s" }} />
        </div>

        {/* Isometric Building Placeholder */}
        <div className="relative z-10">
          <svg width="280" height="280" viewBox="0 0 280 280" fill="none" className="opacity-60">
            {/* Base Platform */}
            <path d="M140 240L40 180V100L140 160L240 100V180L140 240Z" fill="url(#platformGradient)" stroke="var(--primary)" strokeWidth="1" opacity="0.3"/>

            {/* Building Structure */}
            <path d="M80 160L80 80L140 40L200 80V160L140 200L80 160Z" fill="url(#buildingGradient)" stroke="var(--primary)" strokeWidth="1.5"/>

            {/* Building Front Face */}
            <path d="M80 160L80 80L140 120V200L80 160Z" fill="var(--primary)" fillOpacity="0.1" stroke="var(--primary)" strokeWidth="1"/>

            {/* Building Side Face */}
            <path d="M140 120L200 80V160L140 200V120Z" fill="var(--primary)" fillOpacity="0.05" stroke="var(--primary)" strokeWidth="1"/>

            {/* Windows - Front */}
            <rect x="90" y="100" width="12" height="16" fill="var(--info)" fillOpacity="0.4" rx="1"/>
            <rect x="108" y="100" width="12" height="16" fill="var(--info)" fillOpacity="0.4" rx="1"/>
            <rect x="90" y="130" width="12" height="16" fill="var(--info)" fillOpacity="0.4" rx="1"/>
            <rect x="108" y="130" width="12" height="16" fill="var(--info)" fillOpacity="0.4" rx="1"/>

            {/* Windows - Side */}
            <rect x="158" y="95" width="12" height="14" fill="var(--info)" fillOpacity="0.3" rx="1" transform="skewY(-30)"/>
            <rect x="178" y="85" width="12" height="14" fill="var(--info)" fillOpacity="0.3" rx="1" transform="skewY(-30)"/>

            {/* Issue Markers */}
            <circle cx="95" cy="90" r="6" fill="var(--danger)" className="animate-pulse">
              <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="175" cy="110" r="6" fill="var(--warning)" className="animate-pulse">
              <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" begin="0.5s"/>
            </circle>
            <circle cx="130" cy="170" r="6" fill="var(--success)"/>

            {/* Gradients */}
            <defs>
              <linearGradient id="buildingGradient" x1="80" y1="40" x2="200" y2="200">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2"/>
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.05"/>
              </linearGradient>
              <linearGradient id="platformGradient" x1="40" y1="100" x2="240" y2="240">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.1"/>
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02"/>
              </linearGradient>
            </defs>
          </svg>

          {/* Label */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center">
            <p className="text-xs text-foreground-muted">3D BIM Viewer</p>
            <p className="text-[10px] text-foreground-muted/60">Click to interact</p>
          </div>
        </div>
      </div>

      {/* Layer Toggle Panel */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="glass rounded-lg p-1 flex gap-1">
          {layers.map((layer) => {
            const Icon = layer.icon;
            return (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium
                  transition-all duration-200
                  ${activeLayer === layer.id
                    ? "bg-primary text-white"
                    : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
                  }
                `}
                title={layer.label}
              >
                <Icon />
                <span className="hidden sm:inline">{layer.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scan Info Overlay */}
      <div className="absolute bottom-4 right-4 z-10 glass rounded-lg px-3 py-2">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="status-dot status-dot-success" />
            <span className="text-foreground-secondary">Live Sync</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <span className="text-foreground-muted">2.4M points</span>
        </div>
      </div>

      {/* Compass */}
      <div className="absolute top-20 right-4 z-10">
        <div className="w-10 h-10 rounded-full glass flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15 9H9L12 2Z" fill="var(--danger)" fillOpacity="0.8"/>
            <path d="M12 22L9 15H15L12 22Z" fill="var(--foreground-muted)" fillOpacity="0.4"/>
            <circle cx="12" cy="12" r="2" fill="var(--foreground-secondary)"/>
            <text x="12" y="6" textAnchor="middle" fontSize="6" fill="var(--foreground-muted)">N</text>
          </svg>
        </div>
      </div>
    </div>
  );
}

// Icon Components
function CubeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
