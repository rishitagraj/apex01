"use client";

import { useMemo, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import { buildGraph } from "@/utils/graph";
import type { SyllabusTree } from "@/types/syllabus";

type FlatNodeData = {
  id: string;
  label: string;
  status: string;
  difficulty: string;
  coverage: number;
  subject: string;
  chapter: string;
};
type FlatNode = Node<FlatNodeData, "flat">;

function FlatNode({ data, selected }: NodeProps<FlatNode>) {
  const router = useRouter();
  const cx = statusColor(data.status);
  return (
    <div
      onDoubleClick={() => router.push(`/syllabus?focus=${data.id}`)}
      className={`rounded-2xl border bg-bg px-3 py-2 shadow-lg shadow-black/30 transition ${
        selected ? "border-apex/70 ring-2 ring-apex/40" : "border-line"
      }`}
      style={{ borderLeftWidth: 4, borderLeftColor: cx }}
      title={`${data.subject} · ${data.chapter}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-line" />
      <p className="text-[13px] font-semibold leading-tight">{data.label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cx }} />
        {data.subject}
        {data.difficulty ? (
          <span className="chip border-line bg-surface px-1 py-0 text-[9px]">
            {data.difficulty}
          </span>
        ) : null}
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${data.coverage}%`, backgroundColor: cx }}
        />
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-line" />
    </div>
  );
}

const nodeTypes: NodeTypes = { flat: FlatNode as ComponentType<NodeProps<FlatNode>> };

export function KnowledgeGraph({
  tree,
  height = 560,
}: {
  tree: SyllabusTree;
  height?: number;
}) {
  const { nodes, edges, unknownRefs } = useMemo(
    () => buildGraph(tree),
    [tree],
  );

  if (nodes.length === 0) {
    return (
      <div className="card rounded-3xl p-8 text-center text-sm text-muted">
        No concepts to map yet.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-bg">
      {unknownRefs > 0 ? (
        <p className="absolute left-3 top-3 z-10 rounded-xl bg-black/60 px-2.5 py-1 text-[11px] text-amber-300 backdrop-blur">
          {unknownRefs} prerequisites couldn&apos;t be resolved
        </p>
      ) : null}
      <ReactFlowProvider>
        <div style={{ height }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.2}
            maxZoom={1.6}
            proOptions={{ hideAttribution: true }}
            nodesConnectable={false}
            nodesDraggable={false}
            panOnScroll
            zoomOnDoubleClick={false}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="#2a2a36" />
            <Controls className="!border-line !bg-surface [&>button]:!border-line [&>button]:!bg-surface [&>button]:!text-muted" />
            <MiniMap
              pannable
              maskColor="rgba(0,0,0,0.6)"
              nodeColor="#252533"
              nodeStrokeColor="#ff7a1a"
              className="!hidden sm:!block"
            />
          </ReactFlow>
        </div>
      </ReactFlowProvider>
      <p className="pointer-events-none absolute bottom-3 left-3 text-[10px] text-muted">
        Double-click a concept to focus it · scroll to zoom · drag to pan
      </p>
    </div>
  );
}

export function statusColor(status: string): string {
  switch (status) {
    case "MASTERED":
      return "#34d399";
    case "COMPLETED":
      return "#38bdf8";
    case "NEEDS_REVISION":
      return "#fbbf24";
    case "WEAK":
      return "#fb7185";
    case "IN_PROGRESS":
      return "#a78bfa";
    default:
      return "#5b5b6b";
  }
}