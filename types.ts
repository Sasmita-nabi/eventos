export type Role = "organizer" | "coordinator" | "volunteer";
export type TaskStatus = "To do" | "In progress" | "Blocked" | "Done";
export type Priority = "Low" | "Medium" | "High" | "Critical";
export type SyncState = "local" | "pending" | "synced" | "error";
export type NodeKind = "venue" | "session" | "resource" | "task" | "person" | "communication";
export type Section = "overview" | "tasks" | "schedule" | "team" | "resources" | "impact" | "integrations" | "settings";

export interface Entity {
  id: string;
  updatedAt: string;
  syncState: SyncState;
  notionPageId?: string;
  notionUrl?: string;
  syncError?: string;
}
export interface Event extends Entity {
  name: string;
  date: string;
  endDate: string;
  venue: string;
  status: "Planning" | "Live" | "Completed";
  attendees: number;
  description: string;
}
export interface Person extends Entity {
  name: string;
  email: string;
  role: string;
  team: string;
  availability: "Available" | "On duty" | "Unavailable";
  color: string;
}
export interface Task extends Entity {
  eventId: string;
  title: string;
  description: string;
  ownerId: string;
  status: TaskStatus;
  priority: Priority;
  deadline: string;
  team: string;
  risk: boolean;
  dependencies: string[];
  tags: string[];
  escalatedTo?: string;
  changeId?: string;
}
export interface Session extends Entity {
  eventId: string;
  title: string;
  start: string;
  end: string;
  venue: string;
  ownerId: string;
  description: string;
  dependencies: string[];
}
export interface Resource extends Entity {
  eventId: string;
  name: string;
  type: "Equipment" | "Furniture" | "Space" | "Supplies";
  location: string;
  status: "Ready" | "Reserved" | "Needs attention";
  quantity: number;
  ownerId: string;
  dependencies: string[];
}
export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  type: "task" | "change" | "sync" | "team" | "event" | "escalation";
  timestamp: string;
  actor: string;
}
export interface AppliedChange {
  id: string;
  eventId: string;
  oldVenue: string;
  newVenue: string;
  affectedTaskIds: string[];
  followupTaskIds: string[];
  timestamp: string;
}
export interface Tombstone { kind: "tasks"; id: string; notionPageId?: string; }
export interface StoreData {
  revision: number;
  events: Event[];
  tasks: Task[];
  sessions: Session[];
  people: Person[];
  resources: Resource[];
  activities: ActivityItem[];
  changes: AppliedChange[];
  tombstones: Tombstone[];
  sync: { status: "idle" | "syncing" | "error"; lastSyncedAt?: string; lastPulledAt?: string; error?: string; jobId?: string; startedAt?: string; };
}
export interface AppMeta {
  persistence: "local" | "supabase";
  notionConfigured: boolean;
  notionMissing: string[];
  aiConfigured: boolean;
  aiProvider: string;
  demoMode: boolean;
}
export interface AppPayload { data: StoreData; meta: AppMeta; }
export interface GraphNode { id: string; label: string; kind: NodeKind; entityId: string; }
export interface GraphEdge { from: string; to: string; }
export interface AffectedNode extends GraphNode { depth: number; path: string[]; }
export interface ImpactReport {
  id: string;
  eventId: string;
  oldVenue: string;
  newVenue: string;
  revision: number;
  analyzedAt: string;
  source: "Local operational data" | "Notion-synchronized data";
  nodes: AffectedNode[];
  edges: GraphEdge[];
  counts: { tasks: number; sessions: number; resources: number; people: number; communication: number; };
  taskIds: string[];
  sessionIds: string[];
  resourceIds: string[];
  personIds: string[];
}
export interface Briefing {
  summary: string;
  actions: string[];
  risks: string[];
  communication: string;
  mode: "rules" | "ai";
  provider: string;
  warning?: string;
}
export const ROLE_PERSON: Record<Role, string> = { organizer: "person-01", coordinator: "person-02", volunteer: "person-03" };
export const TASK_STATUSES: TaskStatus[] = ["To do", "In progress", "Blocked", "Done"];
export const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Critical"];
export const TEAMS = ["Operations", "Technical", "Communications", "Hospitality", "Design"];
