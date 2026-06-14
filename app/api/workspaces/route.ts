import { NextResponse } from "next/server";

import {
  createWorkspace,
  getLatestWorkspace,
  jsonError,
  requireUser,
} from "@/lib/career-canvas/server";

export async function GET() {
  try {
    const { userId } = await requireUser();
    const workspace = await getLatestWorkspace(userId);

    return NextResponse.json({ workspace });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireUser();
    const body = await request.json().catch(() => ({}));
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "AI 求职画布";

    const workspace = await createWorkspace(title, userId);

    return NextResponse.json({ workspaceId: workspace.id, workspace });
  } catch (error) {
    return jsonError(error);
  }
}
