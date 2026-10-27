# RTFH Grants Workspace

A locally runnable internal grant lifecycle dashboard built with Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui-style Radix components, Drizzle ORM, and persistent SQLite. No paid APIs, external AI, browser localStorage, or live ZoomGrants/Dropbox integration is required.

## Run locally

Use **Node.js 24 LTS** and npm. From this repository in PowerShell:

```powershell
npm ci
Copy-Item .env.example .env
npm run db:setup
npm run dev
```

Open **http://localhost:3000**. The server binds to loopback. `APP_ORIGIN` must match the URL you use, including port; use localhost, not 127.0.0.1, with the default configuration.

Setup is idempotent and never resets existing data. SQLite lives in `data/grants.sqlite`; files live in `data/uploads`, outside the public directory. Both are ignored by Git. Restarting the app preserves grants, comments, documents, mappings, stage history, and audit logs. Use a local, nonsynced filesystem for operational SQLite data; this checkout's OneDrive directory is suitable for source, not a shared production database.

The seeded users, eight demo grants, organizations, amounts, IDs, and deadlines are **fictional**. Demo deadlines are relative to the initial setup date in Pacific Time. The database is already initialized if setup has previously run. On a new database, `npm run db:setup -- --no-demo` installs templates and development accounts without demo grants.

Development identity is Alex Morgan (Admin). To exercise roles locally, change `DEV_USER_ID` in `.env` to `jordan` (Manager), `casey` (Manager), or `sam` (Staff), and restart. Browser clients cannot select their own identity or role.

## Implemented scope

- Overview metrics; searchable, filterable, sortable tracker; stage Kanban; My Tasks, Needs Attention, upcoming deadlines, and external decision views; CSV export.
- Quick add with name, template, internal manager, and starting stage; optional grant metadata; full grant detail editing for managers.
- Four seeded workflows, role-based coordinator defaults, independent decision-maker fields, editable planning dates, conditional appeals, selected/not-selected branches, grant/cycle holds, and automatic next-stage handoffs.
- Stage ownership, blocking/unblocking, dated per-stage comment threads, private uploads and HTTPS document links, preserved history, and transactional audit records.
- PDF/DOCX extraction of explicitly labeled values; CSV/XLSX row imports; editable review before creation; saved column mappings; exact duplicate-ID detection; skip/update modes; per-row imported/updated/skipped/error results. Imported source files attach to each successful grant.
- Admin template creation/editing/reordering, separate recurring reporting tasks, parent-cycle summaries, and a fail-closed production authentication adapter.

No record is created by uploading a file alone. Review and confirm it first. Uploads never leave this server for AI processing. Stage deadlines never automatically advance a lifecycle.

## Import guide

Try `samples/grants.csv` using **New grant → Import a spreadsheet**. PDF and DOCX extraction recognizes case-insensitive `Label: value` lines such as:

```text
Grant name: Fictional community project
Funding program: HHAP
Funding cycle: 2026
Organization: Fictional Community Partners
Grant ID: EXAMPLE-001
Requested amount: $250,000.00
Awarded amount: $200,000.00
Application deadline: 2026-11-20
Contract start date: 2027-01-01
Contract end date: 2027-12-31
Reporting requirements: Per the executed agreement
Important milestones: Startup readiness review
```

Unrecognized information stays blank; extraction does not invent data. Scanned PDFs need text recognition before import (OCR is not included). Dates must be ISO `YYYY-MM-DD`; ambiguous dates are rejected rather than guessed. Spreadsheet amounts are USD dollars, converted to integer cents. The first worksheet is used. Formula cells are rejected; export their values as CSV first.

Limits: 10 MB/file, 500 data rows, 100 columns, 100 PDF pages, and 30 MB expanded Office content. Macros and embedded Office objects are rejected. File extensions and signatures/package structure are checked; arbitrary HTML and executables are not allowed. XLSX/DOCX files are parsed as data, not rendered or executed. Documents download as attachments through an authenticated route. HTTPS links are references, never server-fetched.

Review missing names, organization, IDs, and deadlines in the preview. A workflow and initial stage are suggested, and all values are editable. Name matches are advisory; only **exact, case-sensitive external grant IDs** trigger skip/update behavior. Updates require Manager/Admin, preserve the workflow/history, and leave blank optional values unchanged. Nonblank fields in the preview, including owner and funding program, are applied. Importing the same file without grant IDs can create duplicate names; review these warnings carefully. Individual invalid rows fail without undoing valid rows. Re-upload to retry failed rows, deselecting successes.

Previews expire after one hour and are bound to the uploading user. A confirmed token cannot be reused. Temporary preview files are private; run the cleanup script periodically to remove expired, unreferenced uploads.

## Workflow behavior

Prior stages of a grant started midway through a workflow are marked **Skipped**, with a reason explaining that prior completion dates are unknown. No historical dates are invented. On advance, the current completion timestamp is saved and the next applicable stage is activated. Its preassigned template coordinator and duration are retained; estimated dates are proposed from the activation date. Confirmed deadlines are preserved.

An explicit decision is required at award-decision stages. **Not Selected** ends the grant and skips all remaining stages, preventing contracting. Before an appeals stage, users choose whether an appeal applies. Skipping an optional stage requires a reason. Blocked stages and paused grants/cycles cannot advance. Holds preserve dates; they do not silently move deadlines.

Recalculating future dates is opt-in when editing a stage. It affects future estimated dates only, preserving confirmed and historic values. Unknown durations break the estimation chain until a later confirmed date provides an anchor. Dates are calendar days, not business days. Implementation and HUD decision timing remain unknown unless an agreement or authoritative schedule supplies them.

Date-only deadlines are stored as ISO text and rendered without timezone shifts. Audit timestamps are UTC; the interface renders them in `America/Los_Angeles`. Recurring reporting tasks are separate from lifecycle stages; repeat intervals are explicit calendar-day counts, not assumed monthly/quarterly schedules.

## Validation

```powershell
npm run typecheck
npm test
npm run build
npm run test:browser
```

Tests use an isolated temporary SQLite database and uploads directory. They cover creation, workflow assignment, all four import formats, file validation, duplicates, preview/confirm, update/skip counts, stage advance, appeals, rejected awards, deadline changes, blocked stages, comments/audit, paused cycles, role restrictions, and production auth refusal. Build success does not imply production identity is configured.

Browser tests use installed Microsoft Edge, a separate database under `data/e2e`, and port 3012. They exercise desktop/tablet navigation, quick add, comments, attachments, stage advancement, audit history, and reviewed CSV imports. On systems without Edge, install a Playwright browser and adjust `channel` in `playwright.config.ts`. Screenshots and traces are written under `test-results/`.

Managers and Admins can archive a grant from its detail page; Settings lists archived records for restoration. This is the deletion mechanism: it hides records from the active tracker while retaining comments, files, and audit history.

## Authentication and production deployment

**Development authentication is not production authentication.** It works only with `AUTH_MODE=development` and a nonproduction Node environment. `npm start` runs production mode and refuses this identity. Do not expose the development server to a shared network.

The server includes an adapter for a trusted identity gateway, suitable for connecting Microsoft Entra ID. It does **not** implement or claim to have configured a live Entra tenant, login callback, or SSO integration. Before internal deployment:

1. Deploy behind an HTTPS gateway that performs Entra OIDC authentication, tenant validation, and conditional access/MFA according to your organization's policies.
2. Strip any client-supplied `x-rtfh-token`. After successful login, have the trusted gateway issue a short-lived HS256 JWT with `sub` matching a provisioned database user ID, `iat`, `exp`, the configured issuer, and audience. Maximum accepted token age is five minutes. Never issue these tokens in browser code or expose the signing secret.
3. Set `AUTH_MODE=proxy`, a random secret of at least 32 characters in `AUTH_JWT_SECRET`, `AUTH_ISSUER`, `AUTH_AUDIENCE`, and the exact public `APP_ORIGIN`. Restrict the backend so clients cannot bypass the gateway. HTTPS, request timeouts, rate limits, upload/body limits, and session invalidation belong at that boundary as well.
4. Provision real staff records and remove seed identities from the production database. Roles are read from the database, never trusted from a client token. All approved internal staff share grant/document/comment read access. Staff may mutate only grants they manage or currently coordinate; Managers manage details and holds; Admins also manage workflow templates. This MVP does not implement per-document confidentiality tiers.
5. Use a fresh database with verified templates, actual staff IDs, and no fictional grant records. See `docs/deployment.md` for clean provisioning and migration guidance.
6. Use durable local/private storage, least-privilege filesystem permissions, encryption at rest, tested backups, restore procedures, retention rules, audit retention, and malware scanning appropriate for the internal deployment. Content validation is not a substitute for antivirus scanning.
7. Run tests and build, then `npm start` behind the gateway. Verify unauthenticated requests are rejected, Staff cannot escalate roles, cross-origin writes fail, and document downloads require identity. Never ingest client-level HMIS information.

The current SQLite adapter is intended for one local application instance. For a shared 10–20-user deployment, PostgreSQL is the intended next persistence adapter. The normalized model and server-only service layer keep UI and workflow rules separate from storage, but switching databases is an explicit migration, not merely changing a connection string.

## Repository map

| Path               | Purpose                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `app/`             | Server-rendered pages and authenticated HTTP routes                  |
| `components/`      | Responsive tracker, grant details, import review, template editor    |
| `components/ui/`   | shadcn/ui Button primitive (Radix Slot + CVA)                        |
| `lib/db/schema.ts` | Normalized Drizzle schema and foreign-key relationships              |
| `migrations/`      | Versioned SQL migrations                                             |
| `lib/grants.ts`    | Transactional lifecycle rules and audit records                      |
| `lib/imports.ts`   | Safe file validation, deterministic extraction, preview/confirmation |
| `lib/auth.ts`      | Development identity, signed-gateway verification, RBAC              |
| `tests/`           | Database and import behavior tests                                   |

## Source context and limits

- [August 2026 HHAP Strategic Investment RFP](https://www.rtfhsd.org/wp-content/uploads/2026/08/HHAP-RFP_Final_August-2026.pdf): the cycle-specific published dates informed editable planning estimates. They are not universal mandatory timelines. Staff coordinate independent scoring; the independent review committee retains that responsibility.
- [RTFH Grants & Contracts](https://www.rtfhsd.org/funding/grants-recipients/): the application complements existing grant administration systems. Requested and awarded amounts are kept separate.
- [RTFH CoC Monitoring](https://www.rtfhsd.org/about-coc/coc-monitoring/): monitoring obligations must follow applicable agreements and source documentation.
- [Supplied FY 2026 CoC local timeline](https://www.rtfhsd.org/wp-content/uploads/2026/09/FY_2026_CoC_NOFO_Local_Timeline_Updated.pdf): retrieval failed during implementation. CoC template planning values come from the user-provided brief and must be verified by staff. No HUD announcement schedule is assumed.

Later-phase limitations: no email notifications, external integrations, full Entra login flow, OCR, arbitrary-document semantic extraction, or automated malware scanner. Source documents and retained comments are private internal grant-level data, not a client case-management system.
