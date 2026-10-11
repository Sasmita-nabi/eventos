# EventOS

**Every detail. One command center.** A focused, runnable student-event operations MVP based on the plan provided in this conversation—not an independently verified implementation of the KBC PDF.

The demo is a real editable workflow:

**Venue change → deterministic impact → review briefing → assigned follow-ups → explicit Notion API sync.**

## 1. Run locally

Requirements: Node.js **20.9+**, npm, a modern browser. No external credentials are required for local demo mode.

```bash
cd eventos
npm ci
npm run dev
```

Open **http://localhost:3000** on your own machine. The server binds to `0.0.0.0` for preview compatibility. Browser code uses relative `/api` URLs, never a sandbox-only localhost API.

Optional environment configuration:

```bash
cp .env.example .env.local
```

Windows PowerShell: `Copy-Item .env.example .env.local`. Restart the app after changing server environment variables.

### Included screens

- **Overview:** dynamic statistics, run of show, priorities, readiness and activity.
- **Tasks:** board/list views, search, filters, CSV export, native drag-and-drop status updates, editable prerequisites, status/notes, deletion and escalation.
- **Schedule:** day selection, timeline/compact views, session creation/editing and Markdown export. All times are IST.
- **Team:** workload, roles, availability and teammate creation/editing. No invitation emails are sent.
- **Resources:** equipment/spaces/supplies, quantities, locations, owners and dependency links.
- **Impact analysis:** safe previews, real directed graph, shortest impact paths, affected records, optional AI brief, draft communication, atomic apply and follow-ups.
- **Integrations:** Notion schema/access check, explicit push/pull and server-side setup guide.
- **Settings:** event details, storage status, role-preview disclosure, workspace export and guarded demo reset.

Other working interactions: event creation/selection, workspace search (`Ctrl/Cmd+K`), notifications/activity review, modal forms, source links for actually synchronized pages, local persistence and 15-second refreshes.

## 2. Run the venue-change demo

On a fresh seed:

1. Overview displays **42 tasks / 17 done / 5 at risk / 3 blocked**.
2. Open **Impact analysis**. Propose **Seminar Hall B** instead of **Main Auditorium**.
3. Click **Analyze impact**. The engine returns **5 tasks, 2 sessions, 4 resources, 3 owners and 1 communication node**. No operational records have changed yet.
4. Click a graph node to inspect its shortest dependency path.
5. Review the **rule-based** briefing, or generate an **AI-generated** briefing if a provider key is configured.
6. Keep **Create 5 follow-up tasks** checked, then click **Apply & assign**.
7. The event venue, linked session venues and linked resource locations update. Affected work is flagged for review. Five new tasks inherit the existing task owners/deadlines. The task count becomes **47**.
8. Refresh: all changes remain. Open the follow-up tasks to update them.
9. With Notion configured, explicitly **Sync to Notion**, then show the updated pages. Without credentials, the app honestly offers **Set up Notion**—it never invents a sync success.

To rehearse again: **Settings → Reset demo**, type `RESET`. This replaces all local operational data. Export a workspace backup first. Reset is disabled while Notion is configured.

The seeded KIIT event, teammates, emails and activities are illustrative. The dashboard's mini bar charts are derived from current task distribution by team, not fabricated historical trends. The seeded schedule uses a clearly labeled demo clock of **24 October 2026, 10:40 AM IST**. It is not a live campus event.

## 3. Connect real Notion read/write integration

Credentials were not supplied for this build. The connector is implemented and its protocol behaviors are tested with mocks; an actual workspace sync still needs your credentials and verification.

1. Visit [Notion integrations](https://www.notion.so/profile/integrations). Create an **internal integration** with read, insert and update capabilities.
2. Create a blank parent page named **EventOS Operations**. Share that page with the integration using Notion's Connections menu.
3. Put the secret and parent page ID in **`.env.local`**:

```env
NOTION_API_KEY=your_internal_integration_secret
NOTION_PARENT_PAGE_ID=your_shared_parent_page_id
```

4. Run the setup script **once**:

```bash
npm run notion:setup
```

It creates four new databases with the exact required schema and prints their data source IDs. Repeated setup creates additional databases; it does not guess which existing databases are safe to modify.

5. Copy the printed lines into `.env.local`:

```env
NOTION_EVENTS_DATA_SOURCE_ID=...
NOTION_TASKS_DATA_SOURCE_ID=...
NOTION_RESOURCES_DATA_SOURCE_ID=...
NOTION_PEOPLE_DATA_SOURCE_ID=...
```

Use **data source IDs**, not database/container IDs. The API version is pinned to **2025-09-03**. It uses `/data_sources/{id}/query`, page creation with `parent.data_source_id`, and page PATCH updates.

6. Restart. Open **Integrations → Check connection**. The check reads the data sources and validates required property names; it does not write records.
7. Explicitly **Sync local changes** and approve the write confirmation. The first seed sync is 59 records; after the relocation it is 64. Notion writes are paced and respect `Retry-After` on rate limits, so the first sync can take a minute or longer.
8. Inspect the real Notion records. Change a synchronized task in Notion, then use **Pull updates from Notion** to demonstrate the read path.

### Mapping

| Collection | Title | Main properties |
|---|---|---|
| Events | Event | Venue, Date, End date, Status, Attendees, Description, Run of show |
| Tasks | Task | Event ID, Owner, Owner ID, Deadline, Status, Priority, Team, At risk, Description, Dependencies, Tags, Escalated to |
| Resources | Resource | Event ID, Type, Location, Status, Quantity, Owner ID, Dependencies |
| People | Person | Role, Team, Availability, Email, Color |

Every record also has **External ID** and **Updated at**. The exact schemas live in `lib/notion.ts` and are created by `scripts/setup-notion.ts`.

Sessions travel in the Events database's **Run of show** rich-text JSON property. Prerequisite node IDs are stored in Tasks/Resources. This is intentionally a four-database MVP, not a relational enterprise Notion schema. If manually editing the schedule JSON in Notion, preserve its structure and IDs.

### Sync policy and limitations

- **No fake sync:** record state becomes synchronized only after the actual API call succeeds.
- Push creates or updates by **External ID** and stores Notion page IDs/URLs. Failed records stay available for retry. Retrying rebuilds the remote ID index to avoid creating duplicates after a previously completed request.
- Explicit push publishes pending local edits and may overwrite the same fields edited in Notion. This is a deliberate MVP conflict policy, not automatic conflict resolution.
- Pull imports app-managed records with External IDs. **Pending local edits are skipped**, not silently overwritten. Sync local work first if you intend to pull newer remote edits afterwards.
- Deleted app tasks become tombstones; their known Notion pages are archived on the next push. Remote deletions do not automatically remove local records.
- Notion push is **not atomic across databases**. Partial results and errors are reported; local data remains intact.
- The source of truth is the synchronized Notion knowledge layer; local state is an editable cache/change queue. In local demo mode there is no external source of truth.
- There are no Notion webhooks, OAuth, background sync workers or bidirectional merge resolution in this MVP.

Never put secrets in `NEXT_PUBLIC_` variables, browser forms, screenshots or Git. `.env.local` is ignored. The downloaded source does not include credentials.

## 4. Optional AI briefing

The dependency engine never uses AI to decide what is affected.

Choose one server-side provider:

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

or:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```

Gemini takes precedence when both keys are set. Model availability depends on your account; names are configurable. Restart after adding keys. Generate a brief from an unapplied, current impact preview.

The prompt supplies structured counts, affected task names, owners, statuses, deadlines and session start times. Enabling AI sends those facts to your chosen provider. Do not use private operational data without permission.

- No key: **rule-based summary, explicitly not AI-generated**.
- Valid key: JSON-validated briefing labeled **AI-generated advice; review required**.
- Provider error/timeout/invalid output: a visible warning and honest rule-based fallback.
- Draft participant communications are not sent anywhere.

## 5. Persistence and deployment

### Local development

The default store is **`data/state.json`**, initialized from `lib/seed.ts`. Local writes are serialized and saved by atomic file rename. `EVENTOS_DATA_FILE` can override the path. Refreshes and server restarts retain the file.

This is suitable for a single local demo server. It is **not** appropriate for a read-only/ephemeral serverless filesystem or multi-process shared-file deployment.

### Supabase / Vercel

1. Create a Supabase project.
2. Run **`docs/supabase.sql`** in the SQL editor.
3. Add both variables to your server environment:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
```

4. The app initializes one `eventos_state` row on its first request. It stores the entity collections inside a JSONB state document and uses a revision compare-and-swap for concurrent writes. It is not an unused SQL schema: `lib/store.ts` actually reads/writes this row through the Supabase REST API.
5. Deploy the `eventos/` project to Vercel with these variables, plus Notion/AI configuration if desired.
6. Check persistence after restart/redeploy. Use demonstration data only until proper authentication and authorization are added.

The single JSONB document favors overnight feasibility over scale. For production, use normalized tables, authenticated permissions, proper jobs and richer conflict handling. Serverless execution durations depend on your hosting plan; initial Notion sync may exceed short function time limits. The route declares a 300-second maximum, but your platform must permit it. If it does not, run the demo on a persistent Node server or add a sync queue.

## 6. Roles and security

This is an **unauthenticated hackathon MVP**, not a production-secured SaaS.

| Role preview | Persona | Task view/actions |
|---|---|---|
| Organizer | Aditi Rao | All event tasks; manage data, apply venue changes, synchronize |
| Team lead | Arjun Mehta | Technical-team tasks; manage that team's work; preview impacts |
| Volunteer | Priya Nair | Assigned tasks only; update status/notes; escalate; own availability |

The UI simulates scopes; API mutations check the `x-eventos-role` header. **That header is user-controlled and is not secure authorization.** Read APIs return the demo workspace. The fixed demo personas are not linked to authentication or to arbitrary newly added teammates. Do not expose actual private student data with this setup.

Add identity-backed permissions, validation hardening, rate limits and audit controls before a production use case.

## 7. Tests and build

```bash
npm run typecheck
npm test
npm run build
```

Browser tests:

```bash
npx playwright install chromium
# Linux environments may also need: npx playwright install-deps chromium
npm run test:e2e
```

**Warning:** Browser tests reset local demo data before each scenario. Run them only against a disposable, unconfigured demo workspace. They refuse to reset a Notion-configured workspace.

Tests cover graph traversal, cycle protection, exact seeded counts, read-only previews, stale changes, idempotent application, owner-assigned follow-ups, API CRUD, role-preview write limits, escalation, persistence, Notion protocol/pagination/rate limits/property mapping and desktop/mobile browser flows. Mock protocol tests are not a claim that your real Notion/Supabase/AI accounts were tested.

Production Node process:

```bash
npm run build
npm start
```

## 8. Project structure

```text
eventos/
├── app/                 Next.js layout, app page, styling, API catch-all
├── components/          Dashboard, task board, operations views, impact, settings
├── lib/
│   ├── types.ts         Explicit event/people/task/resource/session models
│   ├── seed.ts          Illustrative KIIT workspace
│   ├── dependency.ts    Directed graph and BFS shortest impact paths
│   ├── operations.ts    Atomic venue update and assigned follow-ups
│   ├── store.ts         Local file / Supabase adapter
│   ├── notion.ts        Real Notion API requests, mapping, push/pull
│   ├── ai.ts            Rule-based brief and optional provider adapters
│   └── api.ts           Validation and mutation orchestration
├── scripts/             One-time Notion database provisioning
├── tests/               Unit/API/protocol and browser tests
├── docs/                SQL, API reference, architecture, demo script
└── .env.example         Server-only configuration template
```

Technical notes: Next.js, React, TypeScript, locally served DM Sans/Manrope, Lucide icons and custom CSS. No external CDN assets or graph-library dependency. The frontend is componentized; Tailwind/shadcn were not necessary for this implementation.

Architecture: **UI → Next.js API → persisted state + deterministic dependency engine → optional AI advice / real Notion read-write connector**. See `docs/architecture.svg`, `docs/API.md` and `docs/DEMO.md`.

## 9. Troubleshooting

- **Missing credentials:** local mode works; sync remains disabled. Fill all five required Notion environment variables and restart.
- **Notion 401:** inspect the secret. **403/404:** share the parent/databases with the integration and verify data source IDs.
- **Notion validation errors:** the database property names/types must match `NOTION_SCHEMAS`. The provisioning script avoids manual schema mistakes.
- **Pull skips my task:** it has pending local edits. Resolve which version you want before pushing or pulling; this MVP does not merge them.
- **Preview says stale:** another write changed the state revision. Analyze again; the app intentionally prevents overwriting newer work.
- **Cannot delete a task:** another task depends on it. Unlink that prerequisite first.
- **Sync says working after server interruption:** a persisted lease protects against overlapping jobs. It expires after five minutes; once it expires, the UI enables retry. Confirmed records remain synchronized and only remaining edits are retried. Requests have a four-minute operation budget to leave time for cleanup.
- **Supabase errors:** run the SQL, check both server-only variables, table permissions and URL.
- **AI returns a warning:** check model availability/key/quota. The deterministic graph and rule-based brief still work.

No authentication, real-time sockets, messages, registrations, volunteer optimization, RAG, simulation of complex event schedules, or full post-event knowledge platform are claimed. The focus is one complete operational-change workflow.
