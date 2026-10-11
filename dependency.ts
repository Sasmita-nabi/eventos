import type { AffectedNode, GraphEdge, GraphNode, ImpactReport, StoreData } from "./types";

/** Edges point from prerequisite to dependent. Breadth-first search returns
 * shortest impact paths, excludes the changed root and terminates on cycles. */
export function downstream(root: string, nodes: GraphNode[], edges: GraphEdge[]): AffectedNode[] {
  const byId = new Map(nodes.map(node => [node.id, node]));
  if (!byId.has(root)) return [];
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue;
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());
    adjacency.get(edge.from)!.add(edge.to);
  }
  const seen = new Set([root]);
  const queue: { id: string; path: string[] }[] = [{ id: root, path: [root] }];
  const result: AffectedNode[] = [];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const id of adjacency.get(current.id) ?? []) {
      if (seen.has(id)) continue;
      seen.add(id);
      const path = [...current.path, id];
      result.push({ ...byId.get(id)!, depth: path.length - 1, path });
      queue.push({ id, path });
    }
  }
  return result;
}

export function buildGraph(data: StoreData, eventId: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const event = data.events.find(e => e.id === eventId);
  if (!event) throw new Error("Event not found.");
  const nodes: GraphNode[] = [{ id: `venue:${event.id}`, entityId: event.id, kind: "venue", label: event.venue }];
  const edges: GraphEdge[] = [];
  const entities = [
    ...data.sessions.filter(x => x.eventId === eventId).map(x => ({ x, kind: "session" as const, label: x.title })),
    ...data.resources.filter(x => x.eventId === eventId).map(x => ({ x, kind: "resource" as const, label: x.name })),
    ...data.tasks.filter(x => x.eventId === eventId).map(x => ({ x, kind: "task" as const, label: x.title })),
  ];
  for (const { x, kind, label } of entities) {
    const id = `${kind}:${x.id}`;
    nodes.push({ id, entityId: x.id, kind, label });
    for (const from of x.dependencies) edges.push({ from, to: id });
  }
  const eventTasks = data.tasks.filter(t => t.eventId === eventId);
  for (const person of data.people) {
    if (!eventTasks.some(t => t.ownerId === person.id)) continue;
    nodes.push({ id: `person:${person.id}`, entityId: person.id, kind: "person", label: person.name });
    for (const task of eventTasks.filter(t => t.ownerId === person.id)) edges.push({ from: `task:${task.id}`, to: `person:${person.id}` });
  }
  const announcement = eventTasks.find(t => t.id === "task-announcement");
  if (announcement) {
    nodes.push({ id: `communication:${eventId}`, entityId: eventId, kind: "communication", label: "Participant communication" });
    edges.push({ from: `task:${announcement.id}`, to: `communication:${eventId}` });
  }
  return { nodes, edges };
}

export function analyzeVenueChange(data: StoreData, eventId: string, newVenue: string, id = crypto.randomUUID()): ImpactReport {
  const event = data.events.find(e => e.id === eventId);
  if (!event) throw new Error("Event not found.");
  const venue = newVenue.trim();
  if (!venue || venue.length > 180) throw new Error("Enter a venue between 1 and 180 characters.");
  if (venue.toLowerCase() === event.venue.trim().toLowerCase()) throw new Error("Choose a different venue to analyze a change.");
  const { nodes, edges } = buildGraph(data, eventId);
  const affected = downstream(`venue:${eventId}`, nodes, edges);
  const ids = (kind: GraphNode["kind"]) => affected.filter(n => n.kind === kind).map(n => n.entityId);
  return {
    id, eventId, oldVenue: event.venue, newVenue: venue, revision: data.revision, analyzedAt: new Date().toISOString(),
    source: [event, ...data.tasks.filter(t => ids("task").includes(t.id)), ...data.sessions.filter(s => ids("session").includes(s.id)), ...data.resources.filter(r => ids("resource").includes(r.id)), ...data.people.filter(p => ids("person").includes(p.id))].every(record => record.syncState === "synced") ? "Notion-synchronized data" : "Local operational data", nodes: affected, edges,
    counts: { tasks: ids("task").length, sessions: ids("session").length, resources: ids("resource").length, people: ids("person").length, communication: ids("communication").length },
    taskIds: ids("task"), sessionIds: ids("session"), resourceIds: ids("resource"), personIds: ids("person"),
  };
}

export function hasCycle(nodes: GraphNode[], edges: GraphEdge[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) if (adjacency.has(e.from) && adjacency.has(e.to)) adjacency.get(e.from)!.push(e.to);
  const visited = new Set<string>(), active = new Set<string>();
  function visit(id: string): boolean {
    if (active.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id); active.add(id);
    for (const child of adjacency.get(id) ?? []) if (visit(child)) return true;
    active.delete(id);
    return false;
  }
  return nodes.some(n => visit(n.id));
}
