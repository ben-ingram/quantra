"use client";

import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/app/components/layout";
import { Box, ClipboardCheck, FileText, History, ChevronLeft } from "lucide-react";

// =============================================================================
// Project Sub-Navigation
// =============================================================================

interface NavTab {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

function getProjectTabs(projectId: string): NavTab[] {
  return [
    { name: "3D View", href: `/project/${projectId}/hub`, icon: Box },
    { name: "Smart Checklists", href: `/project/${projectId}/checklists`, icon: ClipboardCheck },
    { name: "Documents", href: `/project/${projectId}/documents`, icon: FileText },
    { name: "Audit Log", href: `/project/${projectId}/audit`, icon: History },
  ];
}

// =============================================================================
// Layout Component
// =============================================================================

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const projectId = params.id as string;
  const tabs = getProjectTabs(projectId);

  return (
    <DashboardShell
      title=""
      description=""
      hideHeader
    >
      {/* Back to Dashboard + Project Sub-Nav */}
      <div className="mb-6">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Projects
        </Link>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-[1px] transition-colors
                  ${isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground-muted hover:text-foreground hover:border-border"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Page Content */}
      {children}
    </DashboardShell>
  );
}
