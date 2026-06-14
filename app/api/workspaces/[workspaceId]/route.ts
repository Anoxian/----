import { NextResponse } from "next/server";

import {
  getWorkspaceState,
  jsonError,
  requireUser,
} from "@/lib/career-canvas/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { userId } = await requireUser();
    const { workspaceId } = await params;
    const state = await getWorkspaceState(workspaceId, userId);

    return NextResponse.json(state);
  } catch (error) {
    return jsonError(error);
  }
}
