# EventOS — three-minute demo

## Before presenting

- Use only the illustrative seed, not real private student data.
- Run `npm run typecheck`, `npm test`, and a production build.
- Rehearse the venue-change workflow once.
- If demonstrating real Notion, provision/connect the four data sources and complete a baseline sync before the presentation.
- On a fresh demo: 42 tasks, 17 completed, 5 at risk, 3 blocked.
- Optional AI can fail independently. A functioning graph is more important than a model response.
- Export a workspace snapshot and capture your own screenshots as backup.
- Don't reset a live Notion-connected workspace. Seed a separate disposable demo environment if you need a clean second rehearsal.

## 0:00–0:30 — The problem

> Student events run across chats, spreadsheets and disconnected task lists. When a venue changes, the technical team, volunteers and participants may all need to react—but nobody sees the whole impact.

## 0:30–1:00 — A shared operational picture

Show Overview, a task, the run of show and resource ownership.

> EventOS connects the plan: tasks, sessions, resources and people. These statistics are computed from editable records, not fixed dashboard numbers. Roles give each teammate a focused command-center view.

Be explicit that roles are previews, not authenticated security.

## 1:00–1:45 — One change, a traceable impact

Open Impact analysis. Move Main Auditorium to Seminar Hall B. Click Analyze impact.

> This preview doesn't change the plan. Our dependency graph follows the venue through sessions and resources to affected tasks and owners. In this seeded scenario, that's five tasks, two sessions, four resources and three owners. Click any item to see why it is affected.

Click Projector & AV setup in the graph to show the shortest impact path.

## 1:45–2:15 — Turn insight into ownership

Show the operational brief, clear labels and draft communication.

> Impact is computed by deterministic code. The briefing is separately labeled—rule-based by default, or AI-generated advice when a provider is connected. Humans review it before acting.

Click Apply & assign with follow-ups checked.

> The venue and affected locations update together. Five follow-up tasks inherit the original owners and deadlines. Our event now has forty-seven tasks, and the next steps aren't lost in a group chat.

Open one follow-up to prove its assignment.

## 2:15–2:45 — Close the loop in Notion

If configured, explicitly sync and open the real Notion records.

> Notion isn't an embedded template or link. EventOS creates and updates operational records through the API and can pull source edits back into the command center. Sync failures are visible and never reported as success.

To prove read path, edit a task that has no pending app changes directly in Notion, then pull updates.

If not configured, say honestly:

> This environment is local demo mode. The real connector and provisioning script are included, but a live workspace demonstration needs credentials. We are not claiming that these local changes were synced.

## 2:45–3:00 — Architecture and feasibility

Show `architecture.svg`.

> A Next.js UI and API coordinate persisted state, a dependency graph, optional AI advice and a real Notion connector. We focused on one complete operational-change workflow. Authentication, background sync jobs and richer conflict resolution are the next production steps.

## Definition of done

- [ ] Records are created/edited from the UI, not manually patched in a database.
- [ ] Dependency results are traceable, deterministic and deduplicated.
- [ ] Preview changes nothing; apply persists the coordinated update.
- [ ] Follow-ups have actual owners and task records.
- [ ] A refresh preserves changes.
- [ ] Rules and AI are labeled separately from source facts.
- [ ] Real Notion write and read are demonstrated if credentials are available.
- [ ] Failed/missing external services do not invent success.
- [ ] Roles are described as a demo scope, not real access control.

This demo follows the user's supplied challenge summary. Consult the actual competition PDF before making formal compliance claims.
