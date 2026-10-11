import test from "node:test";
import assert from "node:assert/strict";
import { analyzeVenueChange, buildGraph, downstream, hasCycle } from "../lib/dependency";
import { applyVenueChange, pendingCount } from "../lib/operations";
import { createSeed, DEMO_EVENT_ID } from "../lib/seed";
import type { GraphNode } from "../lib/types";

const node = (id: string): GraphNode => ({ id, label: id, entityId: id, kind: "task" });
const input = (revision = 0, followups = true) => ({ eventId: DEMO_EVENT_ID, oldVenue: "Main Auditorium", newVenue: "Seminar Hall B", revision, changeId: "change-test", createFollowups: followups });

test("seed metrics are derived from 42 real task records", () => {
  const data = createSeed();
  assert.equal(data.tasks.length, 42);
  assert.equal(data.tasks.filter(t => t.status === "Done").length, 17);
  assert.equal(data.tasks.filter(t => t.risk).length, 5);
  assert.equal(data.tasks.filter(t => t.status === "Blocked").length, 3);
  assert.equal(pendingCount(data), 59);
});
test("venue traversal identifies exactly 5 tasks, 2 sessions, 4 resources and 3 owners", () => {
  const report = analyzeVenueChange(createSeed(), DEMO_EVENT_ID, "Seminar Hall B");
  assert.deepEqual(report.counts, { tasks: 5, sessions: 2, resources: 4, people: 3, communication: 1 });
  assert.equal(report.source, "Local operational data");
  assert.equal(new Set(report.nodes.map(n => n.id)).size, report.nodes.length);
  assert(!report.nodes.some(n => n.kind === "venue"));
  assert(report.nodes.find(n => n.entityId === "task-projector")!.path.includes("resource:resource-projector"));
});
test("analyzing impact never mutates operational data", () => {
  const data = createSeed(), before = JSON.stringify(data);
  analyzeVenueChange(data, DEMO_EVENT_ID, "New hall");
  assert.equal(JSON.stringify(data), before);
});
test("BFS deduplicates diamonds and returns the shortest path", () => {
  const result = downstream("A", [node("A"), node("B"), node("C"), node("D")], [{ from:"A",to:"B" },{ from:"A",to:"C" },{ from:"B",to:"D" },{ from:"C",to:"D" },{ from:"B",to:"D" }]);
  assert.deepEqual(result.map(n => n.id), ["B","C","D"]);
  assert.equal(result[2].depth, 2);
  assert.deepEqual(result[2].path, ["A","B","D"]);
});
test("cycles terminate and never return the changed root", () => {
  const result = downstream("A", [node("A"),node("B")], [{ from:"A",to:"B" },{ from:"B",to:"A" }]);
  assert.deepEqual(result.map(n => n.id), ["B"]);
});
test("unknown roots and disconnected records have no impact", () => {
  assert.deepEqual(downstream("unknown", [node("A")], []), []);
  assert.deepEqual(downstream("A", [node("A"),node("B")], []), []);
});
test("dangling references are ignored during traversal", () => {
  assert.deepEqual(downstream("A", [node("A"),node("B")], [{from:"A",to:"missing"},{from:"missing",to:"B"}]), []);
});
test("unchanged, empty and overlong venue proposals are rejected", () => {
  for (const venue of [" main auditorium ", "", "x".repeat(181)]) assert.throws(() => analyzeVenueChange(createSeed(), DEMO_EVENT_ID, venue));
});
test("apply updates linked sessions/resources and creates 5 owner-assigned follow-ups", () => {
  const data = createSeed();
  const original = data.tasks.find(t => t.id === "task-06")!;
  const before = structuredClone(original);
  const result = applyVenueChange(data, input());
  assert.equal(data.events[0].venue, "Seminar Hall B");
  assert.equal(data.tasks.length, 47);
  assert.equal(result.followupTaskIds.length, 5);
  for (const id of result.followupTaskIds) {
    const task = data.tasks.find(t => t.id === id)!;
    const source = data.tasks.find(t => `task:${t.id}` === task.dependencies[0])!;
    assert.equal(task.ownerId, source.ownerId); assert.equal(task.status,"To do"); assert.equal(task.syncState,"pending");
  }
  assert(data.sessions.filter(s => ["session-opening","session-judging"].includes(s.id)).every(s => s.venue === "Seminar Hall B"));
  assert(data.resources.filter(r => ["resource-projector","resource-mics","resource-stage","resource-tables"].includes(r.id)).every(r => r.location === "Seminar Hall B" && r.status === "Needs attention"));
  assert.deepEqual(data.tasks.find(t => t.id === "task-06"), before);
  assert.equal(data.resources.find(r => r.id === "resource-kits")?.location, "Convention Centre · Foyer");
  assert.equal(pendingCount(data), 64);
});
test("repeated apply with the same change ID does not duplicate work", () => {
  const data = createSeed();
  const first = applyVenueChange(data, input());
  const second = applyVenueChange(data, input());
  assert.deepEqual(second, first); assert.equal(data.tasks.length,47); assert.equal(data.changes.length,1);
});
test("stale revision and stale venue previews are rejected", () => {
  const data = createSeed(); data.revision = 3;
  assert.throws(() => applyVenueChange(data, input()), /changed after/);
  data.revision = 0; data.events[0].venue = "Another hall";
  assert.throws(() => applyVenueChange(data, input()), /changed after/);
});
test("follow-up creation is optional", () => {
  const data = createSeed(); const result = applyVenueChange(data, input(0,false));
  assert.equal(data.tasks.length,42); assert.equal(result.followupTaskIds.length,0); assert.equal(data.events[0].venue,"Seminar Hall B");
});
test("cycle validation detects back edges but accepts the seeded DAG", () => {
  const graph = buildGraph(createSeed(),DEMO_EVENT_ID);
  assert.equal(hasCycle(graph.nodes,graph.edges),false);
  assert.equal(hasCycle([node("A"),node("B")],[{from:"A",to:"B"},{from:"B",to:"A"}]),true);
});

test("source label never treats pending local facts as fully Notion-synchronized", () => {
  const data = createSeed(); data.events[0].syncState = "synced";
  assert.equal(analyzeVenueChange(data, DEMO_EVENT_ID, "Seminar Hall B").source, "Local operational data");
  for (const record of [...data.events, ...data.tasks, ...data.sessions, ...data.resources, ...data.people]) record.syncState = "synced";
  assert.equal(analyzeVenueChange(data, DEMO_EVENT_ID, "Seminar Hall B").source, "Notion-synchronized data");
});

test("interrupted sync leases expire instead of disabling the UI forever", async () => {
  const { isSyncRunning } = await import("../lib/operations");
  const data = createSeed(); const now = Date.now();
  data.sync = { status: "syncing", startedAt: new Date(now - 1000).toISOString() };
  assert.equal(isSyncRunning(data, now), true);
  assert.equal(isSyncRunning(data, now + 300000), false);
  data.sync = { status: "syncing" };
  assert.equal(isSyncRunning(data, now), false);
});
