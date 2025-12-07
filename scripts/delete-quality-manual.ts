import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local file manually
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const content = readFileSync(envPath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  } catch (e) {
    console.error("Failed to load .env.local:", e);
  }
}

loadEnv();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function deleteQualityManualForProject(projectId: string) {
  console.log(`Deleting quality manual data for project: ${projectId}`);

  // Delete ITPs first (they reference quality_manuals)
  const { data: itps, error: itpError } = await supabase
    .from("inspection_test_plans")
    .delete()
    .eq("project_id", projectId)
    .select("id");

  if (itpError) {
    console.error("Error deleting ITPs:", itpError);
  } else {
    console.log(`Deleted ${itps?.length || 0} ITPs`);
  }

  // Delete quality manuals
  const { data: manuals, error: manualError } = await supabase
    .from("quality_manuals")
    .delete()
    .eq("project_id", projectId)
    .select("id");

  if (manualError) {
    console.error("Error deleting quality manuals:", manualError);
  } else {
    console.log(`Deleted ${manuals?.length || 0} quality manuals`);
  }

  // Also delete project_specs if you want to re-test PDF upload
  const { data: specs, error: specsError } = await supabase
    .from("project_specs")
    .delete()
    .eq("project_id", projectId)
    .select("id");

  if (specsError) {
    console.error("Error deleting project specs:", specsError);
  } else {
    console.log(`Deleted ${specs?.length || 0} project specs`);
  }

  // Reset project phase to 'define'
  const { error: phaseError } = await supabase
    .from("projects")
    .update({ current_phase: "define" })
    .eq("id", projectId);

  if (phaseError) {
    console.error("Error resetting phase:", phaseError);
  } else {
    console.log("Reset project phase to 'define'");
  }

  console.log("Done!");
}

// Get project ID from command line or list projects
const projectId = process.argv[2];

if (!projectId) {
  // List all projects
  supabase.from("projects").select("id, name").then(({ data, error }) => {
    if (error) {
      console.error("Error listing projects:", error);
      return;
    }
    console.log("\nProjects:");
    data?.forEach((p) => console.log(`  ${p.id} - ${p.name}`));
    console.log("\nUsage: npx tsx scripts/delete-quality-manual.ts <project-id>");
  });
} else {
  deleteQualityManualForProject(projectId);
}
