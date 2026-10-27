# Internal deployment notes

## Clean provisioning

Run database migrations against a new database using `DATABASE_PATH` outside the source checkout. `npm run db:setup -- --no-demo` adds templates and fictional accounts, with no grants. Before importing operational records, an operator must replace the seed accounts with real provisioned staff identities:

1. Insert real users with stable IDs, names, approved email addresses, teams, and Admin/Manager/Staff roles using an operator-controlled database tool.
2. Update `template_stages.defaultOwnerId` to the correct real staff IDs (or NULL to default to the grant manager).
3. Remove fictional users while the new database has no grants/audits/documents referring to them. Foreign keys intentionally prevent deletion of referenced actors in an existing operational database.
4. Ensure the identity gateway maps an immutable Entra subject to the same local ID. Provisioning is deliberately not exposed as a self-service browser API.

All sensitive reads require a provisioned identity. The internal sharing model grants all provisioned staff read access; there are no public grant pages. Apply document-specific confidentiality requirements before adopting this MVP for data that cannot be shared with the full Grants & Contracts team.

The shared-secret JWT adapter is a gateway contract, not a completed Entra OIDC implementation. An actual gateway must validate the Entra issuer, tenant, tokens, callback state/nonce, and group membership, handle session lifecycle, and strip spoofed identity headers. Do not accept arbitrary Entra bearer tokens as this application's proxy token. Consider switching the gateway adapter to asymmetric JWKS verification in a future deployment to avoid sharing a signing secret with the app.

## Persistent storage

Use one Node process with SQLite for the initial local installation. SQLite uses foreign keys, WAL mode, and a five-second busy timeout; mutations are transactions. Do not put an actively written SQLite database on OneDrive, Dropbox, SMB, or a shared network filesystem. Avoid multiple independently mounted serverless instances. Grant IDs, audit history, comments, and documents are persistent server data.

Back up SQLite using its online backup API or an operator-approved consistent snapshot, alongside the private uploads directory. Test restoration of both together. Mount uploads outside `public/` and outside build artifacts. Production should use encrypted volumes, a dedicated low-privilege service account, access logs, malware scanning, storage quotas, reverse-proxy rate limits, request deadlines, and a backup retention policy. File parsing has strict input/expanded-size limits but is not an antivirus scanner or a hardened untrusted-code sandbox; consider an isolated parser worker service for broader access.

Run `npm run uploads:cleanup` as a maintenance job. It removes only unreferenced UUID-named upload/preview files older than 24 hours within the configured directory. It never deletes a file referenced by a Document record. Keep audit logs under the organization's retention policy; the UI does not overwrite or delete them.

## PostgreSQL migration path

The normalized models are FundingProgram, FundingCycle, Grant, WorkflowTemplate, WorkflowTemplateStage, GrantStage, User, Comment, Task, Document, AuditLog, and saved import mappings. Stages carry their own previous/next ordering through unique `(grantId, position)` values; grants point to the current position.

1. Define equivalent `pgTable` models: UUID/text IDs, bigint cents, date-only deadline columns, timestamptz audit timestamps, booleans, indexes, foreign keys, and a unique nullable external ID.
2. Replace the SQLite adapter in `lib/db/index.ts` with Drizzle's PostgreSQL driver and create PostgreSQL-specific versioned migrations.
3. Convert synchronous `.get()/.all()/.run()` queries and transactions in the service/repository layer to async Drizzle PostgreSQL calls. UI payload shapes and validation schemas can remain stable.
4. Lock a grant row during lifecycle transitions, or use an optimistic version column. The current API checks the expected stage ID to reject a repeated/stale advance, and SQLite serializes local writes. For distributed deployments, add optimistic versions to detail edits, stage fields, and task completion as well.
5. Export and import tables in foreign-key order, preserve IDs, timestamps, comments, integer cents, and file references; reconcile record counts and audit samples.
6. Move file storage to a private encrypted object store with an authenticated download adapter if needed; retain original document metadata and IDs.
7. Re-run the workflow/import suite against PostgreSQL and add concurrent-session integration tests before cutover. Validate exact-ID matching, timezone behavior, rollback, and backup restores.

This is an explicit engineering migration. The current SQLite schema is not automatically PostgreSQL-compatible simply by changing an environment variable.

## Integration extension points

- `lib/imports.ts`: deterministic extractors and mapping adapters for manual ZoomGrants/Dropbox exports.
- `lib/auth.ts`: verified staff identity and authorization boundary.
- `lib/grants.ts`: audited transactional commands for future notifications or integration events.
- `documents` model + authenticated download route: private storage adapter.
- `tasks` model: explicit per-agreement reporting obligations. No background reminders or email sends are enabled.

Keep integrations disabled until actual API access, data permissions, and organizational ownership are established.
