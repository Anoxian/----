"use client";

import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { Copy, FileText } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CanvasNodeRecord, CanvasNodeType } from "@/lib/career-canvas/types";

const nodeTone: Record<CanvasNodeType, string> = {
  input: "border-stone-300 bg-stone-50",
  persona: "border-teal-200 bg-teal-50",
  recommended_jobs: "border-indigo-200 bg-indigo-50",
  job_detail: "border-cyan-200 bg-cyan-50",
  jd_request: "border-amber-200 bg-amber-50",
  jd_analysis: "border-sky-200 bg-sky-50",
  optimization_suggestions: "border-rose-200 bg-rose-50",
  optimized_resume: "border-emerald-200 bg-emerald-50",
  career_change_translation: "border-violet-200 bg-violet-50",
};

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 text-base font-semibold leading-6 text-stone-950">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-sm font-semibold leading-6 text-stone-900">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-3 text-[13px] font-semibold leading-5 text-stone-800">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="my-2 text-[12px] leading-5 text-stone-700">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 text-[12px] leading-5 text-stone-700">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 text-[12px] leading-5 text-stone-700">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-stone-900">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-stone-300 pl-3 text-stone-600">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-white/80 px-1 py-0.5 font-mono text-[11px] text-stone-800">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-auto rounded-md border border-black/10 bg-white/80 p-3 text-[11px] leading-5 text-stone-700">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-auto rounded-md border border-black/10 bg-white/70">
      <table className="w-full border-collapse text-left text-[11px] leading-5">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-black/10 px-2 py-1.5 font-semibold text-stone-900">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-black/5 px-2 py-1.5 text-stone-700">
      {children}
    </td>
  ),
};

export function CanvasNode(props: NodeProps) {
  const data = props.data as unknown as CanvasNodeRecord;
  const renderedMarkdown = withoutDuplicateTitle(
    data.content_markdown,
    data.title,
  );

  return (
    <div
      className={cn(
        "flex h-full min-h-[220px] min-w-[300px] flex-col overflow-hidden rounded-lg border shadow-sm",
        "text-stone-900 ring-1 ring-black/[0.02]",
        nodeTone[data.node_type],
      )}
    >
      <NodeResizer
        isVisible={props.selected}
        minWidth={300}
        minHeight={220}
        lineClassName="!border-teal-500"
        handleClassName="!h-2.5 !w-2.5 !border !border-teal-600 !bg-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-stone-400 !bg-white"
      />
      <div className="flex items-start justify-between gap-3 border-b border-black/10 bg-white/70 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-stone-600" />
            <h3 className="truncate text-sm font-semibold">{data.title}</h3>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Copy Markdown"
          onClick={() => navigator.clipboard.writeText(data.content_markdown)}
          className="nodrag h-8 w-8 shrink-0 rounded-md"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {renderedMarkdown}
        </ReactMarkdown>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-stone-400 !bg-white"
      />
    </div>
  );
}

function withoutDuplicateTitle(markdown: string, title: string) {
  const lines = markdown.trimStart().split("\n");
  const firstLine = lines[0]?.trim();

  if (firstLine === `# ${title}`) {
    return lines.slice(1).join("\n").trimStart();
  }

  return markdown;
}
