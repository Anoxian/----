"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type OnNodesChange,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";

import { CanvasNode } from "./canvas-node";
import { buildCanvasLayout } from "@/lib/career-canvas/layout";
import type {
  AiMessageRecord,
  CanvasEdgeRecord,
  CanvasNodeRecord,
} from "@/lib/career-canvas/types";

const nodeTypes = {
  canvasBlock: CanvasNode,
};

type CanvasBoardProps = {
  nodes: CanvasNodeRecord[];
  edges: CanvasEdgeRecord[];
  messages: AiMessageRecord[];
};

export function CanvasBoard({
  nodes: records,
  edges: edgeRecords,
  messages,
}: CanvasBoardProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const resizingNodeIds = useRef(new Set<string>());
  const draggingNodeIds = useRef(new Set<string>());

  const layout = useMemo(
    () => buildCanvasLayout(records, messages),
    [records, messages],
  );

  const flowNodes = useMemo(
    () =>
      layout.map((item) => ({
        id: item.node.id,
        type: "canvasBlock",
        position: item.position,
        data: item.node,
        style: item.dimensions,
      })),
    [layout],
  );

  const flowEdges = useMemo(
    () => {
      const persistedEdges = edgeRecords.map((edge) => ({
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        label: edge.label,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#64748b", strokeWidth: 1.6 },
        labelStyle: { fill: "#475569", fontSize: 11, fontWeight: 600 },
      }));
      const persistedEdgeKeys = new Set(
        persistedEdges.map((edge) => `${edge.source}->${edge.target}`),
      );
      const inferredEdges: Edge[] = [];
      const layoutByGeneration = new Map<string, typeof layout>();

      for (const item of layout) {
        const generation = layoutByGeneration.get(item.generationId) || [];
        generation.push(item);
        layoutByGeneration.set(item.generationId, generation);
      }

      for (const generation of layoutByGeneration.values()) {
        const orderedItems = generation
          .slice()
          .sort((a, b) => a.orderInGeneration - b.orderInGeneration);

        for (let index = 0; index < orderedItems.length - 1; index += 1) {
          const source = orderedItems[index].node;
          const target = orderedItems[index + 1].node;
          const edgeKey = `${source.id}->${target.id}`;

          if (persistedEdgeKeys.has(edgeKey)) {
            continue;
          }

          inferredEdges.push({
            id: `inferred-${source.id}-${target.id}`,
            source: source.id,
            target: target.id,
            label: relationshipLabel(source.node_type, target.node_type),
            type: "smoothstep",
            animated: false,
            style: { stroke: "#94a3b8", strokeWidth: 1.4 },
            labelStyle: { fill: "#64748b", fontSize: 11, fontWeight: 600 },
          });
        }
      }

      return [...persistedEdges, ...inferredEdges];
    },
    [edgeRecords, layout],
  );

  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  const persistNodeDimensions = useCallback(
    async (nodeId: string, dimensions: { width: number; height: number }) => {
      const node = records.find((record) => record.id === nodeId);

      if (!node) {
        return;
      }

      await fetch(`/api/canvas-nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: node.workspace_id,
          width: Math.round(dimensions.width),
          height: Math.round(dimensions.height),
        }),
      }).catch(() => {
        // A failed size save should not interrupt canvas editing.
      });
    },
    [records],
  );

  const persistNodePosition = useCallback(
    async (nodeId: string, position: { x: number; y: number }) => {
      const node = records.find((record) => record.id === nodeId);

      if (!node) {
        return;
      }

      await fetch(`/api/canvas-nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: node.workspace_id,
          positionX: Math.round(position.x),
          positionY: Math.round(position.y),
        }),
      }).catch(() => {
        // A failed position save should not interrupt canvas editing.
      });
    },
    [records],
  );

  const handleNodesChange: OnNodesChange<Node> = useCallback(
    (changes) => {
      onNodesChange(changes);

      for (const change of changes) {
        if (change.type === "position") {
          if (change.dragging === true) {
            draggingNodeIds.current.add(change.id);
            continue;
          }

          if (
            change.position &&
            change.dragging === false &&
            draggingNodeIds.current.has(change.id)
          ) {
            draggingNodeIds.current.delete(change.id);
            void persistNodePosition(change.id, change.position);
          }

          continue;
        }

        if (change.type !== "dimensions") {
          continue;
        }

        if (change.resizing === true) {
          resizingNodeIds.current.add(change.id);
          continue;
        }

        if (
          change.dimensions &&
          change.resizing === false &&
          resizingNodeIds.current.has(change.id)
        ) {
          resizingNodeIds.current.delete(change.id);
          void persistNodeDimensions(change.id, change.dimensions);
        }
      }
    },
    [onNodesChange, persistNodeDimensions, persistNodePosition],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      minZoom={0.18}
      maxZoom={1.3}
      proOptions={{ hideAttribution: true }}
      className="career-canvas-flow"
    >
      <Background color="#d6d3d1" gap={24} size={1} />
      <Controls position="bottom-left" />
      <MiniMap
        pannable
        zoomable
        position="bottom-right"
        nodeStrokeWidth={3}
        className="!bg-white/80"
      />
    </ReactFlow>
  );
}

function relationshipLabel(
  source: CanvasNodeRecord["node_type"],
  target: CanvasNodeRecord["node_type"],
) {
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
