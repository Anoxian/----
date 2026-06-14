import type {
  AiMessageRecord,
  CanvasNodeRecord,
  CanvasNodeType,
} from "./types";

export type CanvasNodeDimensions = {
  width: number;
  height: number;
};

export type CanvasLayoutItem = {
  node: CanvasNodeRecord;
  position: {
    x: number;
    y: number;
  };
  dimensions: CanvasNodeDimensions;
  generationId: string;
  orderInGeneration: number;
};

export const nodeLayoutBounds = {
  minWidth: 320,
  maxWidth: 680,
  minHeight: 220,
  maxHeight: 2600,
};

const columnGap = 110;
const rowGap = 120;
const canvasTop = 80;
const canvasLeft = 0;

const typeOrder: CanvasNodeType[] = [
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

export function buildCanvasLayout(
  nodes: CanvasNodeRecord[],
  messages: AiMessageRecord[],
): CanvasLayoutItem[] {
  const dimensionsById = new Map(
    nodes.map((node) => [node.id, estimateCanvasNodeDimensions(node)]),
  );
  const groups = groupNodesByGeneration(nodes, messages);
  let cursorY = canvasTop;
  const layout: CanvasLayoutItem[] = [];

  for (const [groupIndex, group] of groups.entries()) {
    const orderedNodes = group.nodes.slice().sort(compareNodesForRow);
    const maxHeight = orderedNodes.reduce((height, node) => {
      const dimensions = dimensionsById.get(node.id);
      return Math.max(height, dimensions?.height || nodeLayoutBounds.minHeight);
    }, nodeLayoutBounds.minHeight);

    for (const [nodeIndex, node] of orderedNodes.entries()) {
      const dimensions =
        dimensionsById.get(node.id) || estimateCanvasNodeDimensions(node);
      const savedPosition = savedNodePosition(node.metadata);

      layout.push({
        node,
        dimensions,
        generationId: group.createdAt || `generation-${groupIndex}`,
        orderInGeneration: nodeIndex,
        position: savedPosition || {
          x: xForNode(node, orderedNodes),
          y: cursorY,
        },
      });
    }

    cursorY += maxHeight + rowGap;
  }

  return layout;
}

export function estimateCanvasNodeDimensions(
  node: Pick<CanvasNodeRecord, "content_markdown" | "metadata">,
): CanvasNodeDimensions {
  const saved = savedNodeDimensions(node.metadata);

  if (saved) {
    return saved;
  }

  const width = estimateNodeWidth(node.content_markdown);
  const height = estimateMarkdownHeight(node.content_markdown, width);

  return {
    width,
    height,
  };
}

export function savedNodeDimensions(metadata: Record<string, unknown>) {
  const candidate = metadata.dimensions;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const dimensions = candidate as Record<string, unknown>;
  const source = dimensions.source;
  const width = Number(dimensions.width);
  const height = Number(dimensions.height);

  if (
    source !== "manual" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null;
  }

  return {
    width: clamp(width, nodeLayoutBounds.minWidth, nodeLayoutBounds.maxWidth),
    height: clamp(height, nodeLayoutBounds.minHeight, nodeLayoutBounds.maxHeight),
  };
}

export function savedNodePosition(metadata: Record<string, unknown>) {
  const candidate = metadata.position;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const position = candidate as Record<string, unknown>;
  const source = position.source;
  const x = Number(position.x);
  const y = Number(position.y);

  if (source !== "manual" || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

export function nodeTypeSortIndex(nodeType: CanvasNodeType) {
  const index = typeOrder.indexOf(nodeType);
  return index === -1 ? typeOrder.length : index;
}

function groupNodesByGeneration(
  nodes: CanvasNodeRecord[],
  messages: AiMessageRecord[],
) {
  const remaining = new Map(nodes.map((node) => [node.id, node]));
  const groups: Array<{ createdAt: string; nodes: CanvasNodeRecord[] }> = [];
  const messagesWithNodes = messages
    .filter((message) => message.created_node_ids.length > 0)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  for (const message of messagesWithNodes) {
    const groupNodes = message.created_node_ids
      .map((nodeId) => remaining.get(nodeId))
      .filter((node): node is CanvasNodeRecord => Boolean(node));

    if (groupNodes.length === 0) {
      continue;
    }

    for (const node of groupNodes) {
      remaining.delete(node.id);
    }

    groups.push({
      createdAt: message.created_at,
      nodes: groupNodes,
    });
  }

  for (const node of Array.from(remaining.values()).sort(compareNodesByTime)) {
    groups.push({
      createdAt: node.created_at,
      nodes: [node],
    });
  }

  return mergeSameGenerationGroups(
    groups.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
}

function mergeSameGenerationGroups(
  groups: Array<{ createdAt: string; nodes: CanvasNodeRecord[] }>,
) {
  const merged: Array<{ createdAt: string; nodes: CanvasNodeRecord[] }> = [];

  for (const group of groups) {
    const previous = merged[merged.length - 1];

    if (previous && shouldMergeGroups(previous, group)) {
      previous.nodes.push(...group.nodes);
      continue;
    }

    merged.push({
      createdAt: group.createdAt,
      nodes: group.nodes.slice(),
    });
  }

  return merged;
}

function shouldMergeGroups(
  previous: { createdAt: string; nodes: CanvasNodeRecord[] },
  next: { createdAt: string; nodes: CanvasNodeRecord[] },
) {
  const previousFingerprint = requestFingerprint(previous.nodes[0]);
  const nextFingerprint = requestFingerprint(next.nodes[0]);

  if (!previousFingerprint || previousFingerprint !== nextFingerprint) {
    return false;
  }

  const previousTime = Date.parse(previous.createdAt);
  const nextTime = Date.parse(next.createdAt);

  if (!Number.isFinite(previousTime) || !Number.isFinite(nextTime)) {
    return false;
  }

  return Math.abs(nextTime - previousTime) <= 60_000;
}

function requestFingerprint(node: CanvasNodeRecord) {
  const metadata = node.metadata || {};
  const prompt =
    typeof metadata.prompt === "string" ? metadata.prompt.trim() : "";
  const intent = typeof metadata.intent === "string" ? metadata.intent : "";
  const fileIds = Array.isArray(metadata.fileIds)
    ? metadata.fileIds.filter((id): id is string => typeof id === "string")
    : [];

  if (!prompt && !intent && fileIds.length === 0) {
    return null;
  }

  return JSON.stringify({
    prompt,
    intent,
    fileIds: fileIds.slice().sort(),
  });
}

function xForNode(node: CanvasNodeRecord, rowNodes: CanvasNodeRecord[]) {
  let x = canvasLeft;

  const nodesBefore = rowNodes
    .filter((candidate) => compareNodesForRow(candidate, node) < 0)
    .sort(compareNodesForRow);

  for (const candidate of nodesBefore) {
    const dimensions = estimateCanvasNodeDimensions(candidate);
    x += dimensions.width + columnGap;
  }

  return x;
}

function compareNodesForRow(a: CanvasNodeRecord, b: CanvasNodeRecord) {
  return (
    nodeTypeSortIndex(a.node_type) - nodeTypeSortIndex(b.node_type) ||
    a.position_x - b.position_x ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
  );
}

function compareNodesByTime(a: CanvasNodeRecord, b: CanvasNodeRecord) {
  return (
    a.created_at.localeCompare(b.created_at) ||
    a.position_x - b.position_x ||
    a.id.localeCompare(b.id)
  );
}

function estimateNodeWidth(markdown: string) {
  const lines = markdown.split("\n");
  const longestLine = lines.reduce((longest, line) => {
    const normalizedLength = Math.min(line.length, 96);
    return Math.max(longest, normalizedLength);
  }, 0);
  const contentLength = markdown.length;
  const lineBasedWidth = 360 + Math.max(0, longestLine - 44) * 5;
  const contentBasedWidth =
    contentLength > 2400
      ? 680
      : contentLength > 1400
        ? 600
        : contentLength > 760
          ? 520
          : nodeLayoutBounds.minWidth;

  return Math.round(
    clamp(
      Math.max(lineBasedWidth, contentBasedWidth),
      nodeLayoutBounds.minWidth,
      nodeLayoutBounds.maxWidth,
    ),
  );
}

function estimateMarkdownHeight(markdown: string, width: number) {
  const contentWidth = Math.max(220, width - 32);
  const charsPerLine = Math.max(24, Math.floor(contentWidth / 7.2));
  const lines = markdown.split("\n");
  let height = 92;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      height += 8;
      continue;
    }

    if (/^#\s+/.test(line)) {
      height += 42;
      continue;
    }

    if (/^##\s+/.test(line)) {
      height += 36;
      continue;
    }

    if (/^#{3,6}\s+/.test(line)) {
      height += 30;
      continue;
    }

    if (/^\|.*\|$/.test(line)) {
      height += 32;
      continue;
    }

    const wrappingLines = Math.max(1, Math.ceil(line.length / charsPerLine));
    height += Math.max(24, wrappingLines * 22);
  }

  return Math.round(
    clamp(height + 20, nodeLayoutBounds.minHeight, nodeLayoutBounds.maxHeight),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
