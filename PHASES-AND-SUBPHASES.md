# ByteDock phases and subphases

This is the release map for the consolidated ByteDock project. Status labels describe the code in this repository, not a claim that external accounts have been provisioned or that the public deployment is live.

- **Implemented**: present in source code and covered by source-level or automated checks where specified.
- **Configuration required**: code path exists, but it needs the user's provider/account values or deployment action.
- **Not implemented**: intentionally outside this submission release.

## Phase 1 — IDE interface and editing experience

### 1.1 — Workspace shell and visual system
- Graphite/black editor interface.
- Top navigation, menu bar, activity rail, explorer, editor, AI Agent panel, terminal/output panel, and resource dock.
- Responsive pane visibility controls for explorer, agent, terminal, and full-editor focus.
- **Status: Implemented.**

### 1.2 — Monaco editor
- Monaco code editor with language-aware syntax highlighting.
- Main editor remains the only editable code surface; no duplicate side preview editor.
- Minimap and word wrap controls.
- **Status: Implemented.**

### 1.3 — File explorer and tabs
- Create, rename, delete, open, and switch between files.
- Multiple tabs and individual unsaved-change indicators.
- Filename search, plain text imports, workspace JSON import/export.
- **Status: Implemented.** Nested folders, binary asset management, and directory upload are not implemented.

### 1.4 — Editor preferences and shortcuts
- Font size, word wrap, minimap, and distraction-free editor view.
- Save, new file, search, and settings shortcuts. Browser-reserved `Ctrl+N`/`Cmd+N` is not overridden.
- **Status: Implemented with a limited preference set.** Preferences are currently primarily session/UI state; a full synced settings profile is not implemented.

## Phase 2 — Backend, AI, cloud workspace, and execution

### 2.1 — Local workspace persistence
- Preserve file contents and unsaved baselines.
- Migrate older browser IndexedDB workspace into backend storage when no server workspace exists.
- **Status: Implemented.**

### 2.2 — Node.js workspace API
- Workspace load/save and file CRUD routes.
- Server-side validation and atomic local workspace writes.
- **Status: Implemented for local mode.** Local JSON storage is not the public multi-user storage layer.

### 2.3 — Nebius Token Factory AI Agent
- Backend-only API key.
- OpenAI-compatible Chat Completions integration.
- Recent message history, model and token reporting, loading/error states, and retry for transient network/5xx failures.
- Include-file checkbox controls whether the current active-file snapshot is attached to the current request; previous file snapshots are stripped from historical turns.
- **Status: Implemented.** Live provider/model access requires valid Nebius credentials and network availability.

### 2.4 — GitHub Pages and remote execution architecture
- Static frontend built by GitHub Actions and deployed to GitHub Pages.
- Separate Node API service configuration for Render.
- Backend-to-Judge0 asynchronous submission/result polling for Python and JavaScript.
- No Docker, Python, or Node installation required on website visitors' devices.
- **Status: Implemented in source and deployment configuration.** Actual deployment and production execution provider require account setup and live verification.

### 2.5 — Accounts and per-user cloud workspaces
- Supabase email/password signup and login.
- Session refresh and signout.
- Bearer-token validation on protected API routes.
- One Postgres workspace row per Supabase user.
- Row-level security policies scoped to `auth.uid()`.
- **Status: Implemented in backend/frontend/schema.** Requires Supabase project setup, SQL execution, Auth URL configuration, and Render secrets.

### 2.6 — Limits, reliability, and public safety defaults
- Input validation and request-size limits.
- Per-user AI and execution request rate limits.
- Monthly usage event recording and workspace-size accounting.
- AI transient retry and informative upstream errors.
- Execution concurrency caps, source/stdin/output limits, and provider resource-limit requests.
- File context is opt-in and excluded from the outbound request when disabled.
- Production accounts fail closed if Supabase configuration is missing.
- Production code execution is disabled until a managed/private Judge0 service is configured.
- **Status: Implemented.** Usage quotas are application-level accounting, not an atomic billing system. Actual isolation depends on the Judge0 host configuration.

## Phase 3 — Submission release and deployment

### 3.1 — GitHub Pages CI/CD
- Project-site and user-site Vite base path calculation.
- GitHub Actions frontend build and Pages artifact deployment.
- `VITE_API_BASE_URL` provided as a build-time repository variable.
- **Status: Implemented in workflow.** Requires Pages to be switched to GitHub Actions and a successful workflow run.

### 3.2 — Render backend deployment
- Production-only Node API service.
- Backend install excludes Vite/TypeScript dev dependencies, avoiding the previous `vite: Permission denied` Render build path.
- Health check endpoint.
- **Status: Implemented in `render.yaml`.** Requires Render Blueprint creation and environment variables. The blueprint currently selects a Starter instance; verify account pricing before provisioning.

### 3.3 — Database setup and deployment guide
- SQL schema for workspaces and usage events.
- Supabase Auth URL setup, API key storage, CORS, Judge0 and Nebius configuration instructions.
- **Status: Implemented in `DEPLOYMENT.md`.** External setup remains user action.

### 3.4 — Release validation and test evidence
- Automated backend smoke tests with local mock providers.
- Manual production checklist for account isolation, AI, privacy, and code execution.
- **Status: Automated mock tests implemented.** Live service tests are not represented as passed.

## Deferred phases after this submission

### Phase 4 — Developer workflow integrations (not implemented)
- GitHub OAuth and repository clone/import.
- Source control panel with status, diff, commit, push, pull, and branches.
- Persistent terminal sessions and interactive shell/PTY.
- Folder tree, nested folders, and multi-file project uploads.
- Extension/plugin system.

### Phase 5 — AI agent workspace actions (not implemented)
- Reviewable diffs and patch application.
- Multi-file edit plans, approval/reject controls, and undo snapshots.
- Project indexing and semantic code search.
- Tool calls for tests/lint/build through a constrained job API.

### Phase 6 — Collaboration and product operations (not implemented)
- Shared workspaces and real-time multi-user collaboration.
- Team roles, organization workspaces, and admin controls.
- Billing, paid plans, invoices, subscription lifecycle, and transactional quota enforcement.
- Account deletion and export/delete retention controls.
- Password reset and OAuth provider flows.
- Audit log and administrator observability.

### Phase 7 — Broader runtime support (not implemented)
- Additional languages and runtime images.
- Artifact downloads and long-running jobs.
- Configurable package/dependency manifests with isolated build steps.
- Provider failover, queueing, and scalable workers.

## Final submission boundary

The current source release completes the core online IDE architecture, Nebius assistant integration, account-separated workspaces, and remote execution adapter for two languages. It is not a fully featured cloud development platform: general shell access, Git integration, collaboration, billing, and automatic AI file edits remain future work. Production launch still requires configuring Supabase, Nebius, Render, GitHub Pages, and a managed/private Judge0 endpoint.
