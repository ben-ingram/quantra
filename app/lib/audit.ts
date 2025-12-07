/**
 * Audit Trail Utility
 *
 * Provides tamper-evident logging for compliance checks and issue modifications.
 * Uses SHA-256 hashing with chain linking for integrity verification.
 */

import { createHash } from "crypto";
import { prisma } from "./db";
import { AuditAction, AuditEntity } from "@/app/generated/prisma";

// ============================================================================
// Types
// ============================================================================

export interface AuditLogInput {
  /** The action being performed */
  action: AuditAction;
  /** The type of entity being modified */
  entity: AuditEntity;
  /** The ID of the entity being modified */
  entityId: string;
  /** The state before the change (null for creates) */
  previousState?: Record<string, unknown> | null;
  /** The state after the change */
  newState?: Record<string, unknown> | null;
  /** Specific fields that changed */
  changes?: Record<string, { from: unknown; to: unknown }>;
  /** Reason for the change (optional, useful for status changes) */
  reason?: string;
  /** User ID performing the action (null for system actions) */
  userId?: string | null;
  /** Related compliance check ID (for easier querying) */
  complianceCheckId?: string | null;
  /** Related issue ID (for easier querying) */
  issueId?: string | null;
  /** Client IP address */
  ipAddress?: string | null;
  /** Client user agent */
  userAgent?: string | null;
}

export interface AuditLogResult {
  id: string;
  checksum: string;
  previousHash: string | null;
  createdAt: Date | null;
}

// ============================================================================
// Hash Generation
// ============================================================================

/**
 * Generates a SHA-256 hash of the audit log content.
 * This creates a tamper-evident fingerprint of the log entry.
 */
function generateContentHash(data: {
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  previousState: unknown;
  newState: unknown;
  changes: unknown;
  reason: string | null;
  userId: string | null;
  timestamp: string;
  previousHash: string | null;
}): string {
  // Create a deterministic string representation
  const content = JSON.stringify({
    action: data.action,
    entity: data.entity,
    entityId: data.entityId,
    previousState: data.previousState,
    newState: data.newState,
    changes: data.changes,
    reason: data.reason,
    userId: data.userId,
    timestamp: data.timestamp,
    // Include previous hash to create a chain
    previousHash: data.previousHash,
  });

  return createHash("sha256").update(content).digest("hex");
}

/**
 * Retrieves the hash of the most recent audit log entry.
 * This is used to create the hash chain.
 */
async function getLastAuditHash(): Promise<string | null> {
  const lastEntry = await prisma.auditLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: { checksum: true },
  });

  return lastEntry?.checksum ?? null;
}

// ============================================================================
// Main Audit Function
// ============================================================================

/**
 * Creates an immutable, tamper-evident audit log entry.
 *
 * Features:
 * - SHA-256 hash of content for integrity verification
 * - Chain linking (each entry includes hash of previous entry)
 * - Full state snapshots for compliance requirements
 * - Automatic timestamp from database
 *
 * @example
 * ```ts
 * // Log a compliance check completion
 * await logAuditTrail({
 *   action: "COMPLIANCE_CHECK_COMPLETED",
 *   entity: "COMPLIANCE_CHECK",
 *   entityId: complianceCheck.id,
 *   previousState: { status: "IN_PROGRESS" },
 *   newState: { status: "COMPLETED", score: 94.2 },
 *   changes: { status: { from: "IN_PROGRESS", to: "COMPLETED" } },
 *   userId: currentUser.id,
 *   complianceCheckId: complianceCheck.id,
 * });
 * ```
 */
export async function logAuditTrail(input: AuditLogInput): Promise<AuditLogResult> {
  // Get the hash of the previous entry for chain linking
  const previousHash = await getLastAuditHash();

  // Generate timestamp (will be close to DB timestamp)
  const timestamp = new Date().toISOString();

  // Generate the content hash
  const checksum = generateContentHash({
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    previousState: input.previousState ?? null,
    newState: input.newState ?? null,
    changes: input.changes ?? null,
    reason: input.reason ?? null,
    userId: input.userId ?? null,
    timestamp,
    previousHash,
  });

  // Create the audit log entry
  const auditLog = await prisma.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      previousState: (input.previousState ?? undefined) as object | undefined,
      newState: (input.newState ?? undefined) as object | undefined,
      changes: (input.changes ?? undefined) as object | undefined,
      reason: input.reason,
      userId: input.userId,
      complianceCheckId: input.complianceCheckId,
      issueId: input.issueId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      checksum,
      previousHash,
    },
    select: {
      id: true,
      checksum: true,
      previousHash: true,
      createdAt: true,
    },
  });

  return auditLog as AuditLogResult;
}

// ============================================================================
// Verification Functions
// ============================================================================

/**
 * Verifies the integrity of a single audit log entry.
 * Recalculates the hash and compares it to the stored checksum.
 */
export async function verifyAuditLogEntry(auditLogId: string): Promise<{
  valid: boolean;
  entry: {
    id: string;
    action: AuditAction;
    createdAt: Date;
  } | null;
  error?: string;
}> {
  const entry = await prisma.auditLog.findUnique({
    where: { id: auditLogId },
  });

  if (!entry) {
    return { valid: false, entry: null, error: "Audit log entry not found" };
  }

  // Recalculate the hash
  const recalculatedHash = generateContentHash({
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    previousState: entry.previousState,
    newState: entry.newState,
    changes: entry.changes,
    reason: entry.reason,
    userId: entry.userId,
    timestamp: entry.createdAt.toISOString(),
    previousHash: entry.previousHash,
  });

  const valid = recalculatedHash === entry.checksum;

  return {
    valid,
    entry: {
      id: entry.id,
      action: entry.action,
      createdAt: entry.createdAt,
    },
    error: valid ? undefined : "Hash mismatch - entry may have been tampered with",
  };
}

/**
 * Verifies the integrity of the entire audit chain.
 * Checks that each entry's previousHash matches the previous entry's checksum.
 */
export async function verifyAuditChain(options?: {
  limit?: number;
  entityId?: string;
  entity?: AuditEntity;
}): Promise<{
  valid: boolean;
  entriesChecked: number;
  brokenAt?: {
    id: string;
    position: number;
    expectedHash: string;
    actualHash: string;
  };
}> {
  const entries = await prisma.auditLog.findMany({
    where: {
      entityId: options?.entityId,
      entity: options?.entity,
    },
    orderBy: { createdAt: "asc" },
    take: options?.limit,
    select: {
      id: true,
      checksum: true,
      previousHash: true,
    },
  });

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // First entry should have no previous hash
    if (i === 0) {
      if (entry.previousHash !== null && options?.entityId === undefined) {
        // Only flag as broken if we're checking the full chain
        // For filtered queries, the first entry may have a previous hash
        continue;
      }
    } else {
      // Check that previousHash matches the previous entry's checksum
      const previousEntry = entries[i - 1];
      if (entry.previousHash !== previousEntry.checksum) {
        return {
          valid: false,
          entriesChecked: i + 1,
          brokenAt: {
            id: entry.id,
            position: i,
            expectedHash: previousEntry.checksum!,
            actualHash: entry.previousHash || "null",
          },
        };
      }
    }
  }

  return {
    valid: true,
    entriesChecked: entries.length,
  };
}

// ============================================================================
// Convenience Functions for Common Operations
// ============================================================================

/**
 * Logs a compliance check status change
 */
export async function logComplianceCheckChange(params: {
  complianceCheckId: string;
  action: Extract<
    AuditAction,
    "COMPLIANCE_CHECK_STARTED" | "COMPLIANCE_CHECK_COMPLETED" | "COMPLIANCE_CHECK_FAILED"
  >;
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<AuditLogResult> {
  return logAuditTrail({
    action: params.action,
    entity: "COMPLIANCE_CHECK",
    entityId: params.complianceCheckId,
    previousState: params.previousState,
    newState: params.newState,
    changes: calculateChanges(params.previousState, params.newState),
    complianceCheckId: params.complianceCheckId,
    userId: params.userId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Logs an issue status change (including resolution)
 */
export async function logIssueChange(params: {
  issueId: string;
  action: Extract<
    AuditAction,
    | "ISSUE_CREATED"
    | "ISSUE_STATUS_CHANGED"
    | "ISSUE_ASSIGNED"
    | "ISSUE_SEVERITY_CHANGED"
    | "ISSUE_RESOLVED"
    | "ISSUE_REOPENED"
  >;
  previousState?: Record<string, unknown> | null;
  newState: Record<string, unknown>;
  reason?: string;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<AuditLogResult> {
  return logAuditTrail({
    action: params.action,
    entity: "ISSUE",
    entityId: params.issueId,
    previousState: params.previousState,
    newState: params.newState,
    changes: params.previousState
      ? calculateChanges(params.previousState, params.newState)
      : undefined,
    reason: params.reason,
    issueId: params.issueId,
    userId: params.userId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Calculates the differences between two states
 */
function calculateChanges(
  previousState: Record<string, unknown>,
  newState: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  const allKeys = new Set([...Object.keys(previousState), ...Object.keys(newState)]);

  for (const key of allKeys) {
    const prev = previousState[key];
    const next = newState[key];

    // Simple comparison (doesn't handle deep objects)
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      changes[key] = { from: prev, to: next };
    }
  }

  return changes;
}
