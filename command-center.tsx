"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Bell, Boxes, CalendarDays, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Command, Flag, GitBranch, LayoutDashboard, Loader2, Menu, Plus, PlugZap, Search, Settings2, ShieldCheck, Sparkles, Users, WifiOff, Workflow, X } from "lucide-react";
import type { AppPayload, Role, Section, Task } from "@/lib/types";
import { ROLE_PERSON } from "@/lib/types";
import { AppContext } from "./context";
import Dashboard from "./dashboard";
import TasksView, { TaskModal } from "./tasks-view";
import { EventModal, PersonModal, ResourceModal, ResourcesView, ScheduleView, SessionModal, TeamView } from "./operations-views";
import ImpactView from "./impact-view";
import IntegrationsView, { SettingsView } from "./integrations-view";
import { Avatar, Badge, Brand, Button, EmptyState, IconButton, Modal, NotionLogo, StatusBadge, timeAgo } from "./ui";

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "tasks", label: "Tasks", icon: CheckCheck },
  { id: "schedule", label: "Schedule", icon: CalendarDays }, { id: "team", label: "Team", icon: Users },
  { id: "resources", label: "Resources", icon: Boxes }, { id: "impact", label: "Impact analysis", icon: GitBranch },
  { id: "integrations", label: "Integrations", icon: PlugZap }, { id: "settings", label: "Settings", icon: Settings2 },
] as const;
const ROLE_LABEL: Record<Role, string> = { organizer: "Organizer", coordinator: "Team lead", volunteer: "Volunteer" };
type Editor = { kind: "task"; task?: Task } | { kind: "session" | "person" | "resource"; id?: string } | { kind: "event"; create: boolean };
type Toast = { id: number; message: string; tone: "success" | "error" | "info" };

export default function CommandCenter() {
  const [payload, setPayload] = useState<AppPayload | null>(null);
  const [activeId, setActiveId] = useState("");
  const [role, setRoleState] = useState<Role>("organizer");
  const [section, setSectionState] = useState<Section>("overview");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [eventMenu, setEventMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [lastReadId, setLastReadId] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [pollError, setPollError] = useState(false);
  const [activeRequests, setActiveRequests] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const mounted = useRef(true);
  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = ++toastId.current; setToasts(current => [...current.slice(-2), { id, message, tone }]);
    setTimeout(() => { if (mounted.current) setToasts(current => current.filter(t => t.id !== id)); }, tone === "error" ? 8000 : 4500);
  }, []);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/state", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Couldn't load the workspace.");
    setPayload(result); setLoadError(""); setPollError(false);
  }, []);
  useEffect(() => {
    mounted.current = true;
    try { const saved = localStorage.getItem("eventos.activeEvent"); if (saved) setActiveId(saved); const savedRole = localStorage.getItem("eventos.role"); if (savedRole && ["organizer", "coordinator", "volunteer"].includes(savedRole)) setRoleState(savedRole as Role); const read = localStorage.getItem("eventos.lastRead"); if (read) setLastReadId(read); } catch { /* Storage access is optional. */ }
    const hash = location.hash.slice(1); if (NAV.some(n => n.id === hash)) setSectionState(hash as Section);
    void refresh().catch(error => setLoadError(error.message));
    const timer = setInterval(() => { void refresh().catch(() => setPollError(true)); }, 15000);
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(current => !current); } };
    document.addEventListener("keydown", onKey);
    return () => { mounted.current = false; clearInterval(timer); document.removeEventListener("keydown", onKey); };
  }, [refresh]);
  const request = useCallback(async <T,>(endpoint: string, method = "GET", body?: unknown): Promise<T> => {
    setActiveRequests(n => n + 1);
    try {
      const response = await fetch(`/api${endpoint}`, { method, headers: { "Content-Type": "application/json", "x-eventos-role": role }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The operation couldn't be completed.");
      if (result.data && result.meta) setPayload({ data: result.data, meta: result.meta });
      else if (method !== "GET" && !["/impact/analyze", "/impact/brief", "/notion/check"].includes(endpoint)) await refresh();
      return result as T;
    } finally { setActiveRequests(n => Math.max(0, n - 1)); }
  }, [role, refresh]);
  const setSection = useCallback((next: Section) => { setSectionState(next); setSidebarOpen(false); setEventMenu(false); if (typeof window !== "undefined") { history.replaceState(null, "", `#${next}`); window.scrollTo({ top: 0, behavior: "instant" }); } }, []);
  const setRole = useCallback((next: Role) => { setRoleState(next); try { localStorage.setItem("eventos.role", next); } catch {} setEditor(null); notify(`${ROLE_LABEL[next]} role preview selected. This isn't authenticated access.`, "info"); }, [notify]);
  const selectEvent = useCallback((id: string) => { setActiveId(id); setEventMenu(false); try { localStorage.setItem("eventos.activeEvent", id); } catch {} }, []);

  if (!payload) return <div className="app-loading"><div className="loading-sidebar"><Brand /><div className="loading-nav"><i /><i /><i /><i /><i /></div></div><div className="loading-content"><div className="loading-topbar" /><div className="loading-center"><Brand /><h1>{loadError ? "Let's get you reconnected." : "Bringing your event into focus."}</h1><p>{loadError || "Good things happen when the whole team has a clear picture."}</p>{loadError ? <Button onClick={() => void refresh().catch(err => setLoadError(err.message))}>Try again<ArrowRight size={15} /></Button> : <Loader2 className="spin" size={23} />}</div></div></div>;
  const { data, meta } = payload;
  const event = data.events.find(e => e.id === activeId) || data.events[0];
  const currentPerson = data.people.find(p => p.id === ROLE_PERSON[role]);
  const activeNav = NAV.find(n => n.id === section)!;
  const eventTasks = data.tasks.filter(t => t.eventId === event.id);
  const scopedTasks = eventTasks.filter(t => role === "organizer" || role === "volunteer" && t.ownerId === ROLE_PERSON.volunteer || role === "coordinator" && t.team === currentPerson?.team);
  const searchResults = scopedTasks.filter(t => `${t.title} ${t.description} ${data.people.find(p => p.id === t.ownerId)?.name}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  const unread = data.activities[0]?.id !== lastReadId;
  const openTask = (task?: Task) => setEditor({ kind: "task", task });
  const openSession = (id?: string) => setEditor({ kind: "session", id });
  const openPerson = (id?: string) => setEditor({ kind: "person", id });
  const openResource = (id?: string) => setEditor({ kind: "resource", id });
  const openEvent = (create = false) => setEditor({ kind: "event", create });
  return <AppContext.Provider value={{ data, meta, event, role, section, setSection, setRole, selectEvent, request, refresh, notify, openTask, openSession, openPerson, openResource, openEvent, openGuide: () => setGuide(true) }}>
    <div className="app-shell">{sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}<aside className={`sidebar ${sidebarOpen ? "sidebar-is-open" : ""}`}><div className="sidebar-brand"><Brand /><IconButton label="Close navigation" className="mobile-sidebar-close" onClick={() => setSidebarOpen(false)}><X size={19} /></IconButton></div><div className="workspace-tag"><span className="small-dot lightgreen" />CAMPUS OPERATIONS</div><div className="event-picker"><button className="event-picker-button" aria-expanded={eventMenu} onClick={() => setEventMenu(!eventMenu)}><span className="event-picker-icon"><CalendarDays size={18} /></span><span><small>YOUR EVENT WORKSPACE</small><strong>{event.name.replace("2026", "'26")}</strong></span><ChevronDown size={15} /></button>{eventMenu && <div className="event-dropdown">{data.events.map(e => <button key={e.id} className={e.id === event.id ? "selected" : ""} onClick={() => { selectEvent(e.id); setSection("overview"); }}><CalendarDays size={15} /><span>{e.name}</span>{e.id === event.id && <Check size={13} />}</button>)}{role === "organizer" && <button className="new-event-option" onClick={() => { setEventMenu(false); openEvent(true); }}><Plus size={16} />Create a new event</button>}</div>}</div><nav aria-label="Main navigation"><p className="nav-eyebrow">OPERATIONS</p>{NAV.slice(0, 5).map(item => <button key={item.id} onClick={() => setSection(item.id)} className={`nav-link ${section === item.id ? "active" : ""}`} aria-current={section === item.id ? "page" : undefined}><item.icon size={18} /><span>{item.label}</span>{item.id === "tasks" && <span className="nav-count">{eventTasks.filter(t => t.status !== "Done").length}</span>}</button>)}<p className="nav-eyebrow intelligence-eyebrow">INTELLIGENCE</p><button onClick={() => setSection("impact")} className={`nav-link ${section === "impact" ? "active" : ""}`} aria-current={section === "impact" ? "page" : undefined}><GitBranch size={18} /><span>Impact analysis</span><span className="nav-smart" aria-hidden="true">↗</span></button><p className="nav-eyebrow workspace-eyebrow">WORKSPACE</p>{NAV.slice(6).map(item => <button key={item.id} onClick={() => setSection(item.id)} className={`nav-link ${section === item.id ? "active" : ""}`} aria-current={section === item.id ? "page" : undefined}><item.icon size={18} /><span>{item.label}</span>{item.id === "integrations" && !meta.notionConfigured && <span className="nav-status-dot" />}</button>)}</nav><div className="sidebar-bottom"><button className="sidebar-notion" onClick={() => setSection("integrations")}><div><NotionLogo size={22} /><ArrowUpRight size={15} /></div><strong>{meta.notionConfigured ? "A connected source of truth." : "Better together with Notion."}</strong><p>{meta.notionConfigured ? "Publish changes. Pull updates. Stay aligned." : "Bring your operational knowledge into one place."}</p><span>{meta.notionConfigured ? "Manage connection" : "Connect your workspace"}<ArrowRight size={13} /></span></button><button className="sidebar-help" onClick={() => setGuide(true)}><CircleHelp size={17} />A little help?<ArrowUpRight size={14} /></button><div className="sidebar-profile"><Avatar person={currentPerson} size="md" /><div><strong>{currentPerson?.name || "Demo organizer"}</strong><span>{ROLE_LABEL[role]} · role preview</span></div><span className="profile-status-dot" /></div></div></aside>
    <main className="main-shell"><header className="topbar"><div className="topbar-left"><IconButton label="Open navigation" className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></IconButton><span className="breadcrumb-event">Event workspace</span><ChevronRight size={14} className="muted" /><strong>{activeNav.label}</strong></div><div className="topbar-right"><span className={`save-status ${pollError ? "save-status-error" : ""}`}>{pollError ? <WifiOff size={13} /> : activeRequests ? <Loader2 size={13} className="spin" /> : <span className="small-dot green" />}{pollError ? "Connection interrupted" : activeRequests ? "Working…" : "Changes saved"}</span><div className="role-selector" title="Demo role preview. Not secure authorization."><Users size={14} /><select aria-label="View as role" value={role} onChange={e => setRole(e.target.value as Role)}><option value="organizer">Organizer view</option><option value="coordinator">Team lead view</option><option value="volunteer">Volunteer view</option></select></div><div className="topbar-divider" /><IconButton label="Search workspace (Ctrl+K)" onClick={() => { setSearch(""); setSearchOpen(true); }}><Search size={19} /></IconButton><IconButton label="View notifications" className="notification-button" onClick={() => setNotifications(true)}><Bell size={19} />{unread && <i />}</IconButton><button className="profile-button" aria-label="View your demo profile" onClick={() => openPerson(currentPerson?.id)}><Avatar person={currentPerson} size="sm" /></button></div></header>{pollError && <div className="connection-banner"><WifiOff size={15} /><span>Live updates are paused. The last loaded data is shown.</span><button onClick={() => void refresh().catch(() => notify("Still unable to reach the server.", "error"))}>Retry connection</button></div>}
      <div className="main-content" key={event.id}>{section === "overview" ? <Dashboard /> : section === "tasks" ? <TasksView /> : section === "schedule" ? <ScheduleView /> : section === "team" ? <TeamView /> : section === "resources" ? <ResourcesView /> : section === "impact" ? <ImpactView /> : section === "integrations" ? <IntegrationsView /> : <SettingsView />}<footer className="app-footer"><span><span className="footer-brand-dot" />Built for the moments that matter.</span><span>EventOS <span> / </span>Hackathon MVP</span></footer></div>
    </main></div>
    {editor?.kind === "task" && <TaskModal key={editor.task?.id || "new-task"} task={editor.task} onClose={() => setEditor(null)} />}
    {editor?.kind === "session" && <SessionModal key={editor.id || "new-session"} id={editor.id} onClose={() => setEditor(null)} />}
    {editor?.kind === "person" && <PersonModal key={editor.id || "new-person"} id={editor.id} onClose={() => setEditor(null)} />}
    {editor?.kind === "resource" && <ResourceModal key={editor.id || "new-resource"} id={editor.id} onClose={() => setEditor(null)} />}
    {editor?.kind === "event" && <EventModal key={editor.create ? "new-event" : event.id} create={editor.create} onClose={() => setEditor(null)} />}
    {searchOpen && <Modal title="Find your next step." eyebrow="WORKSPACE SEARCH" onClose={() => setSearchOpen(false)} className="search-modal"><div className="command-search"><Search size={21} /><input aria-label="Search workspace" autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks, owners, notes…" /><kbd>ESC</kbd></div><div className="search-result-label">TASKS IN YOUR ROLE SCOPE <span>{searchResults.length} results</span></div><div className="search-results">{searchResults.map(task => <button key={task.id} onClick={() => { setSearchOpen(false); openTask(task); }}><CheckCheck size={18} /><div><strong>{task.title}</strong><span>{task.team} · {data.people.find(p => p.id === task.ownerId)?.name || "Unassigned"}</span></div><StatusBadge status={task.status} /><ChevronRight size={16} /></button>)}{!searchResults.length && <EmptyState title="No matches just yet" description="Try another task, teammate or detail." />}</div><div className="command-search-footer"><span><Command size={12} />K to open search</span><span>Click a result to open its details ↵</span></div></Modal>}
    {notifications && <Modal title="Around your event." eyebrow="UPDATES & ESCALATIONS" onClose={() => setNotifications(false)} footer={<><span className="field-hint">In-app activity only. No external notifications are sent.</span><Button variant="secondary" onClick={() => { const id = data.activities[0]?.id || ""; setLastReadId(id); try { localStorage.setItem("eventos.lastRead", id); } catch {} setNotifications(false); notify("You're all caught up."); }}><CheckCheck size={15} />Mark as read</Button></>}><div className="notification-urgent"><h3><Flag size={16} />Needs your attention</h3>{scopedTasks.filter(t => t.risk || t.escalatedTo).slice(0, 5).map(task => <button key={task.id} onClick={() => { setNotifications(false); openTask(task); }}><div><strong>{task.title}</strong><span>{task.escalatedTo ? "Escalated to organizer" : "At risk"} · {data.people.find(p => p.id === task.ownerId)?.name}</span></div><ChevronRight size={16} /></button>)}</div><div className="notification-history"><h3>Recent activity</h3>{data.activities.slice(0, 8).map(item => <div key={item.id}><span className="small-dot green" /><div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.actor} · {timeAgo(item.timestamp)}</small></div></div>)}</div></Modal>}
    {guide && <Modal title="One change. One clean workflow." eyebrow="THE EVENTOS DEMO" wide onClose={() => setGuide(false)} footer={<><span className="field-hint">Use Settings → Reset demo to rehearse again.</span><Button onClick={() => { setGuide(false); setSection("impact"); }}>Start the venue-change demo<ArrowRight size={15} /></Button></>}><div className="guide-intro"><span><Workflow size={27} /></span><p>Show how a small operational change becomes a coordinated response—not another message lost in the group chat.</p></div><div className="guide-steps">{[{ title: "Start with the big picture", text: "Open the seeded KIIT event: 42 tasks, 5 sessions and 8 resources. All statistics come from the editable data." }, { title: "Move Main Auditorium to Seminar Hall B", text: "Analyze the proposed venue. On a fresh demo, the graph traces 5 tasks, 2 sessions, 4 resources and 3 owners. Nothing has changed yet." }, { title: "Turn the impact into clear next steps", text: "Review the rule-based brief, or generate an AI brief if configured. Apply the change and create 5 owner-assigned follow-up tasks." }, { title: "Close the loop in Notion", text: "Configure the real API connector and explicitly sync. Open Notion to show the updated venue, task records, resources and run of show. Edit a synced task there, then pull updates into EventOS." }].map((step, i) => <div key={step.title}><span>{String(i+1).padStart(2,"0")}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></div>)}</div><div className="notice notice-amber"><ShieldCheck size={17} /><div><strong>Be honest about what's live.</strong><p>Seeded data is illustrative. Role views aren't authentication. Rule-based output isn't AI. Without Notion credentials, local mode cannot demonstrate live sync.</p></div></div></Modal>}
    <div className="toast-container" aria-live="polite">{toasts.map(toast => <div className={`toast toast-${toast.tone}`} key={toast.id}>{toast.tone === "success" ? <CheckCircleIcon /> : toast.tone === "error" ? <WifiOff size={18} /> : <Sparkles size={18} />}<span>{toast.message}</span><IconButton label="Dismiss notification" onClick={() => setToasts(current => current.filter(t => t.id !== toast.id))}><X size={14} /></IconButton></div>)}</div>
  </AppContext.Provider>;
}
function CheckCircleIcon() { return <span className="toast-check"><Check size={12} /></span>; }
