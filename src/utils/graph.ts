import type { Edge, Node } from "@xyflow/react";
import type { ConceptVM, SyllabusTree } from "@/types/syllabus";

export interface GraphDatum {
  id: string;
  name: string;
  status: ConceptVM["status"];
  difficulty: string;
  coverage: number;
  subject: string;
  chapter: string;
  revisionDue: boolean;
}

/** Flattens the syllabus tree into (concept → metadata, prereqId → conceptId). */
export function toGraphDatum(
  tree: SyllabusTree,
): { concepts: Record<string, GraphDatum>; edges: [string, string][] } {
  const concepts: Record<string, GraphDatum> = {};
  const edges: [string, string][] = [];
  for (const subject of tree.subjects) {
    for (const chapter of subject.chapters) {
      for (const concept of chapter.concepts) {
        concepts[concept.id] = {
          id: concept.id,
          name: concept.name,
          status: concept.status,
          difficulty: concept.difficulty,
          coverage: concept.coverage,
          subject: subject.name,
          chapter: chapter.name,
          revisionDue: concept.needsRevision,
        };
        for (const prereqId of concept.prerequisites) {
          if (prereqId === concept.id) continue;
          edges.push([prereqId, concept.id]);
        }
      }
    }
  }
  return { concepts, edges };
}

/** Depth of each node = longest prerequisite chain, used for a layered layout. */
function depths(
  concepts: Record<string, GraphDatum>,
  edges: [string, string][],
): Map<string, number> {
  const depth = new Map<string, number>();
  const children = new Map<string, string[]>();
  const roots = new Set(Object.keys(concepts));
  for (const [from, to] of edges) {
    const list = children.get(from) ?? [];
    list.push(to);
    children.set(from, list);
    roots.delete(to);
  }
  const visit = (id: string, d: number) => {
    depth.set(id, Math.max(depth.get(id) ?? 0, d));
    for (const child of children.get(id) ?? []) visit(child, d + 1);
  };
  for (const root of roots) visit(root, 0);
  for (const id of Object.keys(concepts)) if (!depth.has(id)) visit(id, 0);
  return depth;
}

/**
 * Builds React Flow nodes/edges with a layered left→right layout. Broken
 * prereq references (name of a concept that was renamed/removed during
 * preview) are resolved against the lookup table and dropped when unresolved.
 */
export function buildGraph(
  tree: SyllabusTree,
): { nodes: Node[]; edges: Edge[]; unknownRefs: number } {
  const { concepts, edges } = toGraphDatum(tree);
  const depth = depths(concepts, edges);

  const layers = new Map<number, string[]>();
  for (const id of Object.keys(concepts)) {
    const d = depth.get(id) ?? 0;
    const list = layers.get(d) ?? [];
    list.push(id);
    layers.set(d, list);
  }

  const nodeWidth = 220;
  const nodeGapX = 48;
  const nodeGapY = 26;
  const layerOffset = 120;

const nodes: Node[] = [];
for (const [d, ids] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
  const x = d * (nodeWidth + nodeGapX) + layerOffset;
  ids.forEach((id, i) => {
    const concept = concepts[id];
    nodes.push({
      id,
      position: {
        x,
        y: layerOffset + i * (76 + nodeGapY),
      },
      data: {
        label: concept.name,
        status: concept.status,
        difficulty: concept.difficulty,
        coverage: concept.coverage,
        subject: concept.subject,
        chapter: concept.chapter,
        id,
      },
      style: { width: nodeWidth },
      type: "flat",
    });
  });
}

  const byName = new Map<string, string>(Object.entries(concepts).map(([id, c]) => [c.name, id]));
  const edgeIds = new Set<string>();
  const edgesOut: Edge[] = [];
  let unknownRefs = 0;

  for (const [from, to] of edges) {
    const resolvedFrom = from in concepts ? from : byName.get(from);
    const resolvedTo = to in concepts ? to : byName.get(to);
    if (!resolvedFrom || !resolvedTo) {
      unknownRefs += 1;
      continue;
    }
    const eid = `${resolvedFrom}-${resolvedTo}`;
    if (edgeIds.has(eid)) continue;
    edgeIds.add(eid);
    edgesOut.push({
      id: eid,
      source: resolvedFrom,
      target: resolvedTo,
      animated: true,
      style: { strokeWidth: 1.5, stroke: "#5b5b6b" },
    });
  }

  return { nodes: nodes.filter(Boolean), edges: edgesOut, unknownRefs };
}