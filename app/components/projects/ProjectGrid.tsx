"use client";

import { useState } from "react";
import Link from "next/link";
import { Project } from "@/app/actions/projects";
import { NewProjectModal } from "./NewProjectModal";

interface ProjectGridProps {
  projects: Project[];
}

export function ProjectGrid({ projects }: ProjectGridProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* New Project Card */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="group flex flex-col items-center justify-center h-64 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-surface hover:bg-surface-hover transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </div>
          <span className="text-sm font-medium text-foreground-secondary group-hover:text-foreground transition-colors">
            New Project
          </span>
        </button>

        {/* Project Cards */}
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {/* Empty State */}
      {projects.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-surface mx-auto mb-4 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-foreground-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">
            No projects yet
          </h3>
          <p className="text-foreground-secondary text-sm">
            Create your first project to get started with compliance tracking
          </p>
        </div>
      )}

      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const formattedDate = new Date(project.created_at).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );

  return (
    <Link
      href={`/project/${project.id}/hub`}
      className="group block h-64 rounded-xl border border-border bg-surface hover:bg-surface-hover hover:border-primary/30 transition-all duration-200 overflow-hidden"
    >
      {/* Cover Image */}
      <div className="h-32 bg-gradient-to-br from-primary/20 to-primary/5 relative">
        {project.cover_image_url ? (
          <img
            src={project.cover_image_url}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-primary/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21"
              />
            </svg>
          </div>
        )}

        {/* Occupancy Badge */}
        {project.occupancy_group && (
          <span className="absolute top-3 right-3 px-2 py-1 text-xs font-medium rounded-md bg-background/80 backdrop-blur-sm text-foreground-secondary">
            {project.occupancy_group}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
          {project.name}
        </h3>

        {project.address && (
          <p className="text-sm text-foreground-secondary mt-1 truncate flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
              />
            </svg>
            {project.address}
          </p>
        )}

        <p className="text-xs text-foreground-muted mt-3">
          Created {formattedDate}
        </p>
      </div>
    </Link>
  );
}
