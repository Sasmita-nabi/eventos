import { ApiError } from "./errors";
import { analyzeVenueChange } from "./dependency";
import type { AppliedChange, Entity, StoreData, ActivityItem } from "./types";

export function markPending(entity: Entity) {
  entity.updatedAt = new Date().toISOString();
  entity.syncState = "pending";
  delete entity.syncError;
}
export function addActivity(data: StoreData, title: string, detail: string, type: ActivityItem["type"], actor = "Aditi Rao") {
  data.activities.unshift({ id: crypto.randomUUID(), title, detail, type, actor, timestamp: new Date().toISOString() });
  data.activities = data.activities.slice(0, 80);
}
export interface ApplyInput { eventId: string; newVenue: string; oldVenue: string; revision: number; changeId: string; createFollowups: boolean; }

export function applyVenueChange(data: StoreData, input: ApplyInput): AppliedChange {
  const previous = data.changes.find(c => c.id === input.changeId);
  if (previous) return previous;
  const event = data.events.find(e => e.id === input.eventId);
  if (!event) throw new ApiError(404, "Event not found.");
  if (event.venue !== input.oldVenue || data.revision !== input.revision) throw new ApiError(409, "Operational data changed after this preview. Analyze the impact again before applying it.");
  const report = analyzeVenueChange(data, input.eventId, input.newVenue, input.changeId);
  const timestamp = new Date().toISOString();
  event.venue = report.newVenue;
  markPending(event);
  for (const session of data.sessions.filter(s => report.sessionIds.includes(s.id))) { session.venue = report.newVenue; markPending(session); }
  for (const resource of data.resources.filter(r => report.resourceIds.includes(r.id))) {
    resource.location = report.newVenue; resource.status = "Needs attention"; markPending(resource);
  }
  const followupTaskIds: string[] = [];
  for (const task of data.tasks.filter(t => report.taskIds.includes(t.id))) {
    task.risk = task.status !== "Done";
    if (task.status !== "Done") task.priority = "High";
    markPending(task);
    if (input.createFollowups) {
      const id = `followup-${crypto.randomUUID()}`;
      followupTaskIds.push(id);
      data.tasks.push({
        id, eventId: event.id, title: `Relocation: ${task.title}`, description: `Venue changed from ${report.oldVenue} to ${report.newVenue}. Review and update this workstream. Original task: ${task.title}.`,
        ownerId: task.ownerId, status: "To do", priority: "High", deadline: task.deadline, team: task.team,
        risk: false, dependencies: [`task:${task.id}`], tags: ["Venue change", "Follow-up"], changeId: input.changeId, syncState: "pending", updatedAt: timestamp,
      });
    }
  }
  const change: AppliedChange = { id: input.changeId, eventId: event.id, oldVenue: report.oldVenue, newVenue: report.newVenue, affectedTaskIds: report.taskIds, followupTaskIds, timestamp };
  data.changes.unshift(change);
  addActivity(data, "Venue change applied", `${report.oldVenue} → ${report.newVenue}. ${report.counts.tasks} tasks affected; ${followupTaskIds.length} follow-ups assigned.`, "change");
  return change;
}

export function isSyncRunning(data: StoreData, now = Date.now()) {
  return data.sync.status === "syncing" && Boolean(data.sync.startedAt) && now - Date.parse(data.sync.startedAt!) < 300000;
}

export function pendingCount(data: StoreData) {
  return [...data.events, ...data.tasks, ...data.resources, ...data.people].filter(x => x.syncState !== "synced").length + data.tombstones.length;
}
