import type { StoreData, Task, Person, Session, Resource, Entity } from "./types";

export const DEMO_EVENT_ID = "event-kiit-2026";
export const DEMO_DATE = "2026-10-24";
const base = (id: string): Entity => ({ id, updatedAt: new Date().toISOString(), syncState: "local" });
const at = (time: string) => `${DEMO_DATE}T${time}:00+05:30`;

export function createSeed(): StoreData {
  const people: Person[] = [
    { ...base("person-01"), name: "Aditi Rao", email: "aditi@example.com", role: "Event organizer", team: "Operations", availability: "Available", color: "sage" },
    { ...base("person-02"), name: "Arjun Mehta", email: "arjun@example.com", role: "Technical lead", team: "Technical", availability: "On duty", color: "blue" },
    { ...base("person-03"), name: "Priya Nair", email: "priya@example.com", role: "Volunteer", team: "Operations", availability: "On duty", color: "rose" },
    { ...base("person-04"), name: "Riya Sen", email: "riya@example.com", role: "Communications lead", team: "Communications", availability: "Available", color: "amber" },
    { ...base("person-05"), name: "Dev Patel", email: "dev@example.com", role: "AV volunteer", team: "Technical", availability: "Available", color: "purple" },
    { ...base("person-06"), name: "Ishaan Das", email: "ishaan@example.com", role: "Hospitality lead", team: "Hospitality", availability: "On duty", color: "peach" },
    { ...base("person-07"), name: "Sneha Roy", email: "sneha@example.com", role: "Design lead", team: "Design", availability: "Available", color: "teal" },
    { ...base("person-08"), name: "Kabir Sethi", email: "kabir@example.com", role: "Logistics volunteer", team: "Operations", availability: "Unavailable", color: "slate" },
  ];
  const sessions: Session[] = [
    { ...base("session-registration"), eventId: DEMO_EVENT_ID, title: "Registration & check-in", start: at("09:00"), end: at("10:45"), venue: "Convention Centre · Foyer", ownerId: "person-03", description: "Participant check-in, welcome kits and team allocation.", dependencies: [] },
    { ...base("session-opening"), eventId: DEMO_EVENT_ID, title: "Opening ceremony", start: at("11:00"), end: at("11:30"), venue: "Main Auditorium", ownerId: "person-02", description: "Welcome address, challenge reveal and sponsor introductions.", dependencies: [`venue:${DEMO_EVENT_ID}`] },
    { ...base("session-hacking"), eventId: DEMO_EVENT_ID, title: "Let the hacking begin", start: at("12:00"), end: at("17:45"), venue: "Computer Lab 4", ownerId: "person-05", description: "Build sprint with mentor support and technical office hours.", dependencies: [] },
    { ...base("session-judging"), eventId: DEMO_EVENT_ID, title: "Project demos & judging", start: at("18:00"), end: at("19:30"), venue: "Main Auditorium", ownerId: "person-03", description: "Teams present their prototypes to the judging panel.", dependencies: [`venue:${DEMO_EVENT_ID}`] },
    { ...base("session-closing"), eventId: DEMO_EVENT_ID, title: "Closing & awards", start: at("20:00"), end: at("20:30"), venue: "Campus Amphitheatre", ownerId: "person-01", description: "Results, recognition and a photo to remember.", dependencies: [] },
  ];
  const resources: Resource[] = [
    { ...base("resource-projector"), eventId: DEMO_EVENT_ID, name: "HD projectors", type: "Equipment", location: "Main Auditorium", status: "Needs attention", quantity: 2, ownerId: "person-02", dependencies: ["session:session-opening"] },
    { ...base("resource-mics"), eventId: DEMO_EVENT_ID, name: "Wireless microphones", type: "Equipment", location: "Main Auditorium", status: "Reserved", quantity: 4, ownerId: "person-02", dependencies: ["session:session-opening"] },
    { ...base("resource-stage"), eventId: DEMO_EVENT_ID, name: "Stage & signage kit", type: "Supplies", location: "Main Auditorium", status: "Ready", quantity: 1, ownerId: "person-03", dependencies: ["session:session-opening"] },
    { ...base("resource-tables"), eventId: DEMO_EVENT_ID, name: "Judging tables", type: "Furniture", location: "Main Auditorium", status: "Reserved", quantity: 8, ownerId: "person-03", dependencies: ["session:session-judging"] },
    { ...base("resource-router"), eventId: DEMO_EVENT_ID, name: "Wi-Fi access points", type: "Equipment", location: "Computer Lab 4", status: "Needs attention", quantity: 6, ownerId: "person-05", dependencies: ["session:session-hacking"] },
    { ...base("resource-kits"), eventId: DEMO_EVENT_ID, name: "Participant welcome kits", type: "Supplies", location: "Convention Centre · Foyer", status: "Ready", quantity: 240, ownerId: "person-06", dependencies: ["session:session-registration"] },
    { ...base("resource-lab"), eventId: DEMO_EVENT_ID, name: "Computer Lab 4", type: "Space", location: "School of Computer Engineering", status: "Ready", quantity: 1, ownerId: "person-05", dependencies: [] },
    { ...base("resource-badges"), eventId: DEMO_EVENT_ID, name: "Team & crew badges", type: "Supplies", location: "Registration desk", status: "Ready", quantity: 280, ownerId: "person-07", dependencies: [] },
  ];
  const titles = [
    "Projector & AV setup", "Opening ceremony stage check", "Volunteer orientation", "Participant venue announcement", "Prepare the judging room",
    "Set up the registration desk", "Coordinate mentor arrivals", "Confirm Wi-Fi coverage", "Print the event signage", "Prepare welcome kits", "Finalize the opening deck", "Brief the registration team", "Confirm judge travel", "Install demo stations", "Check power extensions", "Assign help desk shifts", "Publish the challenge brief", "Prepare judge scorecards", "Confirm catering headcount", "Run the livestream test", "Collect sponsor assets", "Schedule social updates", "Set up the first-aid desk", "Prepare award certificates", "Verify emergency contacts",
    "Book event spaces", "Confirm the event date", "Create the event page", "Publish registrations", "Invite the judging panel", "Confirm sponsor commitments", "Recruit event volunteers", "Collect team registrations", "Order participant badges", "Design the event identity", "Prepare the budget", "Share the organizer handbook", "Create team channels", "Review the run of show", "Book campus transport", "Order welcome kit supplies", "Approve the safety plan",
  ];
  const specialIds = ["task-projector", "task-opening", "task-volunteers", "task-announcement", "task-judging"];
  const owners = ["person-02", "person-02", "person-03", "person-04", "person-03"];
  const deps = [["resource:resource-projector"], ["resource:resource-mics"], ["resource:resource-stage"], ["task:task-projector", "task:task-opening"], ["resource:resource-tables"]];
  const blocked = new Set([0, 7, 12]);
  const progressing = new Set([1, 5, 6, 8, 9, 10, 11, 13]);
  const risk = new Set([0, 1, 7, 12, 18]);
  const times = ["10:30", "10:45", "10:00", "10:15", "17:30", "08:45", "11:30", "11:00", "10:30", "08:30", "10:45", "08:30", "16:30", "17:00", "11:30", "09:00", "11:45", "17:30", "12:30", "10:45", "11:00", "12:00", "08:45", "19:00", "08:00"];
  const tasks: Task[] = titles.map((title, i) => {
    const ownerId = i < 5 ? owners[i] : people[(i + 2) % people.length].id;
    const owner = people.find(p => p.id === ownerId)!;
    return {
      ...base(specialIds[i] ?? `task-${String(i + 1).padStart(2, "0")}`), eventId: DEMO_EVENT_ID, title,
      description: i === 0 ? "Install both projectors, check HDMI inputs and complete the AV soundcheck. Waiting on a replacement adapter." : i === 3 ? "Update the participant email and campus signage after the technical team confirms the final venue." : `Coordinate with ${owner.team.toLowerCase()} and confirm completion with the event organizer.`,
      ownerId, status: i >= 25 ? "Done" : blocked.has(i) ? "Blocked" : progressing.has(i) ? "In progress" : "To do",
      priority: risk.has(i) ? "High" : i % 3 === 0 ? "High" : i % 3 === 1 ? "Medium" : "Low",
      deadline: i >= 25 ? "2026-10-23T18:00:00+05:30" : at(times[i]), team: owner.team, risk: risk.has(i), dependencies: deps[i] ?? [],
      tags: [i >= 25 ? "Pre-event" : "Event day"],
    };
  });
  const now = Date.now();
  return {
    revision: 0,
    events: [{ ...base(DEMO_EVENT_ID), name: "KIIT Hackathon 2026", date: DEMO_DATE, endDate: "2026-10-25", venue: "Main Auditorium", status: "Planning", attendees: 240, description: "24 hours. Bold ideas. One campus. An interdisciplinary build sprint at KIIT, Bhubaneswar." }],
    people, sessions, resources, tasks,
    activities: [
      { id: "activity-1", title: "Projector setup needs attention", detail: "Arjun flagged a missing HDMI adapter.", type: "escalation", timestamp: new Date(now - 8 * 60000).toISOString(), actor: "Arjun Mehta" },
      { id: "activity-2", title: "Registration is ready to go", detail: "Priya confirmed the check-in team and desk layout.", type: "task", timestamp: new Date(now - 22 * 60000).toISOString(), actor: "Priya Nair" },
      { id: "activity-3", title: "The team is coming together", detail: "8 teammates assigned across 5 teams.", type: "team", timestamp: new Date(now - 46 * 60000).toISOString(), actor: "Aditi Rao" },
      { id: "activity-4", title: "Your command center is ready", detail: "42 demo tasks, 5 sessions and 8 resources loaded locally.", type: "event", timestamp: new Date(now - 90 * 60000).toISOString(), actor: "EventOS" },
    ],
    changes: [], tombstones: [], sync: { status: "idle" },
  };
}
