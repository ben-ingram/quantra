/**
 * Quantra - Database Seed Script
 *
 * Seeds the database with realistic demo data for the Dashboard.
 *
 * Run with: npx prisma db seed
 */

import { PrismaClient } from "../app/generated/prisma";
import { createHash } from "crypto";

const prisma = new PrismaClient();

// =============================================================================
// Helper Functions
// =============================================================================

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function hoursAgo(hours: number): Date {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date;
}

function generateChecksum(data: object): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

// =============================================================================
// Seed Data
// =============================================================================

async function main() {
  console.log("🌱 Starting database seed...\n");

  // ---------------------------------------------------------------------------
  // 1. Create Tenant - Apex Construction
  // ---------------------------------------------------------------------------
  console.log("🏢 Creating tenant: Apex Construction");

  const tenant = await prisma.tenant.upsert({
    where: { slug: "apex-construction" },
    update: {},
    create: {
      name: "Apex Construction Group",
      slug: "apex-construction",
      logoUrl: "https://api.dicebear.com/7.x/initials/svg?seed=AC&backgroundColor=3b82f6",
    },
  });

  console.log(`   ✓ Tenant created: ${tenant.id}`);

  // ---------------------------------------------------------------------------
  // 2. Create Users
  // ---------------------------------------------------------------------------
  console.log("\n👥 Creating users...");

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "john.mitchell@apexconstruction.com" },
      update: {},
      create: {
        email: "john.mitchell@apexconstruction.com",
        name: "John Mitchell",
        role: "ADMIN",
        tenantId: tenant.id,
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
      },
    }),
    prisma.user.upsert({
      where: { email: "sarah.chen@apexconstruction.com" },
      update: {},
      create: {
        email: "sarah.chen@apexconstruction.com",
        name: "Sarah Chen",
        role: "PROJECT_MANAGER",
        tenantId: tenant.id,
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
      },
    }),
    prisma.user.upsert({
      where: { email: "marcus.johnson@apexconstruction.com" },
      update: {},
      create: {
        email: "marcus.johnson@apexconstruction.com",
        name: "Marcus Johnson",
        role: "QA_INSPECTOR",
        tenantId: tenant.id,
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus",
      },
    }),
    prisma.user.upsert({
      where: { email: "emily.rodriguez@apexconstruction.com" },
      update: {},
      create: {
        email: "emily.rodriguez@apexconstruction.com",
        name: "Emily Rodriguez",
        role: "AUDITOR",
        tenantId: tenant.id,
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily",
      },
    }),
  ]);

  const [adminUser, pmUser, qaUser, auditorUser] = users;
  console.log(`   ✓ Created ${users.length} users`);

  // ---------------------------------------------------------------------------
  // 3. Create Regulatory Codes
  // ---------------------------------------------------------------------------
  console.log("\n📚 Creating regulatory codes...");

  // Helper to find or create regulatory codes (handles null tenantId)
  async function findOrCreateCode(data: {
    shortName: string;
    version: string;
    name: string;
    jurisdiction: string;
    category: string;
    effectiveDate: Date;
    content: object;
  }) {
    const existing = await prisma.regulatoryCode.findFirst({
      where: {
        shortName: data.shortName,
        version: data.version,
        tenantId: null,
      },
    });

    if (existing) return existing;

    return prisma.regulatoryCode.create({
      data: {
        ...data,
        isActive: true,
        tenantId: null,
      },
    });
  }

  const [ibcCode, ifcCode, adaCode, oshaCode] = await Promise.all([
    findOrCreateCode({
      name: "International Building Code",
      shortName: "IBC 2021",
      version: "2021",
      jurisdiction: "International",
      category: "Building",
      effectiveDate: new Date("2021-01-01"),
      content: {
        sections: [
          {
            number: "1907",
            title: "Minimum Slab Provisions",
            content:
              "Section 1907 covers reinforcement requirements for concrete slabs including rebar spacing, cover, and placement tolerances.",
          },
          {
            number: "1907.1",
            title: "General",
            content:
              "Concrete floor slabs supported directly on the ground shall meet the requirements of this section.",
          },
          {
            number: "1907.2",
            title: "Reinforcement Spacing",
            content:
              "Maximum spacing of reinforcement in slabs shall not exceed 18 inches (457 mm) or three times the slab thickness.",
          },
        ],
      },
    }),
    findOrCreateCode({
      name: "International Fire Code",
      shortName: "IFC 2021",
      version: "2021",
      jurisdiction: "International",
      category: "Fire",
      effectiveDate: new Date("2021-01-01"),
      content: {
        sections: [
          {
            number: "1031.2",
            title: "Reliability",
            content:
              "Required exit accesses, exits and exit discharges shall be continuously maintained free from obstructions.",
          },
        ],
      },
    }),
    findOrCreateCode({
      name: "ADA Standards for Accessible Design",
      shortName: "ADA 2010",
      version: "2010",
      jurisdiction: "Federal",
      category: "Accessibility",
      effectiveDate: new Date("2010-09-15"),
      content: {
        sections: [
          {
            number: "405.2",
            title: "Slope",
            content:
              "Ramp runs shall have a running slope not steeper than 1:12 (8.33%).",
          },
        ],
      },
    }),
    findOrCreateCode({
      name: "OSHA Construction Standards",
      shortName: "OSHA 1926",
      version: "2023",
      jurisdiction: "Federal",
      category: "Safety",
      effectiveDate: new Date("2023-01-01"),
      content: {
        sections: [
          {
            number: "1926.502",
            title: "Fall Protection Systems",
            content:
              "Fall protection shall be provided at elevations of 6 feet or more above a lower level.",
          },
        ],
      },
    }),
  ]);

  const codes = [ibcCode, ifcCode, adaCode, oshaCode];
  console.log(`   ✓ Created ${codes.length} regulatory codes`);

  // ---------------------------------------------------------------------------
  // 4. Create Project - Metro Station Hub
  // ---------------------------------------------------------------------------
  console.log("\n🏗️  Creating project: Metro Station Hub");

  const project = await prisma.project.upsert({
    where: { id: "proj_metro_station_hub" },
    update: {},
    create: {
      id: "proj_metro_station_hub",
      name: "Metro Station Hub",
      description:
        "Mixed-use transit-oriented development featuring a 12-story residential tower above ground-level retail and direct metro station access. The project includes 280 residential units, 45,000 sq ft of retail space, and a 3-level underground parking structure.",
      address: "1250 Transit Way, Downtown District, Metro City, MC 10001",
      status: "ACTIVE",
      startDate: new Date("2024-03-15"),
      endDate: new Date("2026-08-30"),
      bimModelUrl: "s3://quantra-bim/metro-station-hub/model-v2.4.ifc",
      bimModelVersion: "v2.4.1",
      tenantId: tenant.id,
    },
  });

  console.log(`   ✓ Project created: ${project.id}`);

  // Assign users to project
  await Promise.all(
    users.map((user) =>
      prisma.projectAssignment.upsert({
        where: {
          userId_projectId: {
            userId: user.id,
            projectId: project.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          projectId: project.id,
        },
      })
    )
  );
  console.log(`   ✓ Assigned ${users.length} users to project`);

  // Link regulatory codes to project
  await Promise.all(
    codes.map((code) =>
      prisma.projectRegulatoryCode.upsert({
        where: {
          projectId_regulatoryCodeId: {
            projectId: project.id,
            regulatoryCodeId: code.id,
          },
        },
        update: {},
        create: {
          projectId: project.id,
          regulatoryCodeId: code.id,
        },
      })
    )
  );
  console.log(`   ✓ Linked ${codes.length} regulatory codes to project`);

  // ---------------------------------------------------------------------------
  // 5. Create Scans (Last 3 Nights)
  // ---------------------------------------------------------------------------
  console.log("\n📸 Creating scans...");

  const scan1 = await prisma.scan.create({
    data: {
      name: "Foundation Level B3 - Night Scan",
      status: "COMPLETED",
      scanType: "DRONE",
      s3Url: "s3://quantra-scans/metro-station-hub/2024-01/scan-001.las",
      processedUrl: "s3://quantra-scans/metro-station-hub/2024-01/scan-001-processed.las",
      thumbnailUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400",
      capturedAt: daysAgo(3),
      fileSize: BigInt(2_450_000_000), // 2.45 GB
      metadata: {
        droneModel: "DJI Matrice 350 RTK",
        flightAltitude: "15m",
        pointDensity: "450 pts/m²",
        coverageArea: "12,500 m²",
        weatherConditions: "Clear, 12°C",
      },
      processingStartedAt: daysAgo(3),
      processingCompletedAt: hoursAgo(70),
      projectId: project.id,
      uploadedById: qaUser.id,
    },
  });

  const scan2 = await prisma.scan.create({
    data: {
      name: "Parking Structure P2 - Night Scan",
      status: "COMPLETED",
      scanType: "LIDAR",
      s3Url: "s3://quantra-scans/metro-station-hub/2024-01/scan-002.las",
      processedUrl: "s3://quantra-scans/metro-station-hub/2024-01/scan-002-processed.las",
      thumbnailUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400",
      capturedAt: daysAgo(2),
      fileSize: BigInt(3_120_000_000), // 3.12 GB
      metadata: {
        scannerModel: "Leica RTC360",
        scanResolution: "3mm @ 10m",
        numberOfStations: 24,
        coverageArea: "8,200 m²",
        weatherConditions: "Overcast, 8°C",
      },
      processingStartedAt: daysAgo(2),
      processingCompletedAt: hoursAgo(46),
      projectId: project.id,
      uploadedById: qaUser.id,
    },
  });

  const scan3 = await prisma.scan.create({
    data: {
      name: "Ground Floor Retail - Night Scan",
      status: "PROCESSING",
      scanType: "DRONE",
      s3Url: "s3://quantra-scans/metro-station-hub/2024-01/scan-003.las",
      thumbnailUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400",
      capturedAt: hoursAgo(4),
      fileSize: BigInt(2_890_000_000), // 2.89 GB
      metadata: {
        droneModel: "DJI Matrice 350 RTK",
        flightAltitude: "8m",
        pointDensity: "520 pts/m²",
        coverageArea: "15,800 m²",
        weatherConditions: "Clear, 6°C",
      },
      processingStartedAt: hoursAgo(3),
      projectId: project.id,
      uploadedById: qaUser.id,
    },
  });

  console.log(`   ✓ Created 3 scans`);

  // ---------------------------------------------------------------------------
  // 6. Create Compliance Checks
  // ---------------------------------------------------------------------------
  console.log("\n✅ Creating compliance checks...");

  const complianceCheck1 = await prisma.complianceCheck.create({
    data: {
      status: "COMPLETED",
      overallScore: 42.0,
      summary:
        "Critical violation detected: Rebar spacing in foundation slab B3-Section 4 exceeds IBC 2021 maximum allowable variance. Immediate remediation required before concrete pour.",
      aiModelVersion: "gpt-4o",
      findings: {
        status: "FAIL",
        citation: "IBC 2021 Section 1907.2",
        riskScore: 9,
        reasoning:
          "Measured rebar spacing of 24 inches exceeds the maximum permitted spacing of 18 inches per IBC 2021 Section 1907.2. This represents a 33% variance from code requirements and poses significant structural integrity concerns.",
        riskFactors: {
          lifeSafety: "CRITICAL",
          reworkCost: "HIGH",
          scheduleImpact: "HIGH",
        },
        recommendations: [
          "Halt concrete pour operations in affected section",
          "Re-space rebar to maximum 18-inch centers",
          "Conduct structural engineering review",
          "Document remediation with photo evidence",
        ],
        confidence: 0.94,
      },
      rawAiResponse: {
        model: "gpt-4o",
        usage: { prompt_tokens: 1250, completion_tokens: 380 },
      },
      startedAt: hoursAgo(68),
      completedAt: hoursAgo(68),
      processingTimeMs: 4520,
      scanId: scan1.id,
      regulatoryCodeId: ibcCode.id,
    },
  });

  const complianceCheck2 = await prisma.complianceCheck.create({
    data: {
      status: "COMPLETED",
      overallScore: 68.0,
      summary:
        "Warning: Construction debris partially obstructing designated fire exit path in parking level P2. Requires attention within 24 hours.",
      aiModelVersion: "gpt-4o",
      findings: {
        status: "WARNING",
        citation: "IFC 2021 Section 1031.2",
        riskScore: 6,
        reasoning:
          "Scan analysis detected construction materials and debris reducing the clear width of the emergency egress route by approximately 40%. While passage is still possible, this condition violates the continuous maintenance requirement.",
        riskFactors: {
          lifeSafety: "MEDIUM",
          reworkCost: "LOW",
          scheduleImpact: "LOW",
        },
        recommendations: [
          "Clear debris from fire exit corridor within 24 hours",
          "Establish designated material staging areas away from egress paths",
          "Brief site crews on egress path maintenance requirements",
        ],
        confidence: 0.89,
      },
      rawAiResponse: {
        model: "gpt-4o",
        usage: { prompt_tokens: 980, completion_tokens: 290 },
      },
      startedAt: hoursAgo(44),
      completedAt: hoursAgo(44),
      processingTimeMs: 3890,
      scanId: scan2.id,
      regulatoryCodeId: ifcCode.id,
    },
  });

  const complianceCheck3 = await prisma.complianceCheck.create({
    data: {
      status: "COMPLETED",
      overallScore: 96.0,
      summary:
        "Pass: Accessible ramp gradient verified compliant with ADA 2010 standards. Measured slope of 1:13 is within acceptable tolerance.",
      aiModelVersion: "gpt-4o",
      findings: {
        status: "PASS",
        citation: "ADA 2010 Section 405.2",
        riskScore: 1,
        reasoning:
          "Point cloud analysis confirms ramp running slope of 7.69% (1:13), which is less steep than the maximum permitted 8.33% (1:12). The ramp meets accessibility requirements.",
        riskFactors: {
          lifeSafety: "LOW",
          reworkCost: "LOW",
          scheduleImpact: "LOW",
        },
        recommendations: [],
        confidence: 0.97,
      },
      rawAiResponse: {
        model: "gpt-4o",
        usage: { prompt_tokens: 820, completion_tokens: 180 },
      },
      startedAt: hoursAgo(45),
      completedAt: hoursAgo(45),
      processingTimeMs: 2340,
      scanId: scan2.id,
      regulatoryCodeId: adaCode.id,
    },
  });

  console.log(`   ✓ Created 3 compliance checks`);

  // ---------------------------------------------------------------------------
  // 7. Create Issues
  // ---------------------------------------------------------------------------
  console.log("\n⚠️  Creating issues...");

  // Issue 1: CRITICAL - Rebar spacing
  const issue1 = await prisma.issue.create({
    data: {
      title: "Rebar spacing exceeds maximum variance - Foundation B3",
      description:
        "Automated scan analysis detected rebar spacing of 24 inches in foundation slab section B3-4, exceeding the IBC 2021 maximum of 18 inches. This 33% variance poses significant structural concerns and requires immediate remediation before any concrete pour operations.",
      status: "OPEN",
      severity: "CRITICAL",
      severityScore: 95,
      scheduleImpact: "HIGH",
      safetyImpact: "CRITICAL",
      costImpact: "HIGH",
      location: "Foundation Level B3, Section 4, Grid Lines D-F / 12-15",
      coordinates: { x: 145.2, y: -28.5, z: -9.0 },
      bimElementId: "Foundation_Slab_B3_004",
      codeReference: "IBC 2021 Section 1907.2",
      evidenceUrls: [
        "s3://quantra-evidence/metro-station-hub/ISS-001/scan-overlay.png",
        "s3://quantra-evidence/metro-station-hub/ISS-001/measurement-detail.png",
      ],
      aiAnalysis:
        "Point cloud analysis measured rebar spacing at 24.3 inches average across a 450 sq ft area. IBC 2021 Section 1907.2 specifies maximum spacing of 18 inches for structural slabs. Confidence: 94%. Recommended action: Halt operations and re-space reinforcement.",
      detectedAt: hoursAgo(68),
      dueDate: hoursAgo(-24), // Due tomorrow
      projectId: project.id,
      scanId: scan1.id,
      complianceCheckId: complianceCheck1.id,
      createdById: qaUser.id,
      assignedToId: pmUser.id,
    },
  });

  // Issue 2: HIGH - Fire exit debris
  const issue2 = await prisma.issue.create({
    data: {
      title: "Construction debris blocking fire exit path - P2",
      description:
        "Debris and construction materials have accumulated in the fire exit corridor on parking level P2, reducing clear passage width by approximately 40%. While egress is still possible, this condition violates IFC requirements for continuous maintenance of exit paths.",
      status: "IN_PROGRESS",
      severity: "HIGH",
      severityScore: 72,
      scheduleImpact: "LOW",
      safetyImpact: "HIGH",
      costImpact: "LOW",
      location: "Parking Level P2, Fire Exit Corridor E2, near Stairwell B",
      coordinates: { x: 78.4, y: 12.1, z: -6.0 },
      bimElementId: "Corridor_P2_E2",
      codeReference: "IFC 2021 Section 1031.2",
      evidenceUrls: [
        "s3://quantra-evidence/metro-station-hub/ISS-002/corridor-view.png",
      ],
      aiAnalysis:
        "Scan detected obstruction reducing corridor clear width from 72 inches to approximately 43 inches. Minimum required clear width is 44 inches per egress calculations. Immediate attention required.",
      detectedAt: hoursAgo(44),
      dueDate: hoursAgo(-8), // Due in 8 hours
      projectId: project.id,
      scanId: scan2.id,
      complianceCheckId: complianceCheck2.id,
      createdById: qaUser.id,
      assignedToId: qaUser.id,
    },
  });

  // Issue 3: MEDIUM - Minor concrete crack
  const issue3 = await prisma.issue.create({
    data: {
      title: "Hairline crack observed in P2 column C-14",
      description:
        "Scan analysis identified a hairline crack (approximately 0.3mm width) on the surface of structural column C-14 on parking level P2. While within acceptable limits, this should be monitored and documented for structural review.",
      status: "OPEN",
      severity: "MEDIUM",
      severityScore: 45,
      scheduleImpact: "LOW",
      safetyImpact: "MEDIUM",
      costImpact: "LOW",
      location: "Parking Level P2, Column C-14",
      coordinates: { x: 92.0, y: -5.3, z: -6.0 },
      bimElementId: "Column_P2_C14",
      codeReference: "ACI 318-19 Section 24.3",
      evidenceUrls: [
        "s3://quantra-evidence/metro-station-hub/ISS-003/crack-detail.png",
      ],
      aiAnalysis:
        "Surface analysis detected linear feature consistent with hairline crack. Measured width: 0.3mm. ACI 318-19 permits cracks up to 0.4mm for this exposure category. Recommend monitoring during next scan cycle.",
      detectedAt: hoursAgo(44),
      projectId: project.id,
      scanId: scan2.id,
      createdById: qaUser.id,
    },
  });

  // Issue 4: LOW - Documentation gap
  const issue4 = await prisma.issue.create({
    data: {
      title: "Missing weld inspection tag - Steel connection S-42",
      description:
        "Quality documentation gap identified: Steel connection S-42 in the ground floor retail area is missing the required weld inspection tag. The weld appears compliant but requires proper documentation.",
      status: "OPEN",
      severity: "LOW",
      severityScore: 25,
      scheduleImpact: "LOW",
      safetyImpact: "LOW",
      costImpact: "LOW",
      location: "Ground Floor Retail, Steel Connection S-42, Grid A-3",
      coordinates: { x: 12.5, y: 34.8, z: 0.0 },
      bimElementId: "Steel_Connection_S42",
      codeReference: "AWS D1.1 Section 6.5",
      evidenceUrls: [],
      aiAnalysis:
        "Visual analysis confirmed presence of structural weld but no inspection documentation visible. Administrative issue - recommend scheduling inspection and documentation update.",
      detectedAt: hoursAgo(20),
      projectId: project.id,
      createdById: qaUser.id,
    },
  });

  // Issue 5: RESOLVED - Previously fixed issue
  const issue5 = await prisma.issue.create({
    data: {
      title: "Temporary shoring removal sequence deviation",
      description:
        "Scan detected potential deviation from approved shoring removal sequence in foundation section B2. Field verification confirmed the sequence was corrected before any structural concerns arose.",
      status: "RESOLVED",
      severity: "HIGH",
      severityScore: 68,
      scheduleImpact: "MEDIUM",
      safetyImpact: "HIGH",
      costImpact: "LOW",
      location: "Foundation Level B2, Shoring Zone SZ-3",
      coordinates: { x: 110.0, y: -15.2, z: -9.0 },
      bimElementId: "Shoring_Zone_SZ3",
      codeReference: "Project Spec Section 03 15 00",
      evidenceUrls: [
        "s3://quantra-evidence/metro-station-hub/ISS-005/before.png",
        "s3://quantra-evidence/metro-station-hub/ISS-005/after.png",
      ],
      aiAnalysis:
        "Initial scan flagged shoring configuration inconsistency. Follow-up verification confirmed field team had already identified and corrected the sequence per structural engineer direction.",
      resolution:
        "Field team corrected shoring removal sequence prior to scan analysis completion. Structural engineer verified and approved corrected sequence. No structural impact occurred.",
      detectedAt: daysAgo(5),
      resolvedAt: daysAgo(4),
      projectId: project.id,
      scanId: scan1.id,
      createdById: qaUser.id,
      assignedToId: pmUser.id,
      resolvedById: pmUser.id,
    },
  });

  console.log(`   ✓ Created 5 issues`);

  // ---------------------------------------------------------------------------
  // 8. Create Audit Logs
  // ---------------------------------------------------------------------------
  console.log("\n📋 Creating audit logs...");

  let previousHash: string | null = null;

  // Audit log for compliance check completion
  const auditData1 = {
    action: "COMPLIANCE_CHECK_COMPLETED",
    entity: "COMPLIANCE_CHECK",
    entityId: complianceCheck1.id,
    timestamp: hoursAgo(68).toISOString(),
    previousHash: null,
  };
  const checksum1 = generateChecksum(auditData1);

  await prisma.auditLog.create({
    data: {
      action: "COMPLIANCE_CHECK_COMPLETED",
      entity: "COMPLIANCE_CHECK",
      entityId: complianceCheck1.id,
      previousState: { status: "IN_PROGRESS" },
      newState: {
        status: "COMPLETED",
        overallScore: 42.0,
        findings: "FAIL - IBC 2021 Section 1907.2",
      },
      changes: {
        status: { from: "IN_PROGRESS", to: "COMPLETED" },
        overallScore: { from: null, to: 42.0 },
      },
      checksum: checksum1,
      previousHash: null,
      userId: qaUser.id,
      complianceCheckId: complianceCheck1.id,
      createdAt: hoursAgo(68),
    },
  });
  previousHash = checksum1;

  // Audit log for critical issue creation
  const auditData2 = {
    action: "ISSUE_CREATED",
    entity: "ISSUE",
    entityId: issue1.id,
    timestamp: hoursAgo(68).toISOString(),
    previousHash,
  };
  const checksum2 = generateChecksum(auditData2);

  await prisma.auditLog.create({
    data: {
      action: "ISSUE_CREATED",
      entity: "ISSUE",
      entityId: issue1.id,
      previousState: null,
      newState: {
        status: "OPEN",
        severity: "CRITICAL",
        title: issue1.title,
      },
      checksum: checksum2,
      previousHash,
      userId: qaUser.id,
      issueId: issue1.id,
      createdAt: hoursAgo(68),
    },
  });
  previousHash = checksum2;

  // Audit log for issue assignment
  const auditData3 = {
    action: "ISSUE_ASSIGNED",
    entity: "ISSUE",
    entityId: issue1.id,
    timestamp: hoursAgo(67).toISOString(),
    previousHash,
  };
  const checksum3 = generateChecksum(auditData3);

  await prisma.auditLog.create({
    data: {
      action: "ISSUE_ASSIGNED",
      entity: "ISSUE",
      entityId: issue1.id,
      previousState: { assignedToId: null },
      newState: { assignedToId: pmUser.id },
      changes: { assignedToId: { from: null, to: pmUser.id } },
      reason: "Critical issue assigned to PM for immediate attention",
      checksum: checksum3,
      previousHash,
      userId: qaUser.id,
      issueId: issue1.id,
      createdAt: hoursAgo(67),
    },
  });
  previousHash = checksum3;

  // Audit log for resolved issue
  const auditData4 = {
    action: "ISSUE_RESOLVED",
    entity: "ISSUE",
    entityId: issue5.id,
    timestamp: daysAgo(4).toISOString(),
    previousHash,
  };
  const checksum4 = generateChecksum(auditData4);

  await prisma.auditLog.create({
    data: {
      action: "ISSUE_RESOLVED",
      entity: "ISSUE",
      entityId: issue5.id,
      previousState: { status: "OPEN" },
      newState: { status: "RESOLVED", resolvedAt: daysAgo(4).toISOString() },
      changes: { status: { from: "OPEN", to: "RESOLVED" } },
      reason: issue5.resolution,
      checksum: checksum4,
      previousHash,
      userId: pmUser.id,
      issueId: issue5.id,
      createdAt: daysAgo(4),
    },
  });

  console.log(`   ✓ Created 4 audit log entries with hash chain`);

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log("✅ SEED COMPLETE");
  console.log("=".repeat(60));
  console.log("\n📊 Summary:");
  console.log(`   • 1 Tenant (Apex Construction)`);
  console.log(`   • ${users.length} Users (Admin, PM, QA Inspector, Auditor)`);
  console.log(`   • ${codes.length} Regulatory Codes (IBC, IFC, ADA, OSHA)`);
  console.log(`   • 1 Project (Metro Station Hub)`);
  console.log(`   • 3 Scans (2 Completed, 1 Processing)`);
  console.log(`   • 3 Compliance Checks (1 FAIL, 1 WARNING, 1 PASS)`);
  console.log(`   • 5 Issues (1 CRITICAL, 1 HIGH, 1 MEDIUM, 1 LOW, 1 RESOLVED)`);
  console.log(`   • 4 Audit Log Entries (with SHA-256 hash chain)`);
  console.log("\n🚀 Your dashboard is ready!");
  console.log(`   Visit: /projects/${project.id}`);
  console.log();
}

// =============================================================================
// Execute
// =============================================================================

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
