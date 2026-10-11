import { ApiError } from "./errors";
import { appMeta, mutateStore, readStore } from "./store";
import { addActivity, isSyncRunning } from "./operations";
import type { Entity, Event, Person, Resource, Session, StoreData, Task } from "./types";

export const NOTION_VERSION = "2025-09-03";
export type Collection = "events" | "tasks" | "resources" | "people";
const COLLECTIONS: Collection[] = ["events", "people", "resources", "tasks"];
const ID_ENV: Record<Collection, string> = { events: "NOTION_EVENTS_DATA_SOURCE_ID", tasks: "NOTION_TASKS_DATA_SOURCE_ID", resources: "NOTION_RESOURCES_DATA_SOURCE_ID", people: "NOTION_PEOPLE_DATA_SOURCE_ID" };
export const TITLE_PROP: Record<Collection, string> = { events: "Event", tasks: "Task", resources: "Resource", people: "Person" };
const selectSchema = (names: string[]) => ({ select: { options: names.map(name => ({ name })) } });
const common = { "External ID": { rich_text: {} }, "Updated at": { date: {} } };
export const NOTION_SCHEMAS: Record<Collection, Record<string, unknown>> = {
  events: { ...common, Event: { title: {} }, Venue: { rich_text: {} }, Date: { date: {} }, "End date": { date: {} }, Status: selectSchema(["Planning", "Live", "Completed"]), Attendees: { number: {} }, Description: { rich_text: {} }, "Run of show": { rich_text: {} } },
  tasks: { ...common, Task: { title: {} }, "Event ID": { rich_text: {} }, Owner: { rich_text: {} }, "Owner ID": { rich_text: {} }, Deadline: { date: {} }, Status: selectSchema(["To do", "In progress", "Blocked", "Done"]), Priority: selectSchema(["Low", "Medium", "High", "Critical"]), Team: { rich_text: {} }, "At risk": { checkbox: {} }, Description: { rich_text: {} }, Dependencies: { rich_text: {} }, Tags: { rich_text: {} }, "Escalated to": { rich_text: {} } },
  resources: { ...common, Resource: { title: {} }, "Event ID": { rich_text: {} }, Type: selectSchema(["Equipment", "Furniture", "Space", "Supplies"]), Location: { rich_text: {} }, Status: selectSchema(["Ready", "Reserved", "Needs attention"]), Quantity: { number: {} }, "Owner ID": { rich_text: {} }, Dependencies: { rich_text: {} } },
  people: { ...common, Person: { title: {} }, Role: { rich_text: {} }, Team: { rich_text: {} }, Availability: selectSchema(["Available", "On duty", "Unavailable"]), Email: { email: {} }, Color: { rich_text: {} } },
};

// API responses contain heterogeneous property values. Keep them isolated here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NotionPage = { id: string; url: string; last_edited_time: string; properties: Record<string, any> };
export class NotionClient {
  private nextRequestAt = 0;
  private deadlineAt = Infinity;
  setDeadline(deadline: number) { this.deadlineAt = deadline; }
  constructor(private token: string, private fetcher: typeof fetch = fetch, private spacing = 350) {}
  async request<T = Record<string, unknown>>(method: string, endpoint: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const wait = Math.max(0, this.nextRequestAt - Date.now());
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      this.nextRequestAt = Date.now() + this.spacing;
      const remaining = this.deadlineAt - Date.now();
      if (remaining <= 0) throw new ApiError(503, "Notion operation timed out. Confirmed writes are preserved; retry the remaining records.");
      let response: Response;
      try {
        response = await this.fetcher(`https://api.notion.com/v1${endpoint}`, { method, headers: { Authorization: `Bearer ${this.token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: "no-store", signal: AbortSignal.timeout(Math.min(20000, Math.ceil(remaining))) });
      } catch { throw new ApiError(502, "Notion could not be reached. No sync success was recorded; check your connection and retry."); }
      if (response.status === 429 && attempt < 3) {
        const seconds = Number(response.headers.get("Retry-After")) || 1;
        this.nextRequestAt = Date.now() + Math.min(Math.max(seconds, 1), 30) * 1000;
        continue;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new ApiError(response.status === 401 || response.status === 403 ? 503 : 502, `Notion (${response.status}): ${payload.message || "Request failed. Check integration access and database properties."}`);
      return payload as T;
    }
    throw new ApiError(502, "Notion rate limit reached. Wait briefly and retry.");
  }
  async queryAll(dataSourceId: string): Promise<NotionPage[]> {
    const pages: NotionPage[] = [];
    let cursor: string | undefined;
    do {
      const result = await this.request<{ results: NotionPage[]; has_more: boolean; next_cursor: string | null }>("POST", `/data_sources/${encodeURIComponent(dataSourceId)}/query`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
      pages.push(...result.results);
      cursor = result.has_more ? result.next_cursor ?? undefined : undefined;
    } while (cursor);
    return pages;
  }
}
export function configuredNotion() {
  if (!appMeta().notionConfigured) throw new ApiError(503, "Notion is not configured. Add the server-side variables in .env.local. Your local data is safe.");
  return new NotionClient(process.env.NOTION_API_KEY!);
}
const rich = (content: string) => ({ rich_text: (content.match(/[\s\S]{1,1900}/g) ?? []).map(part => ({ text: { content: part } })) });
const title = (content: string) => ({ title: [{ text: { content } }] });
const sel = (name: string) => ({ select: { name } });
const date = (start?: string) => ({ date: start ? { start } : null });
const textValue = (page: NotionPage, prop: string): string => (page.properties[prop]?.rich_text ?? page.properties[prop]?.title ?? []).map((part: { plain_text?: string; text?: { content?: string } }) => part.plain_text ?? part.text?.content ?? "").join("");
const selectValue = (page: NotionPage, prop: string) => page.properties[prop]?.select?.name;
const dateValue = (page: NotionPage, prop: string) => page.properties[prop]?.date?.start;
const split = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);

export function toProperties(kind: Collection, entity: Entity, data: StoreData) {
  const properties: Record<string, unknown> = { "External ID": rich(entity.id), "Updated at": date(entity.updatedAt) };
  if (kind === "events") {
    const e = entity as Event;
    Object.assign(properties, { Event: title(e.name), Venue: rich(e.venue), Date: date(e.date), "End date": date(e.endDate), Status: sel(e.status), Attendees: { number: e.attendees }, Description: rich(e.description), "Run of show": rich(JSON.stringify(data.sessions.filter(s => s.eventId === e.id).map(({ notionPageId: _page, notionUrl: _url, syncError: _error, ...session }) => session))) });
  } else if (kind === "tasks") {
    const t = entity as Task;
    Object.assign(properties, { Task: title(t.title), "Event ID": rich(t.eventId), Owner: rich(data.people.find(p => p.id === t.ownerId)?.name || "Unassigned"), "Owner ID": rich(t.ownerId), Deadline: date(t.deadline), Status: sel(t.status), Priority: sel(t.priority), Team: rich(t.team), "At risk": { checkbox: t.risk }, Description: rich(t.description), Dependencies: rich(t.dependencies.join(",")), Tags: rich(t.tags.join(",")), "Escalated to": rich(t.escalatedTo || "") });
  } else if (kind === "resources") {
    const r = entity as Resource;
    Object.assign(properties, { Resource: title(r.name), "Event ID": rich(r.eventId), Type: sel(r.type), Location: rich(r.location), Status: sel(r.status), Quantity: { number: r.quantity }, "Owner ID": rich(r.ownerId), Dependencies: rich(r.dependencies.join(",")) });
  } else {
    const p = entity as Person;
    Object.assign(properties, { Person: title(p.name), Role: rich(p.role), Team: rich(p.team), Availability: sel(p.availability), Email: { email: p.email || null }, Color: rich(p.color) });
  }
  return properties;
}
export function fromPage(kind: Collection, page: NotionPage, existing?: Entity): Entity | null {
  const id = textValue(page, "External ID");
  if (!id) return null; // Only app-managed records are imported.
  const base = { ...existing, id, updatedAt: page.last_edited_time, syncState: "synced" as const, notionPageId: page.id, notionUrl: page.url };
  if (kind === "events") return { ...base, name: textValue(page, "Event"), venue: textValue(page, "Venue"), date: dateValue(page, "Date") || "", endDate: dateValue(page, "End date") || dateValue(page, "Date") || "", status: selectValue(page, "Status") || "Planning", attendees: page.properties.Attendees?.number ?? 0, description: textValue(page, "Description") } as Event;
  if (kind === "tasks") return { ...base, title: textValue(page, "Task"), eventId: textValue(page, "Event ID"), ownerId: textValue(page, "Owner ID"), deadline: dateValue(page, "Deadline") || "", status: selectValue(page, "Status") || "To do", priority: selectValue(page, "Priority") || "Medium", team: textValue(page, "Team"), description: textValue(page, "Description"), risk: Boolean(page.properties["At risk"]?.checkbox), dependencies: split(textValue(page, "Dependencies")), tags: split(textValue(page, "Tags")), escalatedTo: textValue(page, "Escalated to") || undefined } as Task;
  if (kind === "resources") return { ...base, name: textValue(page, "Resource"), eventId: textValue(page, "Event ID"), ownerId: textValue(page, "Owner ID"), location: textValue(page, "Location"), status: selectValue(page, "Status") || "Reserved", type: selectValue(page, "Type") || "Equipment", quantity: page.properties.Quantity?.number ?? 1, dependencies: split(textValue(page, "Dependencies")) } as Resource;
  return { ...base, name: textValue(page, "Person"), email: page.properties.Email?.email || "", role: textValue(page, "Role"), team: textValue(page, "Team"), availability: selectValue(page, "Availability") || "Available", color: textValue(page, "Color") || "sage" } as Person;
}

export async function checkNotion() {
  const client = configuredNotion();
  const results = [];
  for (const kind of COLLECTIONS) {
    const response = await client.request<{ title: { plain_text?: string; text?: { content?: string } }[]; properties: Record<string, unknown> }>("GET", `/data_sources/${process.env[ID_ENV[kind]]}`);
    const missing = Object.keys(NOTION_SCHEMAS[kind]).filter(name => !response.properties[name]);
    results.push({ kind, title: response.title.map(t => t.plain_text || t.text?.content || "").join(""), valid: !missing.length, missing });
  }
  return { connected: results.every(x => x.valid), databases: results };
}

const syncLock = globalThis as typeof globalThis & { __eventosNotionBusy?: boolean };
async function runExclusive<T>(operation: (jobId: string) => Promise<T>) {
  if (syncLock.__eventosNotionBusy) throw new ApiError(409, "A Notion operation is already running. Please wait.");
  syncLock.__eventosNotionBusy = true;
  const jobId = crypto.randomUUID();
  let acquired = false;
  try {
    await mutateStore(data => {
      if (isSyncRunning(data)) throw new ApiError(409, "A Notion operation is already running. Its lease expires after five minutes if the server is interrupted.");
      data.sync.status = "syncing"; data.sync.jobId = jobId; data.sync.startedAt = new Date().toISOString(); delete data.sync.error;
    });
    acquired = true;
    return await operation(jobId);
  } catch (error) {
    if (acquired) await mutateStore(data => {
      if (data.sync.jobId !== jobId) return;
      data.sync.status = "error"; data.sync.error = error instanceof Error ? error.message : "Sync failed.";
      delete data.sync.jobId; delete data.sync.startedAt;
    }).catch(() => undefined);
    throw error;
  } finally { syncLock.__eventosNotionBusy = false; }
}

export async function pushNotion(client = configuredNotion()) {
  return runExclusive(async (jobId) => {
    client.setDeadline(Date.now() + 240000);
    const snapshot = await readStore();
    let synced = 0;
    const failures: string[] = [];
    for (const kind of COLLECTIONS) {
      const entities = snapshot[kind].filter(e => e.syncState !== "synced");
      if (!entities.length) continue;
      const dataSourceId = process.env[ID_ENV[kind]]!;
      const pages = await client.queryAll(dataSourceId);
      const index = new Map(pages.map(page => [textValue(page, "External ID"), page]));
      for (const entity of entities) {
        try {
          const known = index.get(entity.id);
          const pageId = entity.notionPageId || known?.id;
          const properties = toProperties(kind, entity, snapshot);
          const page = await client.request<NotionPage>(pageId ? "PATCH" : "POST", pageId ? `/pages/${pageId}` : "/pages", pageId ? { properties } : { parent: { data_source_id: dataSourceId }, properties });
          await mutateStore(data => {
            if (data.sync.jobId !== jobId) throw new ApiError(409, "Notion job lease changed. Retry after the current operation completes.");
            const local = data[kind].find(x => x.id === entity.id);
            if (!local) return;
            local.notionPageId = page.id; local.notionUrl = page.url;
            if (local.updatedAt === entity.updatedAt) { local.syncState = "synced"; delete local.syncError; }
            if (kind === "events") {
              for (const session of data.sessions.filter(s => s.eventId === entity.id)) {
                const old = snapshot.sessions.find(s => s.id === session.id);
                if (old?.updatedAt === session.updatedAt) session.syncState = "synced";
              }
            }
          });
          synced++;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown sync error";
          failures.push(`${kind}/${entity.id}: ${message}`);
          await mutateStore(data => { if (data.sync.jobId !== jobId) throw new ApiError(409, "Notion job lease changed."); const local = data[kind].find(x => x.id === entity.id); if (local && local.updatedAt === entity.updatedAt) { local.syncState = "error"; local.syncError = message; } });
          // Authentication/schema outages should not repeat the same failed call 42 times.
          if (message.includes("401") || message.includes("403") || message.includes("400")) break;
        }
      }
    }
    for (const tombstone of snapshot.tombstones) {
      try {
        if (tombstone.notionPageId) await client.request("PATCH", `/pages/${tombstone.notionPageId}`, { archived: true });
        await mutateStore(data => { if (data.sync.jobId !== jobId) throw new ApiError(409, "Notion job lease changed."); data.tombstones = data.tombstones.filter(t => t.id !== tombstone.id); });
      } catch (error) { failures.push(`archive/${tombstone.id}: ${error instanceof Error ? error.message : "Archive failed"}`); }
    }
    await mutateStore(data => {
      if (data.sync.jobId !== jobId) throw new ApiError(409, "Notion job lease changed.");
      delete data.sync.jobId; delete data.sync.startedAt;
      data.sync.status = failures.length ? "error" : "idle";
      if (!failures.length) { data.sync.lastSyncedAt = new Date().toISOString(); delete data.sync.error; }
      else data.sync.error = failures[0];
      addActivity(data, failures.length ? "Notion sync partially completed" : "Notion sync completed", `${synced} records written to Notion.${failures.length ? ` ${failures.length} errors; local changes preserved for retry.` : ""}`, "sync", "EventOS");
    });
    return { synced, failures };
  });
}

export async function pullNotion(client = configuredNotion()) {
  return runExclusive(async (jobId) => {
    client.setDeadline(Date.now() + 240000);
    const pagesByKind = {} as Record<Collection, NotionPage[]>;
    for (const kind of COLLECTIONS) pagesByKind[kind] = await client.queryAll(process.env[ID_ENV[kind]]!);
    const { result } = await mutateStore(data => {
      if (data.sync.jobId !== jobId) throw new ApiError(409, "Notion job lease changed.");
      let imported = 0, skipped = 0;
      for (const kind of COLLECTIONS) {
        for (const page of pagesByKind[kind]) {
          const externalId = textValue(page, "External ID");
          if (!externalId || data.tombstones.some(t => t.id === externalId)) continue;
          const index = data[kind].findIndex(x => x.id === externalId);
          const existing = index >= 0 ? data[kind][index] : undefined;
          if (existing && existing.syncState !== "synced") { skipped++; continue; }
          const entity = fromPage(kind, page, existing);
          if (!entity) continue;
          if (index >= 0) (data[kind] as Entity[])[index] = entity;
          else (data[kind] as Entity[]).push(entity);
          if (kind === "events") {
            try {
              const schedule: Session[] = JSON.parse(textValue(page, "Run of show") || "[]");
              for (const session of schedule) {
                if (!session.id || session.eventId !== externalId || !session.title || !Array.isArray(session.dependencies)) continue;
                const sessionIndex = data.sessions.findIndex(s => s.id === session.id);
                if (sessionIndex >= 0 && data.sessions[sessionIndex].syncState !== "synced") continue;
                const value = { ...session, syncState: "synced" as const };
                if (sessionIndex >= 0) data.sessions[sessionIndex] = value; else data.sessions.push(value);
              }
            } catch { /* Preserve the local schedule when Notion schedule JSON is malformed. */ }
          }
          imported++;
        }
      }
      delete data.sync.jobId; delete data.sync.startedAt;
      data.sync.status = "idle"; data.sync.lastPulledAt = new Date().toISOString(); delete data.sync.error;
      addActivity(data, "Updates pulled from Notion", `${imported} records imported; ${skipped} locally edited records preserved.`, "sync", "EventOS");
      return { imported, skipped };
    });
    return result;
  });
}
