"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  getProject,
  getProjectPhaseStatus,
  advanceProjectPhase,
  type Project,
  type QualityPhase,
  type ProjectPhaseStatus,
} from "@/app/actions/projects";
import {
  getProjectBimModel,
  type ProjectFile,
  type BimEntityData,
} from "@/app/actions/files";

// Phase Components
import { QualityStepper } from "./components/QualityStepper";
import { DefinePhase } from "./components/DefinePhase";
import { PlanPhase } from "./components/PlanPhase";
import { InspectPhase } from "./components/InspectPhase";
import { AuditPhase } from "./components/AuditPhase";
import { CodeExpertChat } from "./components/CodeExpertChat";

// =============================================================================
// Project Hub Page - Quality Loop Layout
// =============================================================================

export default function ProjectHubPage() {
  const params = useParams();
  const projectId = params.id as string;

  // Data state
  const [project, setProject] = useState<Project | null>(null);
  const [phaseStatus, setPhaseStatus] = useState<ProjectPhaseStatus | null>(null);
  const [bimModel, setBimModel] = useState<ProjectFile | null>(null);
  const [bimData, setBimData] = useState<BimEntityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [currentPhase, setCurrentPhase] = useState<QualityPhase>("define");

  // Load project data
  useEffect(() => {
    async function loadData() {
      try {
        const [projectData, phaseStatusResult, bimModelData] = await Promise.all([
          getProject(projectId),
          getProjectPhaseStatus(projectId),
          getProjectBimModel(projectId),
        ]);

        if (!projectData) {
          setError("Project not found");
          return;
        }

        setProject(projectData);

        // Set phase status from database
        if (phaseStatusResult.success && phaseStatusResult.status) {
          setPhaseStatus(phaseStatusResult.status);
          setCurrentPhase(phaseStatusResult.status.currentPhase);
        } else {
          // Fallback to project's current_phase
          setCurrentPhase(projectData.current_phase || "define");
        }

        // Set BIM model data
        setBimModel(bimModelData);
        if (bimModelData?.bim_data) {
          setBimData(bimModelData.bim_data as BimEntityData);
        }
      } catch (err) {
        console.error("Failed to load project:", err);
        setError("Failed to load project");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [projectId]);

  // Handle phase navigation from stepper
  const handlePhaseClick = useCallback((phase: QualityPhase) => {
    setCurrentPhase(phase);
  }, []);

  // Handle phase advancement (from Define -> Plan, Plan -> Execute, etc.)
  const handleAdvancePhase = useCallback(async () => {
    console.log("[Hub] Advancing phase from:", currentPhase);

    try {
      const result = await advanceProjectPhase(projectId, "manual");
      console.log("[Hub] Phase advance result:", result);

      if (result.success && result.newPhase) {
        setCurrentPhase(result.newPhase);
        // Refresh phase status
        const statusResult = await getProjectPhaseStatus(projectId);
        if (statusResult.success && statusResult.status) {
          setPhaseStatus(statusResult.status);
        }
      } else {
        console.error("[Hub] Phase advance failed:", result.message);
        // Show error to user
        alert(`Failed to advance phase: ${result.message}`);
      }
    } catch (error) {
      console.error("[Hub] Error advancing phase:", error);
      alert(`Error advancing phase: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [projectId, currentPhase]);

  // Handle BIM model changes (from DefinePhase)
  const handleBimModelChange = useCallback((model: ProjectFile | null) => {
    setBimModel(model);
  }, []);

  // Handle BIM data changes (from DefinePhase)
  const handleBimDataChange = useCallback((data: BimEntityData | null) => {
    setBimData(data);
  }, []);

  // Handle specs count change from DefinePhase
  const handleSpecsCountChange = useCallback(async (newCount: number) => {
    // Refresh phase status to update specs count
    const statusResult = await getProjectPhaseStatus(projectId);
    if (statusResult.success && statusResult.status) {
      setPhaseStatus(statusResult.status);
    }
  }, [projectId]);

  // Calculate completion status for stepper
  const specsCount = phaseStatus?.specsCount ?? 0;
  const defineComplete = !!(bimModel && specsCount > 0);
  const planComplete = (phaseStatus?.approvedManualsCount ?? 0) > 0;

  // Calculate canAdvance for DefinePhase
  // For now, we only require BIM model to advance (specs are optional during development)
  const canAdvanceDefine = !!bimModel;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return notFound();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Project Header - Compact */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/50">
        <div>
          <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            {project.address && (
              <p className="text-sm text-foreground-muted">{project.address}</p>
            )}
            {project.occupancy_group && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                {project.occupancy_group}
              </span>
            )}
            {project.construction_type && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-accent/10 text-accent">
                {project.construction_type}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quality Stepper */}
      <div className="px-6 py-2 border-b border-border bg-gradient-to-b from-surface to-transparent">
        <QualityStepper
          currentPhase={currentPhase}
          onPhaseClick={handlePhaseClick}
          defineComplete={defineComplete}
          planComplete={planComplete}
        />
      </div>

      {/* Phase Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {currentPhase === "define" && (
          <DefinePhase
            projectId={projectId}
            bimModel={bimModel}
            bimData={bimData}
            specsCount={specsCount}
            codeLibrarySelected={true} // Default to FBC 8th Ed for now
            onBimModelChange={handleBimModelChange}
            onBimDataChange={handleBimDataChange}
            onAdvancePhase={handleAdvancePhase}
            canAdvance={canAdvanceDefine}
            onSpecsCountChange={handleSpecsCountChange}
          />
        )}

        {currentPhase === "plan" && (
          <PlanPhase
            projectId={projectId}
            onAdvancePhase={handleAdvancePhase}
          />
        )}

        {currentPhase === "execute" && (
          <InspectPhase
            projectId={projectId}
            bimModelUrl={bimModel?.file_type !== "ifc" ? bimModel?.file_url : undefined}
          />
        )}

        {currentPhase === "control" && (
          <AuditPhase projectId={projectId} />
        )}
      </div>

      {/* Floating Code Expert Chat - Available in all phases */}
      <CodeExpertChat projectId={projectId} />
    </div>
  );
}
