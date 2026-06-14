"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  Download,
  FileImage,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";

import { CanvasBoard } from "./canvas-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  AiMessageRecord,
  FileType,
  FullWorkspaceState,
  WorkspaceRecord,
} from "@/lib/career-canvas/types";
import { cn } from "@/lib/utils";

const greeting = `你好，我是你的 AI 求职匹配助手。你可以先上传简历截图，或者告诉我你的背景、目标行业、目标岗位、城市偏好和求职阶段。

我会先在画布上生成你的用户画像和至少 5 个适合的岗位方向。之后你可以继续上传心仪岗位的 JD，我会帮你做匹配评分、差距分析、优化建议，并生成完整的优化版简历。每一次迭代都会保留在画布上，方便你看清楚整个优化过程。`;

type PendingUpload = {
  id: string;
  file: File;
  fileType: Exclude<FileType, "other">;
};

const acceptedUploadTypes = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".md",
  ".doc",
  ".docx",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/markdown",
  "text/x-markdown",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

const supportedUploadExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "md",
  "doc",
  "docx",
]);

export function CareerWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  const [state, setState] = useState<FullWorkspaceState | null>(null);
  const [prompt, setPrompt] = useState("");
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jdInputRef = useRef<HTMLInputElement>(null);

  const refreshWorkspace = useCallback(async (workspaceId: string) => {
    const nextState = await fetchJson<FullWorkspaceState>(
      `/api/workspaces/${workspaceId}`,
    );
    setState(nextState);
    setWorkspace(nextState.workspace);
  }, []);

  const bootstrapWorkspace = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const latest = await fetchJson<{ workspace: WorkspaceRecord | null }>(
        "/api/workspaces",
      );
      let nextWorkspace = latest.workspace;

      if (!nextWorkspace) {
        const created = await fetchJson<{
          workspaceId: string;
          workspace: WorkspaceRecord;
        }>("/api/workspaces", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "AI 求职画布" }),
        });
        nextWorkspace = created.workspace;
      }

      setWorkspace(nextWorkspace);
      await refreshWorkspace(nextWorkspace.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, [refreshWorkspace]);

  useEffect(() => {
    bootstrapWorkspace();
  }, [bootstrapWorkspace]);

  function addPendingFiles(
    fileList: FileList | null,
    fileType: Exclude<FileType, "other">,
  ) {
    if (!fileList?.length) {
      return;
    }

    const accepted = Array.from(fileList)
      .filter((file) =>
        supportedUploadExtensions.has(
          file.name.split(".").pop()?.toLowerCase() || "",
        ),
      )
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        fileType,
      }));

    setPendingUploads((current) => [...current, ...accepted]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspace || isSending) {
      return;
    }

    setError(null);
    setIsSending(true);

    try {
      const uploadedFileIds: string[] = [];

      for (const pending of pendingUploads) {
        const formData = new FormData();
        formData.append("workspaceId", workspace.id);
        formData.append("fileType", pending.fileType);
        formData.append("file", pending.file);

        const uploaded = await fetchJson<{
          fileId: string;
          fileType: FileType;
          storagePath: string;
        }>("/api/uploads", {
          method: "POST",
          body: formData,
        });

        uploadedFileIds.push(uploaded.fileId);
      }

      await fetchJson("/api/ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.id,
          prompt,
          fileIds: uploadedFileIds,
        }),
      });

      setPrompt("");
      setPendingUploads([]);
      await refreshWorkspace(workspace.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSending(false);
    }
  }

  const messages = state?.messages || [];
  const files = state?.files || [];
  const hasGeneratedNodes = Boolean(state?.nodes.length);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#f6f4ef] text-stone-950">
      <section className="relative min-w-0 flex-1">
        <div className="absolute left-5 top-5 z-10 grid max-w-[calc(100%-2.5rem)] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-stone-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-stone-900 text-white">
            <BriefcaseBusiness className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">
              {workspace?.title || "AI 求职画布"}
            </h1>
            <p className="truncate text-xs text-stone-500">
              {state?.nodes.length || 0} 个节点 · {files.length} 个附件
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="导出 Markdown"
            disabled={!workspace || !hasGeneratedNodes}
            asChild={Boolean(workspace && hasGeneratedNodes)}
            className="h-9 w-9 shrink-0 rounded-md border-stone-200 bg-white/80 text-stone-600 shadow-none hover:bg-stone-50 hover:text-stone-950 disabled:bg-stone-50 disabled:text-stone-300"
          >
            {workspace && hasGeneratedNodes ? (
              <a href={`/api/workspaces/${workspace.id}/export.md`}>
                <Download className="h-4 w-4" />
                <span className="sr-only">导出 Markdown</span>
              </a>
            ) : (
              <span>
                <Download className="h-4 w-4" />
                <span className="sr-only">导出 Markdown</span>
              </span>
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-stone-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            正在准备你的求职画布
          </div>
        ) : state?.nodes.length ? (
          <CanvasBoard
            nodes={state.nodes}
            edges={state.edges}
            messages={state.messages}
          />
        ) : (
          <EmptyCanvas />
        )}
      </section>

      <aside className="flex w-[440px] shrink-0 flex-col border-l border-stone-200 bg-white">
        <div className="flex h-14 items-center justify-between border-b border-stone-200 px-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-teal-600" />
            <span className="text-sm font-semibold">求职匹配助手</span>
          </div>
          <Badge variant="outline" className="bg-teal-50 text-teal-700">
            Server AI
          </Badge>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <MessageBubble role="assistant" content={greeting} />
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
            />
          ))}
        </div>

        <div className="border-t border-stone-200 bg-stone-50 p-4">
          {error ? (
            <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
              {error}
            </div>
          ) : null}

          <PendingUploads
            uploads={pendingUploads}
            onRemove={(id) =>
              setPendingUploads((current) =>
                current.filter((upload) => upload.id !== id),
              )
            }
          />

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm"
          >
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  formRef.current?.requestSubmit();
                }
              }}
              placeholder="描述你的背景、目标岗位，或上传简历/JD 截图"
              className="min-h-28 w-full resize-none border-0 bg-transparent text-sm leading-6 outline-none placeholder:text-stone-400"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="上传简历或 JD 文件"
                      className="h-9 w-9 rounded-md border-stone-200 bg-stone-50 text-stone-700 shadow-none hover:bg-teal-50 hover:text-teal-700"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    <DropdownMenuItem
                      onSelect={() => resumeInputRef.current?.click()}
                    >
                      <UserRound className="h-4 w-4" />
                      上传简历
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => jdInputRef.current?.click()}>
                      <BriefcaseBusiness className="h-4 w-4" />
                      上传 JD
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="text-xs text-stone-500">
                  支持图片、MD、Word
                </span>
              </div>

              <Button
                type="submit"
                disabled={isSending || isLoading}
                className="h-9 rounded-md bg-stone-900 px-4 text-white hover:bg-stone-800"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                发送
              </Button>
            </div>

            <input
              ref={resumeInputRef}
              type="file"
              accept={acceptedUploadTypes}
              multiple
              className="hidden"
              onChange={(event) => {
                addPendingFiles(event.target.files, "resume");
                event.currentTarget.value = "";
              }}
            />
            <input
              ref={jdInputRef}
              type="file"
              accept={acceptedUploadTypes}
              multiple
              className="hidden"
              onChange={(event) => {
                addPendingFiles(event.target.files, "jd");
                event.currentTarget.value = "";
              }}
            />
          </form>
        </div>
      </aside>
    </div>
  );
}

function EmptyCanvas() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white shadow-sm">
          <Sparkles className="h-5 w-5 text-teal-600" />
        </div>
        <h2 className="text-lg font-semibold text-stone-900">
          从右侧输入开始生成画布
        </h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          简历画像、岗位推荐、JD 匹配分析和简历版本会作为独立节点保留，并用连线展示推理路径。
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
}: {
  role: AiMessageRecord["role"];
  content: string;
}) {
  const isUser = role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-6",
          isUser
            ? "bg-stone-900 text-white"
            : "border border-stone-200 bg-stone-50 text-stone-700",
        )}
      >
        {content}
      </div>
    </div>
  );
}

function PendingUploads({
  uploads,
  onRemove,
}: {
  uploads: PendingUpload[];
  onRemove: (id: string) => void;
}) {
  if (!uploads.length) {
    return null;
  }

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {uploads.map((upload) => (
        <button
          key={upload.id}
          type="button"
          onClick={() => onRemove(upload.id)}
          className="inline-flex max-w-full items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800"
          title="移除待上传文件"
        >
          <FileImage className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {upload.fileType === "resume" ? "简历" : "JD"}：{upload.file.name}
          </span>
        </button>
      ))}
    </div>
  );
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
