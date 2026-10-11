"use client";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCheck, CheckCircle2, ChevronRight, CircleAlert, Clock3, Flag, GitBranch, MapPin, MoreHorizontal, Plus, Radio, Sparkles, Target, Users, Workflow } from "lucide-react";
import { DEMO_EVENT_ID } from "@/lib/seed";
import { TEAMS, type Task } from "@/lib/types";
import { analyzeVenueChange } from "@/lib/dependency";
import { useApp } from "./context";
import { Avatar, AvatarStack, Badge, Button, CardHeader, EmptyState, formatDay, formatTime, Priority, SectionHeader, StatusBadge, TextLink, timeAgo } from "./ui";

function TeamDistribution({ color, metric, tasks }: { color: string; metric: number; tasks: Task[] }) {
  const values = TEAMS.map(team => tasks.filter(t => t.team === team && (metric === 0 || metric === 1 && t.status === "Done" || metric === 2 && t.risk && t.status !== "Done" || metric === 3 && t.status === "Blocked")).length);
  const maximum = Math.max(1, ...values);
  const description = `Current distribution by team: ${TEAMS.map((team, i) => `${team} ${values[i]}`).join(", ")}`;
  return <div className="stat-mini-bars" role="img" aria-label={description} title={description}>{values.map((value, i) => <i key={TEAMS[i]} style={{ height: `${value ? 6 + value / maximum * 26 : 3}px`, background: value ? color : "#e6eadf", opacity: .55 }} />)}</div>;
}
export default function Dashboard() {
  const { data, event, role, meta, setSection, openTask, openSession } = useApp();
  const tasks = data.tasks.filter(t => t.eventId === event.id);
  const done = tasks.filter(t => t.status === "Done").length;
  const atRisk = tasks.filter(t => t.risk && t.status !== "Done").length;
  const blocked = tasks.filter(t => t.status === "Blocked").length;
  const progress = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const sessions = data.sessions.filter(s => s.eventId === event.id).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const priorityTasks = tasks.filter(t => t.status !== "Done" && (t.risk || t.status === "Blocked")).slice(0, 4);
  const currentTasks = tasks.filter(t => t.status === "In progress").length;
  const eventPeople = data.people.filter(p => tasks.some(t => t.ownerId === p.id));
  const isDemo = event.id === DEMO_EVENT_ID;
  const timelineNow = isDemo ? Date.parse(`${event.date}T10:40:00+05:30`) : Date.now();
  const impact = analyzeVenueChange(data, event.id, event.venue === "Seminar Hall B" ? "Main Auditorium" : "Seminar Hall B");
  const stats = [
    { label: "Total tasks", value: tasks.length, note: "Every detail accounted for", icon: CheckCheck, tone: "sage", color: "#527363" },
    { label: "Completed", value: done, note: `${progress}% of the way there`, icon: CheckCircle2, tone: "green", color: "#678c50" },
    { label: "At risk", value: atRisk, note: "A little attention needed", icon: Flag, tone: "amber", color: "#bf9352" },
    { label: "Blocked", value: blocked, note: "Let's clear the path", icon: CircleAlert, tone: "red", color: "#bf746c" },
  ];
  return <div className="view-enter dashboard-view">
    <SectionHeader eyebrow="THE BIG PICTURE" title="Your event, in sync." description="Less chasing updates. More making things happen.">
      <div className="date-chip"><CalendarDays size={15} />{formatDay(event.date)}{event.endDate !== event.date && ` – ${formatDay(event.endDate, true)}`}</div>
      {role !== "volunteer" && <Button onClick={() => openTask()}><Plus size={16} />New task</Button>}
    </SectionHeader>
    <div className="event-hero">
      <div className="event-hero-copy"><div className="hero-tags"><Badge tone="hero">CAMPUS EVENT</Badge><span className="hero-status"><i />{event.status}</span></div><h2>{event.name}</h2><div className="event-meta"><span><MapPin size={14} />{event.venue}</span><span className="meta-divider" /><span><Users size={14} />{event.attendees} participants</span><span className="meta-divider" /><span><AvatarStack people={eventPeople} max={3} />{eventPeople.length} teammates</span></div></div>
      <div className="event-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-spark spark-one">✳</div><div className="art-spark spark-two">+</div><div className="art-ticket"><span>GOOD IDEAS START HERE</span><strong>HACK.<br />BUILD.<br /><em>REPEAT.</em></strong><div className="ticket-code"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div><span className="art-tag">LET'S MAKE IT HAPPEN ↗</span></div>
    </div>
    <div className="stats-grid">{stats.map((stat, i) => <div className="stat-card" key={stat.label}><div className="stat-top"><span>{stat.label}</span><span className={`stat-icon stat-icon-${stat.tone}`}><stat.icon size={17} /></span></div><div className="stat-value-row"><strong>{stat.value}</strong><TeamDistribution color={stat.color} metric={i} tasks={tasks} /></div><p>{stat.note}</p></div>)}</div>
    <div className="impact-banner"><span className="impact-banner-icon"><GitBranch size={24} /></span><div className="impact-banner-copy"><div className="banner-eyebrow">CONNECTED OPERATIONS <span className="new-tag">SMART BY DESIGN</span></div><h3>One change. See the whole ripple.</h3><p>{impact.counts.tasks ? `${impact.counts.tasks} tasks are connected to your venue. Preview the impact before you move.` : "Connect prerequisites to see how a change moves through your event."}</p></div><Button variant="secondary" onClick={() => setSection("impact")}>Analyze a change<ArrowUpRight size={16} /></Button></div>
    <div className="dashboard-grid">
      <div className="dashboard-main-column">
        <section className="card schedule-card"><CardHeader title="On the agenda" caption="The moments that make your event." action={<TextLink onClick={() => setSection("schedule")}>View schedule</TextLink>} /><div className="agenda-date"><CalendarDays size={14} /><strong>{formatDay(event.date, true)}</strong>{isDemo && <span className="demo-timeline"><span />Demo timeline · 10:40 IST</span>}</div><div className="agenda-list">{sessions.length ? sessions.map((session, i) => {
          const active = timelineNow >= Date.parse(session.start) && timelineNow < Date.parse(session.end);
          const completed = timelineNow >= Date.parse(session.end);
          return <button key={session.id} className={`agenda-row ${active ? "agenda-active" : ""}`} onClick={() => openSession(session.id)}><div className="agenda-time">{formatTime(session.start)}<span>{formatTime(session.end)}</span></div><div className="agenda-track"><span className={`agenda-dot ${active ? "active" : completed ? "completed" : ""}`}>{completed ? <Check size={10} /> : null}</span>{i < sessions.length - 1 && <i />}</div><div className="agenda-info"><strong>{session.title}{active && <Badge tone="green">{isDemo ? "Demo now" : "Now"}</Badge>}</strong><span><MapPin size={12} />{session.venue}</span></div><Avatar person={data.people.find(p => p.id === session.ownerId)} size="sm" /><ChevronRight size={16} className="muted" /></button>;
        }) : <EmptyState title="A blank canvas" description="Add your first session to build the run of show." action={<Button variant="secondary" onClick={() => openSession()}>Add a session</Button>} />}</div></section>
        <section className="card attention-card"><CardHeader title="A little attention, please" caption="The priorities worth your team's time." action={<TextLink onClick={() => setSection("tasks")}>All tasks</TextLink>} />{priorityTasks.length ? <div className="attention-table"><div className="attention-table-head"><span>TASK</span><span>OWNER</span><span>STATUS</span><span /></div>{priorityTasks.map(task => <button className="attention-row" key={task.id} onClick={() => openTask(task)}><div className="attention-task"><span className={`task-check ${task.status === "Blocked" ? "task-check-blocked" : ""}`}>{task.status === "Blocked" && <span />}</span><div><strong>{task.title}</strong><span><Priority value={task.priority} /><span className="muted">{formatTime(task.deadline)}</span></span></div></div><Avatar person={data.people.find(p => p.id === task.ownerId)} size="sm" /><StatusBadge status={task.status} /><ChevronRight size={15} className="muted" /></button>)}</div> : <EmptyState title="Looking good" description="No at-risk or blocked tasks. Keep the momentum going." />}</section>
      </div>
      <div className="dashboard-side-column">
        <section className="readiness-card"><div className="readiness-title"><span><Target size={17} />Event readiness</span><span className="tiny-pill">IN MOTION</span></div><div className="readiness-body"><div className="readiness-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="#ffffff20" strokeWidth="6" /><circle cx="50" cy="50" r="42" fill="none" stroke="#d7edab" strokeWidth="6" strokeDasharray={`${progress * 2.639} 264`} strokeLinecap="round" transform="rotate(-90 50 50)" /></svg><span><strong>{progress}<small>%</small></strong><em>complete</em></span></div><div className="readiness-copy"><h3>{progress === 100 ? "Ready, set, go." : progress >= 50 ? "Coming together." : "Building momentum."}</h3><p>{done} of {tasks.length} tasks complete.<br />Every checkmark counts.</p></div></div><div className="readiness-bottom"><div><span className="small-dot lightgreen" />{currentTasks} in progress</div><button onClick={() => setSection("tasks")}>Keep it moving<ArrowRight size={14} /></button></div></section>
        <section className="card mini-dependency-card"><CardHeader title="Connected by design" action={<GitBranch size={16} className="muted" />} /><div className="mini-graph"><div className="mini-root"><MapPin size={13} />{event.venue}</div><div className="mini-graph-lines"><span /><span /></div><div className="mini-graph-leaves"><div><CalendarDays size={13} />{impact.counts.sessions} sessions</div><div><CheckCheck size={13} />{impact.counts.tasks} tasks</div></div></div><div className="mini-graph-footer"><span>{impact.counts.resources} resources · {impact.counts.people} people</span><TextLink onClick={() => setSection("impact")}>Explore</TextLink></div></section>
        <section className="card activity-card"><CardHeader title="Around the event" action={<span className="live-label"><span />Updates</span>} /><div className="activity-list">{data.activities.slice(0, 4).map(item => <div className="activity-item" key={item.id}><span className={`activity-icon activity-icon-${item.type}`}>{item.type === "task" ? <Check size={13} /> : item.type === "escalation" ? <Flag size={13} /> : item.type === "team" ? <Users size={13} /> : item.type === "change" ? <GitBranch size={13} /> : <Activity size={13} />}</span><div><strong>{item.title}</strong><p>{item.detail}</p><span>{timeAgo(item.timestamp)}</span></div></div>)}</div><div className="activity-footnote"><Radio size={12} />Refreshes every 15 seconds</div></section>
      </div>
    </div>
    <div className="dashboard-bottom-note"><span><span className="small-dot green" />{meta.notionConfigured ? "Notion connector configured · sync is explicit" : "Local demo workspace · your changes are saved"}</span><span>Small details. Exceptional events.</span></div>
  </div>;
}
