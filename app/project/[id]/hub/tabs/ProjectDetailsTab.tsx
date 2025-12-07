"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, Info } from "lucide-react";
import { ProjectIntakeForm, type ProjectIntakeData } from "@/app/components/projects/ProjectIntakeForm";
import { getProject, updateProjectIntake, type Project } from "@/app/actions/projects";

interface ProjectDetailsTabProps {
  projectId: string;
  onSaved?: () => void;
}

export function ProjectDetailsTab({ projectId, onSaved }: ProjectDetailsTabProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load project data
  useEffect(() => {
    async function loadProject() {
      try {
        const data = await getProject(projectId);
        setProject(data);
      } catch (err) {
        console.error("Failed to load project:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProject();
  }, [projectId]);

  const handleSave = async (data: ProjectIntakeData) => {
    try {
      await updateProjectIntake(projectId, {
        occupancy_subtype: data.occupancy_subtype || undefined,
        mixed_occupancies: data.mixed_occupancies.length > 0 ? data.mixed_occupancies : undefined,
        occupant_load: data.occupant_load || undefined,
        number_of_stories: data.number_of_stories || undefined,
        building_height_ft: data.building_height_ft || undefined,
        total_area_sqft: data.total_area_sqft || undefined,
        is_sprinklered: data.is_sprinklered,
        fire_alarm_type: data.fire_alarm_type || undefined,
        florida_county: data.florida_county || undefined,
        flood_zone: data.flood_zone || undefined,
        wind_speed_mph: data.wind_speed_mph || undefined,
        is_coastal_construction: data.is_coastal_construction,
        is_high_rise: data.is_high_rise,
        has_assembly_areas: data.has_assembly_areas,
        has_hazardous_materials: data.has_hazardous_materials,
        has_high_piled_storage: data.has_high_piled_storage,
        special_features: data.special_features.length > 0 ? data.special_features : undefined,
        project_phase: data.project_phase || undefined,
      });

      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Reload project data
      const updatedProject = await getProject(projectId);
      setProject(updatedProject);

      // Notify parent
      onSaved?.();
    } catch (err) {
      console.error("Failed to save project details:", err);
      throw err;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 text-center text-foreground-muted">
        Failed to load project details
      </div>
    );
  }

  // Build initial data from project
  const initialData: Partial<ProjectIntakeData> = {
    name: project.name,
    address: project.address || "",
    occupancy_group: project.occupancy_group || "",
    construction_type: project.construction_type || "",
    occupancy_subtype: project.occupancy_subtype || "",
    mixed_occupancies: project.mixed_occupancies || [],
    occupant_load: project.occupant_load,
    number_of_stories: project.number_of_stories,
    building_height_ft: project.building_height_ft,
    total_area_sqft: project.total_area_sqft,
    is_sprinklered: project.is_sprinklered || false,
    fire_alarm_type: project.fire_alarm_type || "",
    florida_county: project.florida_county || "",
    flood_zone: project.flood_zone || "",
    wind_speed_mph: project.wind_speed_mph,
    is_coastal_construction: project.is_coastal_construction || false,
    is_high_rise: project.is_high_rise || false,
    has_assembly_areas: project.has_assembly_areas || false,
    has_hazardous_materials: project.has_hazardous_materials || false,
    has_high_piled_storage: project.has_high_piled_storage || false,
    special_features: project.special_features || [],
    project_phase: project.project_phase || "design",
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Project Details</h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              Detailed information for accurate checklist generation
            </p>
          </div>
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Saved
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      {!project.intake_completed_at && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex gap-2">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-xs text-foreground">
              <p className="font-medium">Complete project details for better checklists</p>
              <p className="text-foreground-muted mt-1">
                The more information you provide, the more accurate and specific your
                generated checklists will be. Include Florida location data, building
                characteristics, and special features.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4">
        <ProjectIntakeForm
          initialData={initialData}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
