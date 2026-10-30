# ByteDock submission handoff

## One-paragraph project description

ByteDock is a browser-based development workspace that brings code editing, file management, AI programming assistance, and remote code execution into one dark-themed IDE. Its React, TypeScript, Vite, and Monaco frontend is deployed as a static GitHub Pages site, while a Node.js API on Render securely connects to Supabase for account-separated workspaces, Nebius Token Factory for AI assistance, and Judge0 for sandboxed Python and JavaScript execution. The design keeps provider credentials on the backend and avoids requiring visitors to install local language runtimes or Docker.

## What to demonstrate

1. Open the deployed GitHub Pages URL and show the ByteDock workspace.
2. Sign in or create a test account.
3. Create a new file, edit code in Monaco, and demonstrate the unsaved-change indicator.
4. Save/reload and show the account's cloud workspace persists.
5. Send `Reply with exactly: BYTEDOCK_AI_OK` to the AI Agent using the configured Nebius model.
6. Ask the Agent to write a small Python function. Explain that AI provides suggestions and does not silently modify the project files.
7. Toggle **Include file** off and on. Use DevTools Network to show that file contents are absent when disabled and present only when explicitly enabled.
8. Run a Python file and a JavaScript file through the configured remote sandbox. Show stdout/stderr in the Output panel.
9. Explain that GitHub Pages hosts the static UI, while Render, Supabase, Nebius, and Judge0 provide backend capabilities.

If any external provider has not been configured or verified, demonstrate only the features that are actually live and state that the integration requires its provider configuration.

## Main technology choices

| Layer | Technology | Responsibility |
|---|---|---|
| Editor | React + TypeScript + Monaco | IDE UI and code editing |
| Frontend build | Vite | Static production assets |
| Static hosting | GitHub Pages | Browser-delivered frontend |
| API | Node.js built-in HTTP server | Authentication verification, workspace, AI proxy, execution proxy |
| Accounts | Supabase Auth | Email/password sessions |
| Database | Supabase Postgres + RLS | Per-user workspaces and usage events |
| AI | Nebius Token Factory | Coding assistant chat completions |
| Execution | Judge0 | Remote Python and JavaScript jobs |
| CI/CD | GitHub Actions | Build and deploy GitHub Pages |
| API hosting | Render | Production Node API |

## Important API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Backend and deployment health |
| GET | `/api/auth/config` | Frontend auth-mode discovery |
| POST | `/api/auth/signup` | Create an account |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/refresh` | Refresh a Supabase session |
| GET | `/api/auth/me` | Verify current session |
| POST | `/api/auth/logout` | Sign out upstream |
| GET / PUT | `/api/workspace` | Load or save the current user's workspace |
| GET | `/api/ai/status` | Public-safe AI configuration status |
| POST | `/api/ai/chat` | Authenticated Nebius chat proxy |
| GET | `/api/runtime/status` | Authenticated execution-provider health |
| POST | `/api/runtime/run` | Authenticated remote code execution |
| GET | `/api/usage` | Current user's usage summary |

## Release boundary

This repository is the consolidated core online IDE submission. It is not a general-purpose cloud machine. The terminal panel supports the `run`, `clear`, and `help` console commands; it does not provide an arbitrary operating-system shell. Git operations, nested workspace folders, live collaboration, OAuth, account deletion, password-reset UI, billing, automated multi-file AI patches, and additional language runtimes are not implemented in this release. See `PHASES-AND-SUBPHASES.md` for the full phase map.

## Test evidence

The included `npm test` currently passes 28 backend integration checks using local mock providers. Those checks cover local mode, CORS, fail-closed production auth, mocked Supabase login and per-user workspace separation, mocked Nebius chat and usage parsing, and mocked Judge0 status/submission/polling with per-user usage recording.

The local container did not have this project's npm dependencies installed. An npm dependency installation attempt timed out, so a complete Vite production build and full TypeScript project type-check could not be verified here. GitHub Actions performs the actual dependency install and frontend build on push; the first Actions run is therefore the authoritative build check. Live Render, Supabase, Nebius, and Judge0 services still require your own account credentials and deployment actions.
