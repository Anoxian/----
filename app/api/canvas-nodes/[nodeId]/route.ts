import { NextResponse } from "next/server";

import {
  AppError,
  jsonError,
  requireUser,
} from "@/lib/career-canvas/server";
import type { CanvasNodeRecord } from "@/lib/career-canvas/types";

const minNodeWidth = 300;
const maxNodeWidth = 680;
const minNodeHeight = 220;
const maxNodeHeight = 2600;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ nodeId: string }> },
) {
  try {
    const { supabase, userId } = await requireUser();
    const { nodeId } = await params;
    const body = await request.json().catch(() => ({}));
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId : "";
    const width = Number(body.width);
    const height = Number(body.height);
    const positionX = Number(body.positionX);
    const positionY = Number(body.positionY);
    const hasDimensions = Number.isFinite(width) && Number.isFinite(height);
    const hasPosition =
      Number.isFinite(positionX) && Number.isFinite(positionY);

    if (!workspaceId) {
      throw new AppError("missing_workspace", "workspaceId is required.");
    }

    if (!hasDimensions && !hasPosition) {
      throw new AppError("invalid_node_update", "Node update is invalid.");
    }

    const { data: existingNode, error: readError } = await supabase
      .from("canvas_nodes")
      .select("*")
      .eq("id", nodeId)
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .single<CanvasNodeRecord>();

    if (readError || !existingNode) {
      throw new AppError(
        "node_not_found",
        readError?.message || "Canvas node not found.",
        404,
      );
    }

    const metadata: Record<string, unknown> = {
      ...(existingNode.metadata || {}),
    };

    if (hasDimensions) {
      metadata.dimensions = {
        width: Math.round(clamp(width, minNodeWidth, maxNodeWidth)),
        height: Math.round(clamp(height, minNodeHeight, maxNodeHeight)),
        source: "manual",
      };
    }

    if (hasPosition) {
      metadata.position = {
        x: Math.round(positionX),
        y: Math.round(positionY),
        source: "manual",
      };
    }

    const { data, error } = await supabase
      .from("canvas_nodes")
      .update({
        metadata,
        ...(hasPosition
          ? {
              position_x: Math.round(positionX),
              position_y: Math.round(positionY),
            }
          : {}),
      })
      .eq("id", nodeId)
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .select("*")
      .single<CanvasNodeRecord>();

    if (error) {
      throw new AppError("node_update_failed", error.message, 500);
    }

    return NextResponse.json({ node: data });
  } catch (error) {
    return jsonError(error);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
