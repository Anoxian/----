export type FileType = "resume" | "jd" | "other";

export type CanvasNodeType =
  | "input"
  | "persona"
  | "recommended_jobs"
  | "job_detail"
  | "jd_request"
  | "jd_analysis"
  | "optimization_suggestions"
  | "optimized_resume"
  | "career_change_translation";

export type GenerationIntent =
  | "onboarding"
  | "persona"
  | "recommend_jobs"
  | "job_detail"
  | "analyze_jd"
  | "optimize_resume"
  | "revise_resume";

export type WorkspaceRecord = {
  id: string;
  user_id: string;
  title: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type UploadedFileRecord = {
  id: string;
  workspace_id: string;
  user_id: string;
  file_type: FileType;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  original_filename: string | null;
  created_at: string;
};

export type CanvasNodeRecord = {
  id: string;
  workspace_id: string;
  user_id: string;
  node_type: CanvasNodeType;
  title: string;
  content_markdown: string;
  version: number;
  position_x: number;
  position_y: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CanvasEdgeRecord = {
  id: string;
  workspace_id: string;
  user_id: string;
  source_node_id: string;
  target_node_id: string;
  label: string;
  created_at: string;
};

export type AiMessageRecord = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_node_ids: string[];
  created_at: string;
};

export type FullWorkspaceState = {
  workspace: WorkspaceRecord;
  nodes: CanvasNodeRecord[];
  edges: CanvasEdgeRecord[];
  messages: AiMessageRecord[];
  files: UploadedFileRecord[];
};

export type GenerateCanvasInput = {
  workspaceId: string;
  prompt: string;
  files: Array<{
    id: string;
    type: FileType;
    mimeType: string;
    storagePath: string;
    originalFilename?: string | null;
    signedUrl?: string;
    extractedText?: string;
    extractionStatus?: "extracted" | "unsupported" | "failed" | "empty";
    extractionError?: string;
    imageBase64?: string;
    imageMediaType?: string;
  }>;
  intent: GenerationIntent;
  existingNodes: CanvasNodeRecord[];
  messages: AiMessageRecord[];
};

export type GenerateCanvasOutput = {
  assistantMessage: string;
  nodes: Array<{
    tempId: string;
    nodeType: CanvasNodeType;
    title: string;
    contentMarkdown: string;
    metadata?: Record<string, unknown>;
  }>;
};
