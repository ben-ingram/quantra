"use client";

import { Check, FileText, ClipboardList, HardHat, BarChart3 } from "lucide-react";
import type { QualityPhase } from "@/app/actions/projects";

interface QualityStepperProps {
  currentPhase: QualityPhase;
  onPhaseClick?: (phase: QualityPhase) => void;
  defineComplete?: boolean;
  planComplete?: boolean;
}

const PHASES: {
  id: QualityPhase;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "define",
    label: "Define",
    sublabel: "Project Setup",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: "plan",
    label: "Plan",
    sublabel: "Quality Manual",
    icon: <ClipboardList className="w-5 h-5" />,
  },
  {
    id: "execute",
    label: "Inspect",
    sublabel: "Execution",
    icon: <HardHat className="w-5 h-5" />,
  },
  {
    id: "control",
    label: "Audit",
    sublabel: "Records",
    icon: <BarChart3 className="w-5 h-5" />,
  },
];

const PHASE_ORDER: QualityPhase[] = ["define", "plan", "execute", "control"];

export function QualityStepper({
  currentPhase,
  onPhaseClick,
  defineComplete,
  planComplete,
}: QualityStepperProps) {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);

  const getStepStatus = (phase: QualityPhase, index: number): "complete" | "current" | "upcoming" | "locked" => {
    if (index < currentIndex) return "complete";
    if (index === currentIndex) return "current";

    // Check if phase is accessible
    if (phase === "plan" && !defineComplete) return "locked";
    if (phase === "execute" && !planComplete) return "locked";
    if (phase === "control") return "upcoming"; // Control is always viewable

    return "upcoming";
  };

  const isClickable = (phase: QualityPhase, index: number): boolean => {
    const status = getStepStatus(phase, index);
    // Can click on complete phases, current phase, and control (always viewable)
    return status === "complete" || status === "current" || phase === "control";
  };

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        {PHASES.map((phase, index) => {
          const status = getStepStatus(phase.id, index);
          const clickable = isClickable(phase.id, index);
          const isLast = index === PHASES.length - 1;

          return (
            <div key={phase.id} className="flex items-center flex-1">
              {/* Step */}
              <button
                onClick={() => clickable && onPhaseClick?.(phase.id)}
                disabled={!clickable}
                className={`
                  flex flex-col items-center gap-2 group relative
                  ${clickable ? "cursor-pointer" : "cursor-not-allowed"}
                `}
              >
                {/* Circle with icon */}
                <div
                  className={`
                    w-14 h-14 rounded-full flex items-center justify-center
                    border-2 transition-all duration-300
                    ${status === "complete"
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : status === "current"
                        ? "bg-primary border-primary text-white shadow-lg shadow-primary/30"
                        : status === "locked"
                          ? "bg-slate-800 border-slate-700 text-slate-500"
                          : "bg-slate-800 border-slate-600 text-slate-400 group-hover:border-slate-500"
                    }
                  `}
                >
                  {status === "complete" ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    phase.icon
                  )}
                </div>

                {/* Label */}
                <div className="text-center">
                  <p
                    className={`
                      text-sm font-semibold transition-colors
                      ${status === "current"
                        ? "text-primary"
                        : status === "complete"
                          ? "text-emerald-400"
                          : status === "locked"
                            ? "text-slate-600"
                            : "text-slate-400"
                      }
                    `}
                  >
                    {phase.label}
                  </p>
                  <p
                    className={`
                      text-xs transition-colors
                      ${status === "current" || status === "complete"
                        ? "text-slate-400"
                        : "text-slate-600"
                      }
                    `}
                  >
                    {phase.sublabel}
                  </p>
                </div>

                {/* Current indicator */}
                {status === "current" && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 h-0.5 mx-4 mt-[-24px]">
                  <div
                    className={`
                      h-full transition-all duration-500
                      ${index < currentIndex
                        ? "bg-emerald-500"
                        : "bg-slate-700"
                      }
                    `}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
