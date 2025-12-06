import { NextResponse } from "next/server";
import { getIssueDetail, getDemoUser } from "@/app/lib/data";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const { issueId } = await params;

    const [issue, demoUser] = await Promise.all([
      getIssueDetail(issueId),
      getDemoUser(),
    ]);

    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    return NextResponse.json({
      issue,
      demoUserId: demoUser?.id || null,
    });
  } catch (error) {
    console.error("Failed to fetch issue:", error);
    return NextResponse.json(
      { error: "Failed to fetch issue" },
      { status: 500 }
    );
  }
}
