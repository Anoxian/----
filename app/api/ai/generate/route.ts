import { NextResponse } from "next/server";

import { extractUploadedFileText } from "@/lib/career-canvas/file-extraction";
import { generateCanvas } from "@/lib/career-canvas/ai-provider";
import { buildCanvasLayout } from "@/lib/career-canvas/layout";
import {
  AppError,
  getWorkspaceState,
  inferIntent,
  jsonError,
  nodeTypeLabel,
  positionForNode,
  requireUser,
  uploadBucket,
  versionForType,
} from "@/lib/career-canvas/server";
import type {
  AiMessageRecord,
  CanvasEdgeRecord,
  CanvasNodeRecord,
  CanvasNodeType,
  FileType,
  GenerateCanvasOutput,
  GenerationIntent,
  UploadedFileRecord,
} from "@/lib/career-canvas/types";

const supportedNodeTypes: CanvasNodeType[] = [
  "input",
  "persona",
  "recommended_jobs",
  "job_detail",
  "jd_request",
  "jd_analysis",
  "optimization_suggestions",
  "optimized_resume",
  "career_change_translation",
];

const supportedIntents: GenerationIntent[] = [
  "onboarding",
  "persona",
  "recommend_jobs",
  "job_detail",
  "analyze_jd",
  "optimize_resume",
  "revise_resume",
];

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const body = await request.json().catch(() => ({}));
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId : "";
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const fileIds = Array.isArray(body.fileIds)
      ? body.fileIds.filter((id: unknown): id is string => typeof id === "string")
      : [];

    if (!workspaceId) {
      throw new AppError("missing_workspace", "workspaceId is required.");
    }

    const state = await getWorkspaceState(workspaceId, userId);
    const files =
      fileIds.length > 0
        ? await loadFiles(fileIds, workspaceId, userId)
        : [];
    const intent = resolveIntent(body.intent, prompt, files, state.nodes);

    const { data: userMessage, error: messageError } = await supabase
      .from("ai_messages")
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: "user",
        content: prompt || summarizeFiles(files),
        created_node_ids: [],
      })
      .select("*")
      .single();

    if (messageError) {
      throw new AppError("message_create_failed", messageError.message, 500);
    }

    const filesWithContent = await Promise.all(
      files.map(async (file) => ({
        id: file.id,
        type: file.file_type,
        mimeType: file.mime_type,
        storagePath: file.storage_path,
        originalFilename: file.original_filename,
        signedUrl: await signedUrlFor(file),
        ...(await extractedContentFor(file)),
      })),
    );

    const output = await generateCanvas({
      workspaceId,
      prompt,
      files: filesWithContent,
      intent,
      existingNodes: state.nodes,
      messages: state.messages,
    });

    const createdNodes: CanvasNodeRecord[] = [];
    const nodesToCreate = [
      buildUserInputNode(prompt, files, filesWithContent),
      ...filterOutputNodes(output.nodes, intent, prompt),
    ];

    for (const [index, node] of nodesToCreate.entries()) {
      if (!supportedNodeTypes.includes(node.nodeType)) {
        continue;
      }

      const titleInfo = titleForNode(node, state.nodes, createdNodes);
      const version = titleInfo.version;
      const title = titleInfo.title;
      const position = positionForNode(node.nodeType, version, index);
      const contentMarkdown = ensureVersionedTitle(
        node.contentMarkdown,
        title,
      );

      const { data, error } = await supabase
        .from("canvas_nodes")
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          node_type: node.nodeType,
          title,
          content_markdown: contentMarkdown,
          version,
          ...position,
          metadata: {
            ...(node.metadata || {}),
            prompt,
            fileIds,
            intent,
            tempId: node.tempId,
          },
        })
        .select("*")
        .single<CanvasNodeRecord>();

      if (error) {
        throw new AppError("node_create_failed", error.message, 500);
      }

      createdNodes.push(data);
    }

    const createdNodeIds = createdNodes.map((node) => node.id);
    const currentMessageForLayout = {
      ...userMessage,
      created_node_ids: createdNodeIds,
    } as AiMessageRecord;
    const layout = buildCanvasLayout(
      [...state.nodes, ...createdNodes],
      [...state.messages, currentMessageForLayout],
    );
    const layoutByNodeId = new Map(
      layout.map((item) => [item.node.id, item.position]),
    );

    for (const node of createdNodes) {
      const position = layoutByNodeId.get(node.id);

      if (!position) {
        continue;
      }

      const { error } = await supabase
        .from("canvas_nodes")
        .update({
          position_x: position.x,
          position_y: position.y,
        })
        .eq("id", node.id)
        .eq("user_id", userId);

      if (error) {
        throw new AppError("node_position_update_failed", error.message, 500);
      }

      node.position_x = position.x;
      node.position_y = position.y;
    }

    const createdEdges: CanvasEdgeRecord[] = [];
    const orderedNodes = createdNodes.sort(
      (a, b) =>
        a.position_x - b.position_x ||
        a.position_y - b.position_y ||
        a.created_at.localeCompare(b.created_at),
    );

    for (let index = 0; index < orderedNodes.length - 1; index += 1) {
      const source = orderedNodes[index];
      const target = orderedNodes[index + 1];
      const { data, error } = await supabase
        .from("canvas_edges")
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          source_node_id: source.id,
          target_node_id: target.id,
          label: relationshipLabel(source.node_type, target.node_type),
        })
        .select("*")
        .single<CanvasEdgeRecord>();

      if (error) {
        throw new AppError("edge_create_failed", error.message, 500);
      }

      createdEdges.push(data);
    }

    const { error: assistantMessageError } = await supabase
      .from("ai_messages")
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: "assistant",
        content: output.assistantMessage,
        created_node_ids: createdNodeIds,
      });

    if (assistantMessageError) {
      throw new AppError(
        "assistant_message_failed",
        assistantMessageError.message,
        500,
      );
    }

    await supabase
      .from("ai_messages")
      .update({ created_node_ids: createdNodeIds })
      .eq("id", userMessage.id)
      .eq("user_id", userId);

    await supabase
      .from("job_workspaces")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", workspaceId)
      .eq("user_id", userId);

    return NextResponse.json({
      message: output.assistantMessage,
      createdNodes,
      createdEdges,
    });
  } catch (error) {
    return jsonError(error);
  }
}

function filterOutputNodes(
  nodes: GenerateCanvasOutput["nodes"],
  intent: GenerationIntent,
  prompt: string,
) {
  const allowedTypes = allowedNodeTypesForTurn(intent, prompt);

  return nodes.filter(
    (node) => node.nodeType !== "input" && allowedTypes.has(node.nodeType),
  );
}

function resolveIntent(
  requestedIntent: unknown,
  prompt: string,
  files: UploadedFileRecord[],
  existingNodes: CanvasNodeRecord[],
) {
  if (
    typeof requestedIntent === "string" &&
    supportedIntents.includes(requestedIntent as GenerationIntent)
  ) {
    return requestedIntent as GenerationIntent;
  }

  const hasOptimizationSuggestions = existingNodes.some(
    (node) => node.node_type === "optimization_suggestions",
  );
  const respondsToResumeDraftOffer =
    hasOptimizationSuggestions &&
    /需要|要|生成|给出|写|完整简历|新版简历|优化后的简历|不需要|不用|不要|暂时不/i.test(
      prompt,
    );

  if (respondsToResumeDraftOffer) {
    return "optimize_resume" as const;
  }

  if (looksLikeJobDetailPrompt(prompt, files, existingNodes)) {
    return "job_detail" as const;
  }

  return inferIntent(prompt, files);
}

function looksLikeJobDetailPrompt(
  prompt: string,
  files: UploadedFileRecord[],
  existingNodes: CanvasNodeRecord[],
) {
  if (!prompt.trim() || files.some((file) => file.file_type === "jd")) {
    return false;
  }

  const hasRecommendations = existingNodes.some(
    (node) => node.node_type === "recommended_jobs",
  );
  const asksRoleDetail =
    /介绍|具体|展开|讲讲|说说|是什么|做什么|工作内容|发展|前景|路径|门槛|薪资|日常|适合我|作品集|面试|怎么入门|岗位方向|职业方向|apm|pm|产品经理|数据分析|商业分析|用户运营|运营策略|咨询|行业研究|ai\s*产品/i.test(
      prompt,
    );
  const looksLikeRawJd =
    /\bjd\b|岗位职责|任职要求|职位描述|招聘要求|job description|responsibilit|requirement/i.test(
      prompt,
    );

  return hasRecommendations && asksRoleDetail && !looksLikeRawJd;
}

function allowedNodeTypesForTurn(intent: GenerationIntent, prompt: string) {
  const asksProfileRefresh =
    /画像|背景|重新分析简历|重新解析简历|推荐岗位|岗位方向|persona|profile|recommend/i.test(
      prompt,
    );
  const isJdTurn =
    intent === "analyze_jd" ||
    intent === "optimize_resume" ||
    intent === "revise_resume";

  if (isJdTurn && !asksProfileRefresh) {
    if (intent === "analyze_jd") {
      return new Set<CanvasNodeType>([
        "jd_analysis",
        "optimization_suggestions",
        "career_change_translation",
      ]);
    }

    return new Set<CanvasNodeType>([
      "optimized_resume",
      "career_change_translation",
    ]);
  }

  if (isJdTurn) {
    return new Set<CanvasNodeType>([
      "persona",
      "recommended_jobs",
      "jd_analysis",
      "optimization_suggestions",
      "optimized_resume",
      "career_change_translation",
    ]);
  }

  if (intent === "job_detail") {
    return new Set<CanvasNodeType>(["job_detail"]);
  }

  return new Set<CanvasNodeType>([
    "persona",
    "recommended_jobs",
    "job_detail",
    "jd_request",
    "career_change_translation",
  ]);
}

function titleForNode(
  node: GenerateCanvasOutput["nodes"][number],
  existingNodes: CanvasNodeRecord[],
  plannedNodes: Array<{ nodeType?: CanvasNodeType; node_type?: CanvasNodeType; title?: string; metadata?: Record<string, unknown> }>,
) {
  if (node.nodeType !== "job_detail") {
    const version = versionForType(node.nodeType, existingNodes, plannedNodes);

    return {
      version,
      title: `${nodeTypeLabel(node.nodeType)} v${version}`,
    };
  }

  const jobName = jobNameForDetailNode(node);
  const version = versionForJobDetail(jobName, existingNodes, plannedNodes);

  node.metadata = {
    ...(node.metadata || {}),
    jobName,
  };

  return {
    version,
    title: `${jobName}介绍V${version}`,
  };
}

function jobNameForDetailNode(node: GenerateCanvasOutput["nodes"][number]) {
  const metadataJobName =
    node.metadata && typeof node.metadata.jobName === "string"
      ? node.metadata.jobName
      : "";
  const raw = metadataJobName || node.title || "具体岗位";

  return (
    raw
      .replace(/^#+\s*/, "")
      .replace(/介绍\s*[vV]\d+$/i, "")
      .replace(/岗位介绍$/i, "")
      .replace(/介绍$/i, "")
      .trim() || "具体岗位"
  );
}

function versionForJobDetail(
  jobName: string,
  existingNodes: CanvasNodeRecord[],
  plannedNodes: Array<{ nodeType?: CanvasNodeType; node_type?: CanvasNodeType; title?: string; metadata?: Record<string, unknown> }>,
) {
  const normalizedJobName = normalizeJobName(jobName);

  return (
    existingNodes.filter(
      (node) =>
        node.node_type === "job_detail" &&
        normalizeJobName(jobNameFromRecord(node)) === normalizedJobName,
    ).length +
    plannedNodes.filter(
      (node) =>
        (node.nodeType || node.node_type) === "job_detail" &&
        normalizeJobName(jobNameFromPlannedNode(node)) === normalizedJobName,
    ).length +
    1
  );
}

function jobNameFromRecord(node: CanvasNodeRecord) {
  const metadataJobName =
    typeof node.metadata?.jobName === "string" ? node.metadata.jobName : "";

  return (
    metadataJobName ||
    node.title
      .replace(/介绍\s*[vV]\d+$/i, "")
      .replace(/介绍$/i, "")
      .trim()
  );
}

function jobNameFromPlannedNode(node: {
  title?: string;
  metadata?: Record<string, unknown>;
}) {
  const metadataJobName =
    node.metadata && typeof node.metadata.jobName === "string"
      ? node.metadata.jobName
      : "";

  return (
    metadataJobName ||
    (node.title || "")
      .replace(/介绍\s*[vV]\d+$/i, "")
      .replace(/介绍$/i, "")
      .trim()
  );
}

function normalizeJobName(jobName: string) {
  return jobName.replace(/\s+/g, "").toLowerCase();
}

function buildUserInputNode(
  prompt: string,
  files: UploadedFileRecord[],
  filesWithContent: Array<{
    id: string;
    type: FileType;
    mimeType: string;
    originalFilename?: string | null;
    extractedText?: string;
    extractionStatus?: "extracted" | "unsupported" | "failed" | "empty";
    extractionError?: string;
    imageMediaType?: string;
  }>,
): GenerateCanvasOutput["nodes"][number] {
  return {
    tempId: "user-input",
    nodeType: "input",
    title: "用户输入",
    contentMarkdown: buildUserInputMarkdown(prompt, files, filesWithContent),
    metadata: {
      source: "system",
      fileCount: files.length,
      fileIds: files.map((file) => file.id),
    },
  };
}

function buildUserInputMarkdown(
  prompt: string,
  files: UploadedFileRecord[],
  filesWithContent: Array<{
    id: string;
    type: FileType;
    mimeType: string;
    originalFilename?: string | null;
    extractedText?: string;
    extractionStatus?: "extracted" | "unsupported" | "failed" | "empty";
    extractionError?: string;
    imageMediaType?: string;
  }>,
) {
  const fileDetails = files.map((file) => {
    const content = filesWithContent.find((item) => item.id === file.id);
    const extractedChars = content?.extractedText?.trim().length || 0;
    const status = content?.extractionStatus || "unknown";
    const statusLabel =
      status === "extracted"
        ? `已解析文本，约 ${extractedChars} 字`
        : content?.extractionError
          ? content.extractionError
          : file.mime_type.startsWith("image/")
            ? "图片文件，需模型视觉识别"
            : "未提取到文本";

    return [
      `### ${file.file_type === "jd" ? "JD" : file.file_type === "resume" ? "简历" : "附件"}：${file.original_filename || file.id}`,
      `- 文件类型：${file.mime_type}`,
      `- 读取状态：${statusLabel}`,
      content?.extractionError ? `- 说明：${content.extractionError}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    "# 用户输入 v1",
    "",
    "## 本轮提示",
    prompt.trim() || "用户仅上传了文件，未输入额外文字。",
    "",
    "## 上传文件",
    files.length > 0 ? `本轮关联文件数：${files.length}` : "本轮没有上传文件。",
    "",
    ...fileDetails,
  ].join("\n");
}

async function loadFiles(
  fileIds: string[],
  workspaceId: string,
  userId: string,
) {
  if (fileIds.length === 0) {
    return [];
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("uploaded_files")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .in("id", fileIds)
    .returns<UploadedFileRecord[]>();

  if (error) {
    throw new AppError("files_query_failed", error.message, 500);
  }

  return data || [];
}

async function signedUrlFor(file: UploadedFileRecord) {
  const { supabase } = await requireUser();
  const bucket = file.storage_bucket || uploadBucket();
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(file.storage_path, 60 * 10);

  return data?.signedUrl;
}

async function extractedContentFor(file: UploadedFileRecord) {
  const { supabase } = await requireUser();
  const bucket = file.storage_bucket || uploadBucket();
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(file.storage_path);

  if (error || !data) {
    return {
      extractedText: "",
      extractionStatus: "failed" as const,
      extractionError: error?.message || "无法从 Supabase Storage 下载文件。",
    };
  }

  const buffer = Buffer.from(await data.arrayBuffer());

  const extracted = await extractUploadedFileText(
    file,
    new Blob([buffer], { type: file.mime_type }),
  );

  return {
    extractedText: extracted.text,
    extractionStatus: extracted.status,
    extractionError: extracted.error,
  };
}

function summarizeFiles(files: UploadedFileRecord[]) {
  if (files.length === 0) {
    return "";
  }

  return files
    .map((file) => `[${file.file_type}] ${file.original_filename || file.id}`)
    .join("\n");
}

function ensureVersionedTitle(markdown: string, title: string) {
  const trimmed = markdown.trim();

  if (trimmed.startsWith("# ")) {
    return trimmed.replace(/^# .*/, `# ${title}`);
  }

  return `# ${title}\n\n${trimmed}`;
}

function relationshipLabel(source: CanvasNodeType, target: CanvasNodeType) {
  if (source === "input") {
    return "generates";
  }

  if (target === "optimized_resume") {
    return "optimizes";
  }

  if (target === "job_detail") {
    return "explains";
  }

  if (target === "jd_analysis") {
    return "analyzes";
  }

  if (target === "optimization_suggestions") {
    return "suggests";
  }

  return "continues";
}
