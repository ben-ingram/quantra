"use client";

import { useState } from "react";

type TimeRange = "7d" | "30d" | "90d";

interface DataPoint {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
}

interface TrendChartProps {
  title?: string;
  data?: DataPoint[];
}

// Mock data for visualization
const MOCK_DATA: Record<TimeRange, DataPoint[]> = {
  "7d": [
    { date: "Mon", critical: 2, high: 5, medium: 8, low: 12, resolved: 15 },
    { date: "Tue", critical: 3, high: 4, medium: 10, low: 14, resolved: 18 },
    { date: "Wed", critical: 1, high: 6, medium: 7, low: 11, resolved: 22 },
    { date: "Thu", critical: 4, high: 3, medium: 9, low: 13, resolved: 20 },
    { date: "Fri", critical: 2, high: 5, medium: 6, low: 10, resolved: 25 },
    { date: "Sat", critical: 1, high: 2, medium: 4, low: 8, resolved: 12 },
    { date: "Sun", critical: 0, high: 1, medium: 3, low: 6, resolved: 8 },
  ],
  "30d": [
    { date: "Week 1", critical: 8, high: 15, medium: 25, low: 40, resolved: 60 },
    { date: "Week 2", critical: 6, high: 12, medium: 28, low: 35, resolved: 72 },
    { date: "Week 3", critical: 10, high: 18, medium: 22, low: 38, resolved: 85 },
    { date: "Week 4", critical: 4, high: 10, medium: 20, low: 30, resolved: 95 },
  ],
  "90d": [
    { date: "Month 1", critical: 25, high: 45, medium: 80, low: 120, resolved: 180 },
    { date: "Month 2", critical: 18, high: 38, medium: 72, low: 105, resolved: 220 },
    { date: "Month 3", critical: 12, high: 28, medium: 65, low: 90, resolved: 280 },
  ],
};

export function TrendChart({ title = "Defects Over Time" }: TrendChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const data = MOCK_DATA[timeRange];

  // Calculate max value for scaling
  const maxValue = Math.max(
    ...data.map((d) => d.critical + d.high + d.medium + d.low)
  );

  // Calculate totals
  const totals = data.reduce(
    (acc, d) => ({
      critical: acc.critical + d.critical,
      high: acc.high + d.high,
      medium: acc.medium + d.medium,
      low: acc.low + d.low,
      resolved: acc.resolved + d.resolved,
    }),
    { critical: 0, high: 0, medium: 0, low: 0, resolved: 0 }
  );

  const totalDefects = totals.critical + totals.high + totals.medium + totals.low;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/20 text-accent">
              <ChartIcon />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-foreground-muted">
                {totalDefects} total • {totals.resolved} resolved
              </p>
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="flex gap-1 p-1 bg-background rounded-lg">
            {(["7d", "30d", "90d"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`
                  px-3 py-1 rounded-md text-xs font-medium transition-all
                  ${timeRange === range
                    ? "bg-primary text-white"
                    : "text-foreground-secondary hover:text-foreground hover:bg-surface-hover"
                  }
                `}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4">
          {[
            { label: "Critical", color: "bg-severity-critical", count: totals.critical },
            { label: "High", color: "bg-severity-high", count: totals.high },
            { label: "Medium", color: "bg-severity-medium", count: totals.medium },
            { label: "Low", color: "bg-severity-low", count: totals.low },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-sm ${item.color}`} />
              <span className="text-xs text-foreground-secondary">
                {item.label}
              </span>
              <span className="text-xs font-medium text-foreground">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart Area */}
      <div className="p-4">
        <div className="relative h-48">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-right pr-2">
            {[maxValue, Math.round(maxValue * 0.5), 0].map((val, i) => (
              <span key={i} className="text-xs text-foreground-muted">
                {val}
              </span>
            ))}
          </div>

          {/* Chart Grid */}
          <div className="absolute left-10 right-0 top-0 bottom-6">
            {/* Horizontal grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between">
              {[0, 1, 2].map((i) => (
                <div key={i} className="border-t border-border-subtle" />
              ))}
            </div>

            {/* Bars */}
            <div className="relative h-full flex items-end justify-around gap-2 px-2">
              {data.map((point, index) => {
                const total = point.critical + point.high + point.medium + point.low;
                const heightPercent = (total / maxValue) * 100;

                return (
                  <div
                    key={index}
                    className="relative flex-1 flex flex-col items-center group"
                    onMouseEnter={() => setHoveredBar(index)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Stacked Bar */}
                    <div
                      className="w-full max-w-[40px] rounded-t-md overflow-hidden transition-all duration-300 cursor-pointer hover:opacity-90"
                      style={{ height: `${heightPercent}%` }}
                    >
                      {/* Low */}
                      <div
                        className="w-full bg-severity-low"
                        style={{ height: `${(point.low / total) * 100}%` }}
                      />
                      {/* Medium */}
                      <div
                        className="w-full bg-severity-medium"
                        style={{ height: `${(point.medium / total) * 100}%` }}
                      />
                      {/* High */}
                      <div
                        className="w-full bg-severity-high"
                        style={{ height: `${(point.high / total) * 100}%` }}
                      />
                      {/* Critical */}
                      <div
                        className="w-full bg-severity-critical"
                        style={{ height: `${(point.critical / total) * 100}%` }}
                      />
                    </div>

                    {/* Tooltip */}
                    {hoveredBar === index && (
                      <div className="absolute bottom-full mb-2 z-10 glass rounded-lg px-3 py-2 text-xs whitespace-nowrap">
                        <p className="font-medium text-foreground mb-1">{point.date}</p>
                        <div className="space-y-0.5">
                          <p className="text-severity-critical">Critical: {point.critical}</p>
                          <p className="text-severity-high">High: {point.high}</p>
                          <p className="text-severity-medium">Medium: {point.medium}</p>
                          <p className="text-severity-low">Low: {point.low}</p>
                        </div>
                        <p className="mt-1 pt-1 border-t border-border-subtle text-success">
                          Resolved: {point.resolved}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-axis labels */}
          <div className="absolute left-10 right-0 bottom-0 h-6 flex justify-around px-2">
            {data.map((point, index) => (
              <span
                key={index}
                className="text-xs text-foreground-muted text-center flex-1"
              >
                {point.date}
              </span>
            ))}
          </div>
        </div>

        {/* Resolution Rate Indicator */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-foreground-secondary">Resolution Rate</span>
            <span className="text-xs font-medium text-success">
              {Math.round((totals.resolved / (totalDefects + totals.resolved)) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-success to-info rounded-full transition-all duration-500"
              style={{
                width: `${(totals.resolved / (totalDefects + totals.resolved)) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}
