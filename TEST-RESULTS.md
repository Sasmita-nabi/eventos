# EventOS validation

Tested for this handoff on 3 October 2026.

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm test` | **36/36 passed** |
| `npm run build` | Passed; no final build warnings |
| `npm run test:e2e` against production server | **8/8 passed** |
| Desktop rendering | Checked at 1440px viewport |
| Mobile rendering | Checked at 390px viewport; no page-wide horizontal overflow |
| Browser runtime errors across all eight main screens | None in the automated navigation test |

## Confirmed behavior

- Real seeded statistics: 42 tasks / 17 done / 5 at risk / 3 blocked.
- Read-only venue preview: 5 tasks / 2 sessions / 4 resources / 3 owners / 1 communication.
- Directed graph with deduplication, shortest paths, dangling-reference tolerance and cycle handling.
- Applying the venue change creates 5 owner-assigned follow-ups and updates linked records.
- Refresh persistence, task creation/status changes, CSV export, search, clean new-event empty states.
- Session/resource/teammate creation from browser forms.
- Volunteer task scope, restricted form controls and persisted escalation.
- Missing Notion credentials leave sync disabled and visibly local.
- Mocked full Notion workflow creates 59 records; relocation updates 10 existing records and creates 5; pull imports remote edits while preserving pending local work.
- Notion protocol headers, pagination, rate-limit retry, error propagation, rich-text splitting and property mapping.
- Sync job lease protection and recovery after an expired lease.
- Honest rule-based briefing when AI is unconfigured.

## Not claimed

No actual Notion, Supabase or AI credentials were provided. A real account-to-account live integration was **not** verified in this environment. Add your server-only credentials and run the documented connection/read/write checks. Mock tests are not a substitute for that live demonstration.

Role previews are not identity-backed authentication or production authorization. Browser tests use and reset illustrative data only.
