"use server";

import { prisma } from "@/app/lib/db";
import { logIssueChange } from "@/app/lib/audit";
import { IssueStatus } from "@/app/generated/prisma";
import { headers } from "next/headers";

// ============================================================================
// Types
// ============================================================================

interface ResolveIssueInput {
  issueId: string;
  resolution: string;
  userId: string;
}

interface ResolveIssueResult {
  success: boolean;
  issue?: {
    id: string;
    status: IssueStatus;
    resolvedAt: Date | null;
  };
  auditLogId?: string;
  error?: string;
}

interface UpdateIssueStatusInput {
  issueId: string;
  status: IssueStatus;
  reason?: string;
  userId: string;
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Resolves an issue and creates an audit log entry.
 *
 * This action:
 * 1. Fetches the current issue state
 * 2. Updates the issue to RESOLVED status
 * 3. Creates a tamper-evident audit log entry
 *
 * @example
 * ```tsx
 * // In a client component
 * const handleResolve = async () => {
 *   const result = await resolveIssue({
 *     issueId: "issue_123",
 *     resolution: "Ramp slope corrected to 1:12 ratio",
 *     userId: currentUser.id,
 *   });
 *
 *   if (result.success) {
 *     toast.success("Issue resolved");
 *   }
 * };
 * ```
 */
export async function resolveIssue(input: ResolveIssueInput): Promise<ResolveIssueResult> {
  try {
    // Get request metadata for audit trail
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip");
    const userAgent = headersList.get("user-agent");

    // Fetch current issue state
    const currentIssue = await prisma.issue.findUnique({
      where: { id: input.issueId },
    });

    if (!currentIssue) {
      return { success: false, error: "Issue not found" };
    }

    if (currentIssue.status === "RESOLVED") {
      return { success: false, error: "Issue is already resolved" };
    }

    // Capture previous state for audit
    const previousState = {
      status: currentIssue.status,
      resolution: currentIssue.resolution,
      resolvedAt: currentIssue.resolvedAt,
      resolvedById: currentIssue.resolvedById,
    };

    // Update the issue
    const resolvedAt = new Date();
    const updatedIssue = await prisma.issue.update({
      where: { id: input.issueId },
      data: {
        status: "RESOLVED",
        resolution: input.resolution,
        resolvedAt,
        resolvedById: input.userId,
      },
      select: {
        id: true,
        status: true,
        resolvedAt: true,
      },
    });

    // Create audit log entry
    const newState = {
      status: updatedIssue.status,
      resolution: input.resolution,
      resolvedAt: resolvedAt.toISOString(),
      resolvedById: input.userId,
    };

    const auditLog = await logIssueChange({
      issueId: input.issueId,
      action: "ISSUE_RESOLVED",
      previousState,
      newState,
      reason: input.resolution,
      userId: input.userId,
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      issue: updatedIssue,
      auditLogId: auditLog.id,
    };
  } catch (error) {
    console.error("Failed to resolve issue:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to resolve issue",
    };
  }
}

/**
 * Updates an issue's status with full audit trail.
 *
 * @example
 * ```tsx
 * // Reopen an issue
 * await updateIssueStatus({
 *   issueId: "issue_123",
 *   status: "REOPENED",
 *   reason: "Fix was incomplete, defect still present",
 *   userId: currentUser.id,
 * });
 * ```
 */
export async function updateIssueStatus(
  input: UpdateIssueStatusInput
): Promise<ResolveIssueResult> {
  try {
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip");
    const userAgent = headersList.get("user-agent");

    // Fetch current issue state
    const currentIssue = await prisma.issue.findUnique({
      where: { id: input.issueId },
    });

    if (!currentIssue) {
      return { success: false, error: "Issue not found" };
    }

    // Capture previous state
    const previousState = {
      status: currentIssue.status,
      resolvedAt: currentIssue.resolvedAt,
      resolvedById: currentIssue.resolvedById,
    };

    // Determine the audit action based on status transition
    let auditAction: "ISSUE_STATUS_CHANGED" | "ISSUE_RESOLVED" | "ISSUE_REOPENED" =
      "ISSUE_STATUS_CHANGED";

    if (input.status === "RESOLVED") {
      auditAction = "ISSUE_RESOLVED";
    } else if (input.status === "REOPENED") {
      auditAction = "ISSUE_REOPENED";
    }

    // Update the issue
    const updatedIssue = await prisma.issue.update({
      where: { id: input.issueId },
      data: {
        status: input.status,
        // Clear resolution data if reopening
        ...(input.status === "REOPENED" && {
          resolvedAt: null,
          resolvedById: null,
        }),
      },
      select: {
        id: true,
        status: true,
        resolvedAt: true,
      },
    });

    // Create audit log entry
    const newState = {
      status: updatedIssue.status,
      resolvedAt: updatedIssue.resolvedAt,
    };

    const auditLog = await logIssueChange({
      issueId: input.issueId,
      action: auditAction,
      previousState,
      newState,
      reason: input.reason,
      userId: input.userId,
      ipAddress,
      userAgent,
    });

    return {
      success: true,
      issue: updatedIssue,
      auditLogId: auditLog.id,
    };
  } catch (error) {
    console.error("Failed to update issue status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update issue status",
    };
  }
}
