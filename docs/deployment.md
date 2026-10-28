# Netlify deployment

## MVP testing without hosted services

Deploy normally with `npm run build`, then share `https://grant-dashboard.netlify.app/demo`. This public route needs no database, storage credentials, or Microsoft registration. Build scripts copy the browser database assets into `public/demo-assets`; Netlify serves them with the application. Each tester's fictional grants, edits, and attachments stay in that browser's IndexedDB. Reset restores samples only in that browser. Clearing site data removes progress; use one demo tab at a time.

The demo supports CSV imports and local file attachments. PDF/DOCX/XLSX import extraction and shared staff records require the hosted workspace below. Staff APIs remain protected; the demo does not enable development authentication in production. The `/login` page includes a public demo link.

Verification: `npm run build` then `npm run test:demo` tests the production bundle against an unreachable database, including browser persistence, independent testers, reset, local downloads, and no production API requests during demo workflows.

## Hosted staff workspace

The application now uses hosted PostgreSQL through `pg`/Drizzle and a private, site-wide Netlify Blobs store. Runtime imports do not create a local database or upload directory. No live database, storage credentials, or Entra app registration are provisioned by a Git push.

## Configure the production site

1. Create a hosted PostgreSQL database (Netlify Database or another PostgreSQL provider). Use a provider-supported pooled connection URL and TLS. Keep the database near the Netlify function region. The runtime pool is capped at three connections per warm function instance; size the provider pool for concurrent instances.
2. In Netlify **Project configuration > Environment variables**, configure these variables for the **production** context and **Functions** scope (or all scopes):

   | Variable              | Value                                                                                    |
   | --------------------- | ---------------------------------------------------------------------------------------- |
   | `DATABASE_URL`        | PostgreSQL connection string from your provider, including required TLS settings; secret |
   | `STORAGE_DRIVER`      | `netlify`                                                                                |
   | `BLOB_STORE_NAME`     | `grants-production`                                                                      |
   | `APP_ORIGIN`          | `https://grant-dashboard.netlify.app`                                                    |
   | `AUTH_URL`            | Exactly the same origin as `APP_ORIGIN`, with no trailing slash                          |
   | `AUTH_MODE`           | `entra`                                                                                  |
   | `ENTRA_TENANT_ID`     | Your organization's Directory (tenant) ID                                                |
   | `ENTRA_CLIENT_ID`     | The Entra Application (client) ID                                                        |
   | `ENTRA_CLIENT_SECRET` | Client secret **value**, not its ID; secret                                              |
   | `AUTH_SECRET`         | A cryptographically random session encryption secret of at least 32 characters; secret   |

   Remove obsolete `DATABASE_PATH`, `UPLOAD_DIR`, and `DEV_USER_ID` from production. Never use `AUTH_MODE=development` in production. Netlify provides the Blobs runtime context automatically; a personal Netlify token is not needed in deployed functions. The named store is created on its first write and persists across deploys. Files are not published as static assets or public download URLs.

3. Provision the schema and first real administrator from a trusted workstation. Set `DATABASE_URL` locally through a secret manager or ignored `.env`, then set `BOOTSTRAP_USER_ID`, `BOOTSTRAP_USER_NAME`, and `BOOTSTRAP_USER_EMAIL`. For Entra, the ID must be the administrator's **user Object ID** in the configured tenant (not their email, application ID or tenant ID). Set `AUTH_MODE=entra` when running this command to validate the ID. Run `npm run db:setup -- --production`. This applies versioned PostgreSQL migrations and installs templates, funding programs, and the real administrator, with no fictional users or grants. Re-running against an initialized database does not overwrite users or records. Add other staff with `npm run users:provision` as described below before assigning their work.
4. Deploy the latest GitHub commit. Subsequent schema upgrades use `npm run db:migrate` before deployment. Builds deliberately do not connect to or migrate production data.
5. Complete the Entra app registration below, then verify sign-in, grant creation, task completion, import confirmation, attachment upload/download, and persistence after another deploy. Test with Admin, Manager, and Staff accounts.

The login flow is implemented, but it needs your tenant registration and provisioned identities. Until those settings are supplied, `/login` shows a setup notice and private pages redirect there without opening the database.

## Microsoft Entra sign-in

1. In Microsoft Entra, create an **App registration** for accounts in **this organizational directory only**. Add a **Web** redirect URI exactly matching `https://grant-dashboard.netlify.app/api/auth/callback/microsoft-entra-id` (use your actual public host if different). No implicit grant setting is needed; the app uses the authorization-code flow.
2. Copy the Directory/tenant ID and Application/client ID into the Netlify settings above. Create a client secret and store its **value** as `ENTRA_CLIENT_SECRET`. Track its expiry. Generate `AUTH_SECRET` locally with a cryptographic secret generator and store it only in Netlify/your secret manager. Never prefix these values with `NEXT_PUBLIC_`.
3. Restrict app assignment and apply your organization's conditional-access/MFA policy in Entra. The app requests `openid profile email`, uses PKCE, state and nonce checks, and only accepts the explicitly configured tenant. It does not request Microsoft Graph access or authorize by email address.
4. Provision the first administrator as described above. For additional staff, set `STAFF_USER_ID` to their Entra user Object ID, and set `STAFF_USER_NAME`, `STAFF_USER_EMAIL`, `STAFF_USER_ROLE` (`Staff`, `Manager` or `Admin`, default `Staff`) and optionally `STAFF_USER_TEAM` on a trusted workstation with database access. Run `npm run users:provision`. Existing accounts require `-- --update` for intentional role/profile changes. To revoke access while retaining audit relationships, set `STAFF_USER_ID` and run `npm run users:provision -- --disable`.
5. Open `/login` and choose **Sign in with Microsoft**. Only an already provisioned, active staff Object ID in your configured tenant can enter. The **Sign out** button clears this application's session; it does not sign the user out of all Microsoft applications.

Auth.js handles the OIDC flow and encrypted HTTP-only session cookies. Sessions last at most eight hours without renewal. Each workspace request reloads the staff role from PostgreSQL, so role changes and disabled accounts take effect on subsequent requests. No self-service registration or automatic administrator assignment is enabled. Changing tenants invalidates the stored tenant match. Full tenant login must still be tested with your organization's actual Entra registration; local tests verify access policy and signed-out behavior, not a live Microsoft account.

The legacy `AUTH_MODE=proxy` adapter remains available for an existing trusted gateway using short-lived HS256 tokens and `AUTH_JWT_SECRET`, `AUTH_ISSUER`, and `AUTH_AUDIENCE`. It is optional; the direct Entra login flow does not need that gateway.

All provisioned staff can read internal grants, comments and documents. Roles are read from PostgreSQL. Staff edits remain limited to their assigned work; Managers maintain grants and Admins maintain templates. This is not a client case-management system or a per-document confidentiality system.

## Transfer an existing SQLite workspace

Do **not** seed the destination first. Stop writes to the old app and take a consistent SQLite backup together with its upload directory. The legacy SQLite migration files remain in `migrations/` only for reference; the new runtime runs `migrations/postgres/`.

Set these environment variables on a trusted workstation, never in a public file:

- `SQLITE_SOURCE_PATH`: absolute path to the backed-up SQLite database.
- `SQLITE_SOURCE_UPLOADS`: absolute path to the matching private upload directory.
- `DATABASE_URL`: new, empty PostgreSQL destination.
- `STORAGE_DRIVER=netlify` and `BLOB_STORE_NAME=grants-production`.
- `NETLIFY_SITE_ID` and `NETLIFY_BLOBS_TOKEN`: site ID and a Netlify token authorized to access that site's Blobs, for this workstation command only. Remove the token after migration; do not add it to Git or frontend variables.

Run `npm run db:transfer` for a read-only inventory and source-file check. Review the table/file counts, then run `npm run db:transfer -- --apply`. The command copies referenced files, applies the PostgreSQL schema and inserts records in foreign-key order inside one transaction. IDs, date strings, integer cents, stage positions, comments, mappings, documents and audits are preserved. SQLite booleans are converted to PostgreSQL booleans, and row counts are reconciled before commit. An occupied destination is rejected; the source is never modified.

If a transfer fails, SQL records roll back together. Copied blobs may remain: a retry accepts existing objects only when their bytes match the source. Do not delete the source backup until row counts, files and application behavior have been verified. Expired import previews are not migrated; upload those files again if needed. Legacy fictional identities remain fictional after transfer and must be replaced through a deliberate provisioning process before operational use.

## Storage, transactions and limits

`lib/storage.ts` uses Netlify Blobs with strong consistency, UUID keys and conditional creation. Source documents, attachments and actor-bound import previews use the same private store. Downloads pass through authentication and the document table. Local file storage is available only for development/tests and is explicitly rejected in production.

Uploads are limited to **4 MB** to fit Netlify's buffered request limit after multipart/base64 overhead. Imports accept at most 500 rows; use smaller batches when documents are complex or provider latency approaches the function execution limit. Legacy files larger than Netlify's buffered response limit need a separate streaming/download migration before use. No temporary serverless disk stores operational data.

Mutations use PostgreSQL transactions and a workspace advisory transaction lock shared across function instances. Checks and writes on mutation routes are serialized; nested service calls use the same connection and savepoints. Failed import rows roll back independently, and repeated stage transitions or import tokens cannot apply twice. This simple lock fits an internal dashboard; high-volume workloads should use narrower locks after concurrency testing.

Run `npm run uploads:cleanup` periodically from an authenticated maintenance environment. It removes only generated, unreferenced objects older than 24 hours, skips active previews, and checks database references under the same mutation lock. Objects without trustworthy creation metadata are retained. Configure provider backups, encryption, retention, access controls and a tested restore procedure for PostgreSQL and Blobs together. File validation is not malware scanning.

## Preview environments and secret scanning

Use a separate database and a distinct `BLOB_STORE_NAME` for deploy previews/branch deploys. A site-wide store is shared across deploys; reusing `grants-production` would give preview code access to production documents. Do not expose production credentials to untrusted previews.

`netlify.toml` keeps credential scanning enabled, with narrow exceptions for non-secret paths, mode names, origins and storage names. `DATABASE_URL`, `AUTH_SECRET`, `ENTRA_CLIENT_SECRET`, `AUTH_JWT_SECRET` and `NETLIFY_BLOBS_TOKEN` must never be added to the exception list. A successful build does not verify provider access, provisioning or authentication.

References: [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [function limits](https://docs.netlify.com/build/functions/configuration/), [secret scanning](https://docs.netlify.com/build/environment-variables/secrets-controller/#configure-secret-scanning).

Authentication references: [Auth.js Entra provider](https://authjs.dev/getting-started/providers/microsoft-entra-id), [Microsoft immutable identity claims](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference).
