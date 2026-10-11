"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownToLine, Check, CheckCheck, ChevronDown, Clock3, Flag, GripVertical, LayoutGrid, List, MoreHorizontal, Plus, Search, SlidersHorizontal, UserRound, X } from "lucide-react";
import { PRIORITIES, ROLE_PERSON, TASK_STATUSES, TEAMS, type Task, type TaskStatus } from "@/lib/types";
import { buildGraph } from "@/lib/dependency";
import { useApp } from "./context";
import { Avatar, Badge, Button, csvCell, downloadText, EmptyState, Field, formatDay, formatTime, fromLocal, IconButton, localDateTime, Modal, Priority, SectionHeader, StatusBadge } from "./ui";

export default function TasksView() {
  const { data, event, role, request, notify, openTask } = useApp();
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [team, setTeam] = useState("All teams");
  const [priority, setPriority] = useState("All priorities");
  const [onlyMine, setOnlyMine] = useState(false);
  const [riskOnly, setRiskOnly] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const personId = ROLE_PERSON[role];
  const scoped = data.tasks.filter(t => t.eventId === event.id && (role === "organizer" || role === "volunteer" && t.ownerId === personId || role === "coordinator" && t.team === data.people.find(p => p.id === personId)?.team));
  const tasks = scoped.filter(t => `${t.title} ${t.description} ${data.people.find(p => p.id === t.ownerId)?.name || ""}`.toLowerCase().includes(query.toLowerCase()) && (status === "All statuses" || t.status === status) && (team === "All teams" || t.team === team) && (priority === "All priorities" || t.priority === priority) && (!onlyMine || t.ownerId === personId) && (!riskOnly || t.risk)).sort((a, b) => Number(Boolean(b.changeId)) - Number(Boolean(a.changeId)));
  const hasFilters = query || status !== "All statuses" || team !== "All teams" || priority !== "All priorities" || onlyMine || riskOnly;
  const updateStatus = async (task: Task, nextStatus: TaskStatus) => {
    if (task.status === nextStatus) return;
    try { await request(`/tasks/${task.id}`, "PATCH", { status: nextStatus }); notify(`“${task.title}” moved to ${nextStatus.toLowerCase()}.`); }
    catch (err) { notify(err instanceof Error ? err.message : "Could not update the task.", "error"); }
  };
  const exportTasks = () => {
    const rows = [["Task", "Owner", "Team", "Status", "Priority", "Deadline", "At risk"], ...tasks.map(t => [t.title, data.people.find(p => p.id === t.ownerId)?.name || "Unassigned", t.team, t.status, t.priority, t.deadline, t.risk ? "Yes" : "No"])];
    downloadText("eventos-tasks.csv", rows.map(r => r.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8"); notify("Your filtered task list has been exported.");
  };
  return <div className="view-enter"><SectionHeader eyebrow="WORKSTREAMS" title="Every task. A clear owner." description={`${scoped.length} tasks ${role === "organizer" ? "across your event" : "in your role's scope"}. A shared plan, one step at a time.`}><Button variant="secondary" onClick={exportTasks}><ArrowDownToLine size={16} />Export</Button>{role !== "volunteer" && <Button onClick={() => openTask()}><Plus size={16} />New task</Button>}</SectionHeader>
    {role !== "organizer" && <div className="scope-banner"><UserRound size={17} /><span>{role === "volunteer" ? "Your assignments, your focus. You can update status, add notes and escalate blockers." : "Technical team view. You can manage your team's tasks and preview event-wide impact."}</span><Badge tone="blue">ROLE PREVIEW</Badge></div>}
    <div className="task-toolbar"><div className="search-input"><Search size={16} /><input aria-label="Search tasks" placeholder="Find a task, owner or detail…" value={query} onChange={e => setQuery(e.target.value)} />{query && <IconButton label="Clear search" onClick={() => setQuery("")}><X size={13} /></IconButton>}</div><div className="toolbar-selects"><select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)}><option>All statuses</option>{TASK_STATUSES.map(x => <option key={x}>{x}</option>)}</select>{role === "organizer" && <select aria-label="Filter by team" value={team} onChange={e => setTeam(e.target.value)}><option>All teams</option>{TEAMS.map(x => <option key={x}>{x}</option>)}</select>}<select aria-label="Filter by priority" value={priority} onChange={e => setPriority(e.target.value)}><option>All priorities</option>{PRIORITIES.map(x => <option key={x}>{x}</option>)}</select></div><div className="view-toggle"><IconButton label="Board view" className={view === "board" ? "selected" : ""} onClick={() => setView("board")}><LayoutGrid size={17} /></IconButton><IconButton label="List view" className={view === "list" ? "selected" : ""} onClick={() => setView("list")}><List size={18} /></IconButton></div></div>
    <div className="task-filter-row"><div><button className={`filter-chip ${onlyMine ? "selected" : ""}`} onClick={() => setOnlyMine(!onlyMine)}><UserRound size={13} />Assigned to me{onlyMine && <Check size={12} />}</button><button className={`filter-chip ${riskOnly ? "selected" : ""}`} onClick={() => setRiskOnly(!riskOnly)}><Flag size={13} />At risk{riskOnly && <Check size={12} />}</button>{hasFilters && <button className="clear-filters" onClick={() => { setQuery(""); setStatus("All statuses"); setTeam("All teams"); setPriority("All priorities"); setOnlyMine(false); setRiskOnly(false); }}>Clear filters</button>}</div><span>{tasks.length} task{tasks.length !== 1 ? "s" : ""}{view === "board" && <span className="drag-hint"> · Drag a card to update status</span>}</span></div>
    {!tasks.length ? <div className="card"><EmptyState title={hasFilters ? "No tasks match this view" : "Your next great event starts here"} description={hasFilters ? "Try a different filter or search to find what you're looking for." : "Create a task, give it an owner, and build your plan."} action={role !== "volunteer" && !hasFilters ? <Button onClick={() => openTask()}><Plus size={16} />Create your first task</Button> : undefined} /></div> : view === "board" ? <div className="kanban-board">{TASK_STATUSES.map(column => {
      const group = tasks.filter(t => t.status === column);
      const visible = expanded.includes(column) ? group : group.slice(0, 5);
      return <div key={column} className={`kanban-column column-${column.toLowerCase().replaceAll(" ", "-")} ${dropTarget === column ? "drop-target" : ""}`} onDragOver={e => { e.preventDefault(); setDropTarget(column); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null); }} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); const task = tasks.find(t => t.id === id); setDropTarget(null); setDragging(null); if (task) void updateStatus(task, column); }}><div className="column-header"><span className="column-dot" /><h3>{column}</h3><span className="column-count">{group.length}</span>{column === "To do" && role !== "volunteer" && <IconButton label="Add a task" onClick={() => openTask()}><Plus size={16} /></IconButton>}</div><div className="column-cards">{visible.map(task => <article key={task.id} draggable onDragStart={e => { e.dataTransfer.setData("text/plain", task.id); e.dataTransfer.effectAllowed = "move"; setDragging(task.id); }} onDragEnd={() => { setDragging(null); setDropTarget(null); }} className={`task-card ${dragging === task.id ? "dragging" : ""}`}><div className="task-card-top"><span className={`task-label ${task.changeId ? "task-label-change" : ""}`}>{task.tags[0] || "Event task"}</span><IconButton label={`Edit ${task.title}`} onClick={() => openTask(task)}><MoreHorizontal size={17} /></IconButton></div><button className="task-card-title" onClick={() => openTask(task)}>{task.status === "Done" && <CheckCheck size={15} />}{task.title}</button><p className="task-card-description">{task.description}</p>{(task.risk || task.escalatedTo) && <div className={`task-warning ${task.escalatedTo ? "task-escalated" : ""}`}><Flag size={12} />{task.escalatedTo ? "Escalated to organizer" : "Needs attention"}</div>}<div className="task-card-priority"><Priority value={task.priority} />{task.dependencies.length > 0 && <span title={`${task.dependencies.length} prerequisite(s)`}><CheckCheck size={12} />{task.dependencies.length} linked</span>}</div><div className="task-card-footer"><span className="task-due"><Clock3 size={12} />{task.deadline ? formatTime(task.deadline) : "No deadline"}</span><Avatar person={data.people.find(p => p.id === task.ownerId)} size="sm" /></div></article>)}{!group.length && <div className="column-empty"><span>Room for what's next.</span></div>}{group.length > 5 && <button className="show-more" onClick={() => setExpanded(expanded.includes(column) ? expanded.filter(x => x !== column) : [...expanded, column])}>{expanded.includes(column) ? "Show fewer" : `Show ${group.length - 5} more tasks`}<ChevronDown size={14} className={expanded.includes(column) ? "rotate" : ""} /></button>}</div></div>;
    })}</div> : <div className="card table-wrap"><table className="data-table"><thead><tr><th>TASK</th><th>OWNER</th><th>STATUS</th><th>PRIORITY</th><th>DEADLINE (IST)</th><th /></tr></thead><tbody>{tasks.map(task => <tr key={task.id}><td><div className="table-task"><button aria-label={task.status === "Done" ? `Reopen ${task.title}` : `Complete ${task.title}`} className={`task-check ${task.status === "Done" ? "is-checked" : ""}`} onClick={() => void updateStatus(task, task.status === "Done" ? "To do" : "Done")}>{task.status === "Done" && <Check size={12} />}</button><button className="table-task-name" onClick={() => openTask(task)}><strong>{task.title}</strong><span>{task.team}{task.risk && " · At risk"}</span></button></div></td><td><div className="person-cell"><Avatar person={data.people.find(p => p.id === task.ownerId)} size="sm" /><span>{data.people.find(p => p.id === task.ownerId)?.name.split(" ")[0] || "Unassigned"}</span></div></td><td><StatusBadge status={task.status} /></td><td><Priority value={task.priority} /></td><td><span className="deadline-cell">{formatDay(task.deadline)}<small>{formatTime(task.deadline)}</small></span></td><td><IconButton label={`Task options for ${task.title}`} onClick={() => openTask(task)}><MoreHorizontal size={17} /></IconButton></td></tr>)}</tbody></table></div>}
  </div>;
}

export function TaskModal({ task, onClose }: { task?: Task; onClose: () => void }) {
  const { data, event, role, request, notify } = useApp();
  const volunteer = role === "volunteer";
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [ownerId, setOwner] = useState(task?.ownerId || (role === "coordinator" ? ROLE_PERSON.coordinator : ""));
  const [team, setTeam] = useState(task?.team || (role === "coordinator" ? "Technical" : "Operations"));
  const [status, setStatus] = useState<TaskStatus>(task?.status || "To do");
  const [priority, setPriority] = useState(task?.priority || "Medium");
  const [deadline, setDeadline] = useState(task?.deadline ? localDateTime(task.deadline) : `${event.date}T10:00`);
  const [dependencies, setDependencies] = useState<string[]>(task?.dependencies || []);
  const [risk, setRisk] = useState(task?.risk || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [reason, setReason] = useState("");
  const prerequisites = buildGraph(data, event.id).nodes.filter(n => ["venue", "session", "resource", "task"].includes(n.kind) && n.entityId !== task?.id);
  async function save() {
    setSaving(true); setError("");
    try {
      const body = volunteer ? { status, description } : { title, description, ownerId, team, status, priority, deadline: fromLocal(deadline), dependencies, ...(task ? { risk } : { eventId: event.id }) };
      await request(task ? `/tasks/${task.id}` : "/tasks", task ? "PATCH" : "POST", body);
      notify(task ? "Task updated. Your team has a clear next step." : "Task created and added to your event."); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save this task."); } finally { setSaving(false); }
  }
  async function remove() {
    if (!task) return;
    setSaving(true); setError("");
    try { await request(`/tasks/${task.id}`, "DELETE"); notify("Task removed. If connected, Notion will archive it on the next sync."); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not delete this task."); } finally { setSaving(false); }
  }
  async function escalate() {
    if (!task) return;
    setSaving(true); setError("");
    try { await request(`/tasks/${task.id}/escalate`, "POST", { reason: reason || "Needs organizer attention" }); notify("Escalated to Aditi. The task is now marked critical."); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not escalate this task."); } finally { setSaving(false); }
  }
  return <Modal title={task ? "Make the next step clear." : "A new task, a clear plan."} eyebrow={task ? "TASK DETAILS" : "CREATE A TASK"} onClose={() => { if (!saving) onClose(); }} footer={<><div className="footer-left">{task && !volunteer && <Button variant={confirmDelete ? "danger" : "ghost"} onClick={() => confirmDelete ? void remove() : setConfirmDelete(true)} disabled={saving}>{confirmDelete ? "Confirm delete" : "Delete task"}</Button>}{task && task.status !== "Done" && <Button variant="ghost" onClick={() => setEscalating(!escalating)} disabled={saving}><Flag size={14} />Escalate</Button>}</div><div className="footer-right"><Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button><Button loading={saving} onClick={() => escalating ? void escalate() : void save()}>{escalating ? "Send escalation" : task ? "Save changes" : "Create task"}</Button></div></>}>
    <div className="source-line"><Badge tone={task?.syncState === "synced" ? "green" : "neutral"} dot>{task?.syncState === "synced" ? "Notion synchronized" : task?.syncState === "error" ? "Sync needs attention" : "Local operational data"}</Badge>{task?.notionUrl && <a href={task.notionUrl} target="_blank" rel="noreferrer">Open in Notion ↗</a>}</div>
    {error && <div className="form-error"><AlertTriangle size={16} />{error}</div>}
    {confirmDelete && <div className="notice notice-amber">Deleting removes this task locally. Its Notion page will be archived on the next sync. Dependent tasks must be unlinked first.</div>}
    <form onSubmit={e => { e.preventDefault(); void save(); }} className="form-stack"><Field label="Task title"><input value={title} maxLength={180} required disabled={volunteer} onChange={e => setTitle(e.target.value)} placeholder="What needs to happen?" /></Field><Field label="Description & notes"><textarea value={description} maxLength={2000} rows={3} onChange={e => setDescription(e.target.value)} placeholder="Give the team the context they need." /></Field><div className="form-grid"><Field label="Owner"><select value={ownerId} disabled={volunteer} onChange={e => { setOwner(e.target.value); const person = data.people.find(p => p.id === e.target.value); if (person) setTeam(person.team); }}><option value="">Unassigned</option>{data.people.filter(p => role !== "coordinator" || p.team === "Technical").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Team"><select value={team} disabled={volunteer || role === "coordinator"} onChange={e => setTeam(e.target.value)}>{TEAMS.map(t => <option key={t}>{t}</option>)}</select></Field><Field label="Status"><select value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>{TASK_STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field><Field label="Priority"><select value={priority} disabled={volunteer} onChange={e => setPriority(e.target.value as Task["priority"])}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></Field><Field label="Deadline (IST)" className="span-2"><input type="datetime-local" disabled={volunteer} value={deadline} onChange={e => setDeadline(e.target.value)} /></Field></div><details className="dependency-details"><summary><CheckCheck size={16} />Prerequisites<span>{dependencies.length} linked</span><ChevronDown size={16} /></summary><p>Changes to these items can affect this task. Cycles are rejected by the engine.</p><div className="dependency-options">{prerequisites.map(n => <label key={n.id}><input type="checkbox" checked={dependencies.includes(n.id)} disabled={volunteer} onChange={e => setDependencies(e.target.checked ? [...dependencies, n.id] : dependencies.filter(x => x !== n.id))} /><span><small>{n.kind}</small>{n.label}</span></label>)}</div></details>{task && !volunteer && <label className="check-field"><input type="checkbox" checked={risk} onChange={e => setRisk(e.target.checked)} /><span>Flag this task as at risk</span></label>}{escalating && <Field label="What does the organizer need to know?" hint="This creates an in-app escalation and marks the task critical. No email or message is sent."><textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe the blocker and the help you need…" /></Field>}</form>
  </Modal>;
}
