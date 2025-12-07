import { getProjects } from "@/app/actions/projects";
import { DashboardShell } from "@/app/components/layout/DashboardShell";
import { ProjectGrid } from "@/app/components/projects/ProjectGrid";

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <DashboardShell>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projects</h1>
            <p className="text-foreground-secondary mt-1">
              Manage your construction compliance projects
            </p>
          </div>
        </div>

        {/* Projects Grid */}
        <ProjectGrid projects={projects} />
      </div>
    </DashboardShell>
  );
}
