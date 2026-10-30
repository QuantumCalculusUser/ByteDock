# ByteDock Online IDE

**ByteDock** is a browser-based coding workspace with a Monaco editor, file explorer, multi-tab editing, a terminal/output panel, a Nebius-powered AI Agent, account-backed cloud workspaces, and remote Python/JavaScript execution through Judge0.

The submission architecture is designed for a static frontend on **GitHub Pages** and a separate Node.js API on **Render**. GitHub Pages does not run backend code, so visitors only need a browser while the API, credentials, database access, and code-execution requests stay server-side.

## Product capabilities

- Dark graphite IDE interface with a main Monaco editor and minimap.
- File explorer, multiple editor tabs, unsaved-change indicators, create/rename/delete, text-file import, workspace backup export/import, and search by filename.
- Editor preferences: font size, word wrap, minimap, and full-editor focus view.
- Browser keyboard shortcuts for save, new file, settings, search, and editor focus. Browsers reserve `Ctrl+N`/`Cmd+N`, so ByteDock uses `Ctrl+Alt+N`/`Cmd+Option+N` for a new file.
- Backend autosave and account-isolated workspace persistence using Supabase Auth and Postgres.
- Nebius Token Factory chat completions, API-key secrecy, recent-turn context, opt-in active-file context, usage recording, rate limiting, and a bounded retry for transient failures.
- Remote Python and JavaScript submission and result polling through Judge0. The backend applies source/input size checks, concurrency/rate limits, provider CPU/memory/wall-time caps, output limits, and disables network access in the submission request.
- Account usage display for AI tokens, execution calls, CPU time, and workspace bytes.
- GitHub Actions deployment to GitHub Pages and a Render Blueprint for the API.

## Architecture

```text
Browser
  └── GitHub Pages: React + Vite + Monaco
        └── HTTPS requests to Render Node API
              ├── Supabase Auth: signup, login, refresh, logout
              ├── Supabase Postgres: one workspace row per user + usage events
              ├── Nebius Token Factory: AI chat completions
              └── Judge0: remote, sandboxed Python / JavaScript submissions
```

The browser receives only the public API base URL and the Supabase publishable key is never embedded in the static app. The Supabase secret key, Nebius key, Judge0 token, and service configuration remain on the backend.

## Quick start: local development

Requirements: Node.js 20+ and npm.

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:4173`. In local mode the API uses `data/workspace.json` and authentication is optional. Configure `NEBIUS_API_KEY` and `NEBIUS_MODEL` in `.env` to enable the Agent. Local execution can call the configured Judge0 endpoint; it does not need Docker Desktop on the developer's computer.

Useful commands:

```bash
npm run dev       # local API + Vite middleware
npm test          # backend integration smoke tests with mock providers
npm run build     # TypeScript project check + static Vite production build
npm start         # start API in production mode (for Render)
npm run preview   # preview a local Vite build
```

`npm run build` requires the development dependencies installed. Render deliberately installs production dependencies only because it hosts the API, not the Vite build.

## Production deployment

Follow **[DEPLOYMENT.md](DEPLOYMENT.md)** in order. The short sequence is:

1. Create the Supabase project and run `database/supabase-schema.sql`.
2. Configure Supabase Auth site URL and redirect URLs for your GitHub Pages address.
3. Push the ByteDock repository to GitHub.
4. Create the Render backend from `render.yaml` and add the required private environment variables.
5. Set GitHub repository variable `VITE_API_BASE_URL` to the Render API origin.
6. Enable GitHub Pages with GitHub Actions and push to `main`.
7. Configure and verify a managed/private Judge0 endpoint, then deliberately set `EXECUTION_ENABLED=true` on Render.
8. Test signup, login, workspace isolation, Nebius requests, and remote execution using the release checklist.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `PORT` | Backend | HTTP port; Render provides this automatically. |
| `NODE_ENV` | Backend | Set to `production` on Render. |
| `AUTH_REQUIRED` | Backend | Set to `true` for public deployment. |
| `CORS_ORIGIN` | Backend | Comma-separated allowed website origins, without a repository path. |
| `SUPABASE_URL` | Backend | Supabase project URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Backend | Supabase public/publishable API key used for Auth requests. |
| `SUPABASE_SECRET_KEY` | Backend | Server-only Supabase secret key used for PostgREST workspace/usage requests. |
| `NEBIUS_API_KEY` | Backend | Nebius Token Factory API key. |
| `NEBIUS_BASE_URL` | Backend | Defaults to `https://api.tokenfactory.nebius.com/v1`. |
| `NEBIUS_MODEL` | Backend | Exact model ID enabled for your Token Factory account. |
| `EXECUTION_ENABLED` | Backend | Keep `false` until a managed/private Judge0 endpoint is configured and verified. |
| `JUDGE0_BASE_URL` | Backend | Managed/private Judge0 API origin. |
| `JUDGE0_AUTH_TOKEN` | Backend | Provider token, if required. Never expose it to the browser. |
| `JUDGE0_PYTHON_LANGUAGE_ID` | Backend | Defaults to Judge0 Python 3 language ID `71`. Confirm for your provider. |
| `JUDGE0_JAVASCRIPT_LANGUAGE_ID` | Backend | Defaults to Judge0 Node.js language ID `63`. Confirm for your provider. |
| `VITE_API_BASE_URL` | GitHub Actions variable | Public Render API origin used when building the static frontend. Not a secret. |
| `VITE_BASE_PATH` | GitHub Actions build env | Set automatically by the Pages workflow for a project or user site. |

## Security and operational limits

- The production Render Blueprint sets `AUTH_REQUIRED=true` and `EXECUTION_ENABLED=false` initially. This is a fail-closed configuration: users cannot write into a shared workspace if Supabase is missing, and code execution does not accidentally use a public shared runner.
- Supabase authentication is checked by the backend for workspace, usage, AI chat, and runtime endpoints. The service secret key is backend-only.
- Each Supabase user gets a separate `workspaces` row. The SQL schema enables RLS and gives authenticated users policies scoped to `auth.uid()`.
- The initial free-tier limits enforced by the API are 100,000 recorded AI tokens/month, 100 execution runs/month, 120 seconds of CPU budget/month (checked conservatively using a 2-second reservation per run and then recording reported CPU use), 5 MB workspace content, 128 MB provider memory per run, 5 execution submissions/minute per user, and 12 AI requests/minute per user. Per-process concurrency caps are also applied. The usage quota check is application-level accounting, not a transactional billing ledger; concurrent requests may briefly race near a monthly limit.
- Execution is not a general shell. The initial supported languages are Python and JavaScript. No user code runs inside the ByteDock Node process.
- The backend asks Judge0 to disable network access and applies provider resource caps. Actual isolation depends on the configured Judge0 deployment and its administrator settings. Use a managed/private endpoint with confirmed sandbox configuration before accepting public traffic.
- Never commit `.env`, provider keys, access tokens, or a production database export. GitHub Pages variables prefixed `VITE_` are public build-time values.
- CORS is a browser-origin control, not authentication. Supabase access-token validation is the account boundary.

## Supported now vs. not included

Implemented: browser IDE shell, Monaco editing, file operations and text imports, JSON workspace backup/restore, local persistence, Supabase signup/login/session refresh, per-user Postgres workspace rows, basic usage accounting, Nebius AI chat, explicit file context, Python/JavaScript remote execution integration, API smoke tests, and GitHub Pages/Render deployment configuration.

Not implemented in this submission: Git clone/commit/push/branch operations, a general interactive OS shell, nested directory/file-tree uploads, live collaboration, team workspaces, OAuth providers, password-reset UI, account deletion UI, payments/subscriptions, automatic agent file edits, multi-language execution beyond Python/JavaScript, mobile-native layouts, and a strict transactional billing ledger. Do not advertise these as available.

## Tests and evidence

`npm test` runs the ByteDock API against local mock Nebius and Judge0-compatible services. It checks API startup, health, CORS, local auth configuration, workspace validation/persistence, AI status/chat/usage parsing, execution provider status/submission/polling, and rejection of unsupported languages.

These mock tests verify ByteDock's request/response plumbing. They do **not** prove that your actual Supabase, Nebius account/model, Render service, GitHub Pages deployment, or managed Judge0 instance is live. Those require your account settings and are listed in `RELEASE-CHECKLIST.md`.

## Documentation

- [Deployment guide](DEPLOYMENT.md)
- [Full phases and subphases](PHASES-AND-SUBPHASES.md)
- [Release testing checklist](RELEASE-CHECKLIST.md)
- [Supabase database schema](database/supabase-schema.sql)
