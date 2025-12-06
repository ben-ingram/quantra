"use client";

import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
  variant?: "default" | "success" | "warning" | "danger" | "primary";
  size?: "default" | "large";
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
  size = "default",
}: StatCardProps) {
  const variantStyles = {
    default: {
      card: "bg-surface border-border hover:border-border-strong",
      icon: "bg-surface-hover text-foreground-secondary",
      value: "text-foreground",
    },
    success: {
      card: "bg-success-subtle/30 border-success/30 hover:border-success/50",
      icon: "bg-success/20 text-success",
      value: "text-success",
    },
    warning: {
      card: "bg-warning-subtle/30 border-warning/30 hover:border-warning/50",
      icon: "bg-warning/20 text-warning",
      value: "text-warning",
    },
    danger: {
      card: "bg-danger-subtle/30 border-danger/30 hover:border-danger/50",
      icon: "bg-danger/20 text-danger",
      value: "text-danger",
    },
    primary: {
      card: "bg-primary-subtle/30 border-primary/30 hover:border-primary/50",
      icon: "bg-primary/20 text-primary",
      value: "text-primary",
    },
  };

  const trendColors = {
    up: "text-success",
    down: "text-danger",
    neutral: "text-foreground-muted",
  };

  const trendIcons = {
    up: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 17l9.2-9.2M17 17V7H7" />
      </svg>
    ),
    down: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 7l-9.2 9.2M7 7v10h10" />
      </svg>
    ),
    neutral: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      </svg>
    ),
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border p-5
        transition-all duration-300 ease-out
        hover:shadow-lg hover:shadow-black/20
        ${styles.card}
        ${size === "large" ? "p-6" : "p-5"}
      `}
    >
      {/* Background gradient accent */}
      {variant !== "default" && (
        <div className="absolute inset-0 opacity-5">
          <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl ${
            variant === "success" ? "bg-success" :
            variant === "warning" ? "bg-warning" :
            variant === "danger" ? "bg-danger" :
            "bg-primary"
          }`} />
        </div>
      )}

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground-secondary">{title}</p>
          <p className={`
            mt-2 font-bold tracking-tight
            ${styles.value}
            ${size === "large" ? "text-4xl" : "text-3xl"}
          `}>
            {value}
          </p>

          {(subtitle || trend) && (
            <div className="mt-2 flex items-center gap-2">
              {trend && (
                <span className={`flex items-center gap-1 text-sm font-medium ${trendColors[trend.direction]}`}>
                  {trendIcons[trend.direction]}
                  {trend.value}
                </span>
              )}
              {subtitle && (
                <span className="text-sm text-foreground-muted">{subtitle}</span>
              )}
            </div>
          )}
        </div>

        <div className={`
          flex items-center justify-center rounded-xl
          ${styles.icon}
          ${size === "large" ? "w-14 h-14" : "w-12 h-12"}
        `}>
          {icon}
        </div>
      </div>
    </div>
  );
}
