# RTFH Grants Workspace

An internal grant lifecycle dashboard built with Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui-style Radix components, Drizzle ORM, PostgreSQL, and private Netlify Blobs storage. No external AI, browser localStorage, or live ZoomGrants/Dropbox integration is required. Hosted infrastructure is configured separately.

## Run locally

Use **Node.js 24 LTS** and npm. From this repository in PowerShell:

```powershell
npm ci
Copy-Item .env.example .env
# Start the development PostgreSQL server in a separate terminal:
npm run db:local
# Back in this terminal, with DATABASE_URL from .env.example:
npm run db:setup
npm run dev
```

Open **http://localhost:3000**. The server binds to loopback. `APP_ORIGIN` must match the URL you use, including port; use localhost, not 127.0.0.1, with the default configuration.

Setup is idempotent and never resets existing data. `npm run db:local` runs an embedded PostgreSQL development server on port 5433, storing its files under the ignored `data/postgres-dev` directory. Alternatively, set `DATABASE_URL` to a dedicated development PostgreSQL database. Local uploads use `STORAGE_DRIVER=local` and `data/uploads`; production requires Netlify Blobs. Existing SQLite data is not opened automatically: use the transfer command in [deployment notes](docs/deployment.md).

The seeded users, eight demo grants, organizations, amounts, IDs, and deadlines are **fictional**. Demo deadlines are relative to the initial setup date in Pacific Time. The database is already initialized if setup has previously run. On a new database, `npm run db:setup -- --no-demo` installs templates and development accounts without demo grants.

Development identity is Alex Morgan (Admin). To exercise roles locally, change `DEV_USER_ID` in `.env` to `jordan` (Manager), `casey` (Manager), or `sam` (Staff), and restart. Browser clients cannot select their own identity or role.

## Implemented scope

- Overview metrics; searchable, filterable, sortable tracker; stage Kanban; My Tasks, Needs Attention, upcoming deadlines, and external decision views; CSV export.
- Quick add with name, template, internal manager, and starting stage; optional grant metadata; full grant detail editing for managers.
- Four seeded workflows, role-based coordinator defaults, independent decision-maker fields, editable planning dates, conditional appeals, selected/not-selected branches, grant/cycle holds, and automatic next-stage handoffs.
- Stage ownership, blocking/unblocking, dated per-stage comment threads, private uploads and HTTPS document links, preserved history, and transactional audit records.
- PDF/DOCX extraction of explicitly labeled values; CSV/XLSX row imports; editable review before creation; saved column mappings; exact duplicate-ID detection; skip/update modes; per-row imported/updated/skipped/error results. Imported source files attach to each successful grant.
- Admin template creation/editing/reordering, separate recurring reporting tasks, parent-cycle summaries, and a Microsoft Entra staff login and an optional signed-gateway adapter.

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

Limits: 4 MB/file, 500 data rows, 100 columns, 100 PDF pages, and 30 MB expanded Office content. Macros and embedded Office objects are rejected. File extensions and signatures/package structure are checked; arbitrary HTML and executables are not allowed. XLSX/DOCX files are parsed as data, not rendered or executed. Documents download as attachments through an authenticated route. HTTPS links are references, never server-fetched.

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
npm run test:production
npm run test:browser
```

Tests use an isolated embedded PostgreSQL engine and a private uploads directory, plus Netlify's Blobs emulator. They cover creation, workflow assignment, all four import formats, file validation, duplicates, preview/confirm, update/skip counts, stage advance, appeals, rejected awards, deadline changes, blocked stages, comments/audit, paused cycles, role restrictions, and production auth refusal. Build success does not imply production identity is configured.

Browser tests use installed Microsoft Edge, an isolated PostgreSQL protocol server on port 5438 (or `E2E_DATABASE_URL`), and port 3012. They exercise desktop/tablet navigation, quick add, comments, attachments, stage advancement, audit history, and reviewed CSV imports. On systems without Edge, install a Playwright browser and adjust `channel` in `playwright.config.ts`. Screenshots and traces are written under `test-results/`.

Managers and Admins can archive a grant from its detail page; Settings lists archived records for restoration. This is the deletion mechanism: it hides records from the active tracker while retaining comments, files, and audit history.

## Authentication and production deployment

**Development authentication is not production authentication.** It works only with `AUTH_MODE=development` and a nonproduction Node environment. `npm start` runs production mode and refuses this identity. Do not expose the development server to a shared network.

Production sign-in now uses Microsoft Entra ID through Auth.js. Staff sign in at `/login` with their organizational Microsoft account. Access requires the configured tenant and a previously provisioned user Object ID; email addresses do not grant access. Roles are reloaded from PostgreSQL on each request. Sessions use encrypted HTTP-only cookies, and staff can sign out from the sidebar. Disabled accounts are denied without deleting their audit history.

The runtime uses PostgreSQL and private Netlify Blobs. Before deployment, configure the database connection, Entra app registration, production environment variables, and real staff accounts. The complete [Netlify deployment guide](docs/deployment.md) includes the exact callback URI, required settings, provisioning commands, legacy SQLite transfer, preview isolation and maintenance. A Git push does not create live services or supply organization credentials. The optional signed-gateway adapter remains available for organizations that already use one.

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

Later-phase limitations: no email notifications, external integrations, OCR, arbitrary-document semantic extraction, or automated malware scanner. Source documents and retained comments are private internal grant-level data, not a client case-management system.
