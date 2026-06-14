import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type {
  AiMessageRecord,
  CanvasEdgeRecord,
  CanvasNodeRecord,
  CanvasNodeType,
  FileType,
  FullWorkspaceState,
  UploadedFileRecord,
  WorkspaceRecord,
} from "./types";

export const DEFAULT_UPLOAD_BUCKET = "career-canvas-assets";

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  const isMissingTable =
    /Could not find the table .* in the schema cache/i.test(message) ||
    /relation .* does not exist/i.test(message);

  if (isMissingTable) {
    return NextResponse.json(
      {
        error: {
          code: "database_not_initialized",
          message:
            "Supabase 数据库还没有初始化。请先执行 supabase/migrations/20260614092000_career_canvas_schema.sql 创建求职画布所需的数据表和存储桶。",
        },
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { error: { code: "internal_error", message } },
    { status: 500 },
  );
}

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    throw new AppError("unauthenticated", "Please sign in first.", 401);
  }

  return { supabase, userId };
}

export function uploadBucket() {
  return process.env.APP_UPLOAD_BUCKET || DEFAULT_UPLOAD_BUCKET;
}

export function maxUploadBytes() {
  const maxMb = Number(process.env.APP_MAX_UPLOAD_MB || 10);
  return maxMb * 1024 * 1024;
}

export const supportedUploadMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/markdown",
  "text/x-markdown",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const uploadExtensionContentTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  md: "text/markdown",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function resolveSupportedUpload(filename: string, mimeType: string) {
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  const contentType = uploadExtensionContentTypes[extension];

  if (!contentType) {
    return null;
  }

  if (extension === "md") {
    return {
      extension,
      contentType,
      isSupported:
        !mimeType ||
        ["text/markdown", "text/x-markdown", "text/plain"].includes(mimeType),
    };
  }

  return {
    extension,
    contentType,
    isSupported: !mimeType || supportedUploadMimeTypes.includes(mimeType),
  };
}

export function sanitizeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

export async function getLatestWorkspace(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_workspaces")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<WorkspaceRecord>();

  if (error) {
    throw new AppError("workspace_query_failed", error.message, 500);
  }

  return data;
}

export async function createWorkspace(title: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_workspaces")
    .insert({ title, user_id: userId, status: "active" })
    .select("*")
    .single<WorkspaceRecord>();

  if (error) {
    throw new AppError("workspace_create_failed", error.message, 500);
  }

  return data;
}

export async function getWorkspaceState(
  workspaceId: string,
  userId: string,
): Promise<FullWorkspaceState> {
  const supabase = await createClient();

  const { data: workspace, error: workspaceError } = await supabase
    .from("job_workspaces")
    .select("*")
    .eq("id", workspaceId)
    .eq("user_id", userId)
    .single<WorkspaceRecord>();

  if (workspaceError || !workspace) {
    throw new AppError(
      "workspace_not_found",
      workspaceError?.message || "Workspace not found.",
      404,
    );
  }

  const [nodesResult, edgesResult, messagesResult, filesResult] =
    await Promise.all([
      supabase
        .from("canvas_nodes")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .order("position_x", { ascending: true })
        .order("created_at", { ascending: true })
        .returns<CanvasNodeRecord[]>(),
      supabase
        .from("canvas_edges")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .returns<CanvasEdgeRecord[]>(),
      supabase
        .from("ai_messages")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .returns<AiMessageRecord[]>(),
      supabase
        .from("uploaded_files")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .returns<UploadedFileRecord[]>(),
    ]);

  for (const result of [nodesResult, edgesResult, messagesResult, filesResult]) {
    if (result.error) {
      throw new AppError("workspace_state_failed", result.error.message, 500);
    }
  }

  return {
    workspace,
    nodes: nodesResult.data || [],
    edges: edgesResult.data || [],
    messages: messagesResult.data || [],
    files: filesResult.data || [],
  };
}

export function nodeTypeLabel(nodeType: CanvasNodeType) {
  const labels: Record<CanvasNodeType, string> = {
    input: "用户输入",
    persona: "用户画像",
    recommended_jobs: "推荐岗位",
    job_detail: "岗位介绍",
    jd_request: "JD 补充引导",
    jd_analysis: "JD 匹配评分与分析",
    optimization_suggestions: "简历优化建议",
    optimized_resume: "优化后的简历",
    career_change_translation: "转行能力翻译",
  };

  return labels[nodeType];
}

export function inferIntent(
  prompt: string,
  files: Array<{ file_type: FileType }>,
) {
  const lowerPrompt = prompt.toLowerCase();
  const hasJd =
    files.some((file) => file.file_type === "jd") ||
    /\bjd\b|岗位职责|任职要求|职位描述|招聘要求|job description|responsibilit|requirement/.test(
      lowerPrompt,
    );
  const asksJobDetail =
    /介绍|具体|展开|讲讲|说说|是什么|做什么|工作内容|发展|前景|路径|门槛|薪资|日常|岗位方向|职业方向/.test(
      lowerPrompt,
    );
  const asksRevision = /修改|优化|改写|revision|revise|polish/.test(
    lowerPrompt,
  );
  const asksResumeDraft =
    /优化后的简历|新版简历|生成简历|给出简历|写简历|完整简历|需要.*简历|要.*简历/.test(
      lowerPrompt,
    );

  if (!hasJd && asksResumeDraft) {
    return "optimize_resume" as const;
  }

  if (!hasJd && asksJobDetail) {
    return "job_detail" as const;
  }

  if (asksRevision && hasJd) {
    return "revise_resume" as const;
  }

  if (hasJd) {
    return "analyze_jd" as const;
  }

  return "persona" as const;
}

export function versionForType(
  nodeType: CanvasNodeType,
  existingNodes: CanvasNodeRecord[],
  plannedNodes: Array<{ nodeType?: CanvasNodeType; node_type?: CanvasNodeType }>,
) {
  return (
    existingNodes.filter((node) => node.node_type === nodeType).length +
    plannedNodes.filter(
      (node) => (node.nodeType || node.node_type) === nodeType,
    ).length +
    1
  );
}

export function positionForNode(
  nodeType: CanvasNodeType,
  version: number,
  createdIndex: number,
) {
  const baseX: Record<CanvasNodeType, number> = {
    input: 0,
    persona: 360,
    recommended_jobs: 720,
    job_detail: 1080,
    jd_request: 1260,
    jd_analysis: 1260,
    optimization_suggestions: 1620,
    optimized_resume: 1980,
    career_change_translation: 2340,
  };

  const yOffset = nodeType === "optimized_resume" ? (version - 1) * 120 : 0;

  return {
    position_x: baseX[nodeType] + (version - 1) * 36,
    position_y: 80 + yOffset + (createdIndex % 2) * 34,
  };
}

export function buildMarkdownExport(state: FullWorkspaceState) {
  const edgeNotes = state.edges.map((edge) => {
    const source = state.nodes.find((node) => node.id === edge.source_node_id);
    const target = state.nodes.find((node) => node.id === edge.target_node_id);

    if (!source || !target) {
      return null;
    }

    return `- ${source.title} -> ${target.title}: ${edge.label}`;
  });

  const nodeMarkdown = state.nodes
    .slice()
    .sort((a, b) => a.position_x - b.position_x || a.created_at.localeCompare(b.created_at))
    .map((node) => `${node.content_markdown.trim()}\n`)
    .join("\n---\n\n");

  return [
    `# ${state.workspace.title}`,
    "",
    "## Canvas Relationships",
    ...(edgeNotes.filter(Boolean) as string[]),
    "",
    "---",
    "",
    nodeMarkdown,
  ].join("\n");
}
