/**
 * Data fetching functions for the Dashboard
 *
 * These functions fetch real data from the database using Prisma.
 */

import { prisma } from "./db";
import { cache } from "react";

// =============================================================================
// Types
// =============================================================================

export interface DashboardStats {
  complianceScore: number;
  totalChecks: number;
  openCriticalDefects: number;
  criticalChange: number;
  scansTonight: number;
  lastScanTime: string | null;
}

export interface RecentScan {
  id: string;
  name: string | null;
  status: string;
  capturedAt: Date;
  complianceScore: number | null;
}

export interface RecentIssue {
  id: string;
  title: string;
  status: string;
  severity: string;
  severityScore: number;
  codeReference: string | null;
  location: string | null;
  createdAt: Date;
  assignedTo: {
    name: string;
    avatarUrl: string | null;
  } | null;
}

export interface RecentComplianceCheck {
  id: string;
  status: string;
  overallScore: number | null;
  summary: string | null;
  createdAt: Date;
  findings: {
    status?: string;
    citation?: string;
    riskScore?: number;
  } | null;
  regulatoryCode: {
    shortName: string;
  };
}

export interface ProjectDashboardData {
  project: {
    id: string;
    name: string;
    description: string | null;
    address: string | null;
    status: string;
    bimModelVersion: string | null;
  } | null;
  stats: DashboardStats;
  recentScans: RecentScan[];
  recentIssues: RecentIssue[];
  recentComplianceChecks: RecentComplianceCheck[];
  regulatoryCodes: {
    id: string;
    shortName: string;
    name: string;
    complianceScore: number;
    checksCount: number;
  }[];
}

// =============================================================================
// Data Fetching Functions
// =============================================================================

/**
 * Fetch a project by ID with all related data for the dashboard
 */
export const getProjectDashboardData = cache(
  async (projectId: string): Promise<ProjectDashboardData> => {
    // Fetch project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        status: true,
        bimModelVersion: true,
      },
    });

    if (!project) {
      return {
        project: null,
        stats: {
          complianceScore: 0,
          totalChecks: 0,
          openCriticalDefects: 0,
          criticalChange: 0,
          scansTonight: 0,
          lastScanTime: null,
        },
        recentScans: [],
        recentIssues: [],
        recentComplianceChecks: [],
        regulatoryCodes: [],
      };
    }

    // Fetch stats in parallel
    const [
      complianceChecks,
      criticalIssues,
      criticalIssuesLastWeek,
      tonightScans,
      recentScans,
      recentIssues,
      recentComplianceChecks,
      projectCodes,
    ] = await Promise.all([
      // All compliance checks for score calculation
      prisma.complianceCheck.findMany({
        where: {
          scan: { projectId },
          status: "COMPLETED",
        },
        select: { overallScore: true },
      }),

      // Current critical issues
      prisma.issue.count({
        where: {
          projectId,
          severity: "CRITICAL",
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      }),

      // Critical issues from last week (for trend)
      prisma.issue.count({
        where: {
          projectId,
          severity: "CRITICAL",
          status: { in: ["OPEN", "IN_PROGRESS"] },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Tonight's scans (last 12 hours)
      prisma.scan.findMany({
        where: {
          projectId,
          capturedAt: {
            gte: new Date(Date.now() - 12 * 60 * 60 * 1000),
          },
        },
        orderBy: { capturedAt: "desc" },
        select: {
          capturedAt: true,
        },
      }),

      // Recent scans with compliance scores
      prisma.scan.findMany({
        where: { projectId },
        orderBy: { capturedAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          status: true,
          capturedAt: true,
          complianceChecks: {
            where: { status: "COMPLETED" },
            select: { overallScore: true },
            take: 1,
            orderBy: { completedAt: "desc" },
          },
        },
      }),

      // Recent issues
      prisma.issue.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          severity: true,
          severityScore: true,
          codeReference: true,
          location: true,
          createdAt: true,
          assignedTo: {
            select: {
              name: true,
              avatarUrl: true,
            },
          },
        },
      }),

      // Recent compliance checks
      prisma.complianceCheck.findMany({
        where: {
          scan: { projectId },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          overallScore: true,
          summary: true,
          findings: true,
          createdAt: true,
          regulatoryCode: {
            select: { shortName: true },
          },
        },
      }),

      // Project regulatory codes with compliance stats
      prisma.projectRegulatoryCode.findMany({
        where: { projectId },
        select: {
          regulatoryCode: {
            select: {
              id: true,
              shortName: true,
              name: true,
              complianceChecks: {
                where: {
                  scan: { projectId },
                  status: "COMPLETED",
                },
                select: { overallScore: true },
              },
            },
          },
        },
      }),
    ]);

    // Calculate overall compliance score
    const completedChecks = complianceChecks.filter((c) => c.overallScore !== null);
    const avgScore =
      completedChecks.length > 0
        ? completedChecks.reduce((sum, c) => sum + (c.overallScore || 0), 0) /
          completedChecks.length
        : 0;

    // Format recent scans
    const formattedScans: RecentScan[] = recentScans.map((scan) => ({
      id: scan.id,
      name: scan.name,
      status: scan.status,
      capturedAt: scan.capturedAt,
      complianceScore: scan.complianceChecks[0]?.overallScore ?? null,
    }));

    // Format compliance checks
    const formattedChecks: RecentComplianceCheck[] = recentComplianceChecks.map(
      (check) => ({
        id: check.id,
        status: check.status,
        overallScore: check.overallScore,
        summary: check.summary,
        createdAt: check.createdAt,
        findings: check.findings as RecentComplianceCheck["findings"],
        regulatoryCode: check.regulatoryCode,
      })
    );

    // Format regulatory codes with scores
    const formattedCodes = projectCodes.map((pc) => {
      const checks = pc.regulatoryCode.complianceChecks;
      const avgCodeScore =
        checks.length > 0
          ? checks.reduce((sum, c) => sum + (c.overallScore || 0), 0) / checks.length
          : 100;

      return {
        id: pc.regulatoryCode.id,
        shortName: pc.regulatoryCode.shortName,
        name: pc.regulatoryCode.name,
        complianceScore: Math.round(avgCodeScore),
        checksCount: checks.length,
      };
    });

    return {
      project,
      stats: {
        complianceScore: Math.round(avgScore * 10) / 10,
        totalChecks: completedChecks.length,
        openCriticalDefects: criticalIssues,
        criticalChange: criticalIssuesLastWeek - criticalIssues,
        scansTonight: tonightScans.length,
        lastScanTime: tonightScans[0]?.capturedAt.toISOString() ?? null,
      },
      recentScans: formattedScans,
      recentIssues,
      recentComplianceChecks: formattedChecks,
      regulatoryCodes: formattedCodes,
    };
  }
);

/**
 * Get a scan by ID for running compliance checks
 */
export async function getLatestScan(projectId: string) {
  return prisma.scan.findFirst({
    where: { projectId },
    orderBy: { capturedAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });
}

/**
 * Get regulatory codes for a project
 */
export async function getProjectRegulatoryCodes(projectId: string) {
  const codes = await prisma.projectRegulatoryCode.findMany({
    where: { projectId },
    select: {
      regulatoryCode: {
        select: {
          id: true,
          shortName: true,
          name: true,
        },
      },
    },
  });

  return codes.map((c) => c.regulatoryCode);
}

// =============================================================================
// Issue Detail Data
// =============================================================================

export interface IssueDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  severityScore: number;
  scheduleImpact: string;
  safetyImpact: string;
  costImpact: string;
  location: string | null;
  coordinates: { x: number; y: number; z: number } | null;
  bimElementId: string | null;
  codeReference: string | null;
  evidenceUrls: string[];
  aiAnalysis: string | null;
  resolution: string | null;
  detectedAt: Date;
  resolvedAt: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  project: {
    id: string;
    name: string;
  };
  scan: {
    id: string;
    name: string | null;
    capturedAt: Date;
    scanType: string;
    thumbnailUrl: string | null;
    metadata: Record<string, unknown> | null;
  } | null;
  complianceCheck: {
    id: string;
    overallScore: number | null;
    summary: string | null;
    findings: {
      status?: string;
      citation?: string;
      riskScore?: number;
      reasoning?: string;
      riskFactors?: {
        lifeSafety?: string;
        reworkCost?: string;
        scheduleImpact?: string;
      };
      recommendations?: string[];
      confidence?: number;
    } | null;
    regulatoryCode: {
      id: string;
      shortName: string;
      name: string;
    };
  } | null;
  assignedTo: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  createdBy: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  resolvedBy: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  auditLogs: {
    id: string;
    action: string;
    reason: string | null;
    createdAt: Date;
    user: {
      name: string;
      avatarUrl: string | null;
    } | null;
  }[];
}

/**
 * Fetch a single issue with all related data for the resolution interface
 */
export const getIssueDetail = cache(
  async (issueId: string): Promise<IssueDetail | null> => {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        scan: {
          select: {
            id: true,
            name: true,
            capturedAt: true,
            scanType: true,
            thumbnailUrl: true,
            metadata: true,
          },
        },
        complianceCheck: {
          select: {
            id: true,
            overallScore: true,
            summary: true,
            findings: true,
            regulatoryCode: {
              select: {
                id: true,
                shortName: true,
                name: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            action: true,
            reason: true,
            createdAt: true,
            user: {
              select: {
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!issue) return null;

    return {
      ...issue,
      coordinates: issue.coordinates as IssueDetail["coordinates"],
      complianceCheck: issue.complianceCheck
        ? {
            ...issue.complianceCheck,
            findings: issue.complianceCheck.findings as IssueDetail["complianceCheck"] extends null
              ? never
              : NonNullable<IssueDetail["complianceCheck"]>["findings"],
          }
        : null,
      scan: issue.scan
        ? {
            ...issue.scan,
            metadata: issue.scan.metadata as Record<string, unknown> | null,
          }
        : null,
    };
  }
);

/**
 * Get the first user for demo purposes (temporary until auth is implemented)
 */
export async function getDemoUser() {
  return prisma.user.findFirst({
    where: { role: "QA_INSPECTOR" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });
}

// =============================================================================
// Audit Log Data
// =============================================================================

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  reason: string | null;
  checksum: string | null;
  previousHash: string | null;
  ipAddress: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
  } | null;
  issue: {
    id: string;
    title: string;
    severity: string;
  } | null;
  complianceCheck: {
    id: string;
    status: string;
    overallScore: number | null;
    regulatoryCode: {
      shortName: string;
    };
  } | null;
}

export interface AuditArchiveData {
  project: {
    id: string;
    name: string;
    address: string | null;
    status: string;
    startDate: Date | null;
    endDate: Date | null;
  } | null;
  auditLogs: AuditLogEntry[];
  stats: {
    totalEntries: number;
    complianceChecks: number;
    issuesCreated: number;
    issuesResolved: number;
    chainIntegrity: boolean;
    lastVerified: Date;
  };
}

/**
 * Fetch audit logs for a project's compliance archive
 */
export const getAuditArchiveData = cache(
  async (projectId: string): Promise<AuditArchiveData> => {
    // Fetch project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        address: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!project) {
      return {
        project: null,
        auditLogs: [],
        stats: {
          totalEntries: 0,
          complianceChecks: 0,
          issuesCreated: 0,
          issuesResolved: 0,
          chainIntegrity: true,
          lastVerified: new Date(),
        },
      };
    }

    // Fetch audit logs related to this project
    // We need to get logs for issues and compliance checks that belong to this project
    const [projectIssues, projectScans] = await Promise.all([
      prisma.issue.findMany({
        where: { projectId },
        select: { id: true },
      }),
      prisma.scan.findMany({
        where: { projectId },
        select: {
          id: true,
          complianceChecks: {
            select: { id: true },
          },
        },
      }),
    ]);

    const issueIds = projectIssues.map((i) => i.id);
    const complianceCheckIds = projectScans.flatMap((s) =>
      s.complianceChecks.map((c) => c.id)
    );

    // Fetch audit logs for these entities
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { issueId: { in: issueIds } },
          { complianceCheckId: { in: complianceCheckIds } },
          {
            entity: "PROJECT",
            entityId: projectId,
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
        issue: {
          select: {
            id: true,
            title: true,
            severity: true,
          },
        },
        complianceCheck: {
          select: {
            id: true,
            status: true,
            overallScore: true,
            regulatoryCode: {
              select: {
                shortName: true,
              },
            },
          },
        },
      },
    });

    // Calculate stats
    const complianceChecks = auditLogs.filter((l) =>
      l.action.startsWith("COMPLIANCE_CHECK")
    ).length;
    const issuesCreated = auditLogs.filter(
      (l) => l.action === "ISSUE_CREATED"
    ).length;
    const issuesResolved = auditLogs.filter(
      (l) => l.action === "ISSUE_RESOLVED"
    ).length;

    // Verify chain integrity (simplified - just check if hashes exist)
    const chainIntegrity = auditLogs.every(
      (log, index) =>
        index === auditLogs.length - 1 || log.checksum !== null
    );

    return {
      project,
      auditLogs: auditLogs.map((log) => ({
        ...log,
        previousState: log.previousState as AuditLogEntry["previousState"],
        newState: log.newState as AuditLogEntry["newState"],
        changes: log.changes as AuditLogEntry["changes"],
      })),
      stats: {
        totalEntries: auditLogs.length,
        complianceChecks,
        issuesCreated,
        issuesResolved,
        chainIntegrity,
        lastVerified: new Date(),
      },
    };
  }
);
