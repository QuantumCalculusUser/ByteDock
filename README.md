# ByteDock — Phase 1 Frontend

A browser-based coding workspace prototype inspired by cloud IDEs, using a Monokai Pro-inspired dark theme and Consolas/Courier New code typography.

## Included in Phase 1

- Monaco-based editor with editable sample files
- File explorer with file creation and name filtering
- Terminal, output, and problems panels (UI previews only)
- AI assistant sidebar with local demo conversation behavior
- Resource meter for AI credits, CPU, memory, and storage (illustrative values only)
- Upgrade-plan preview

## Not implemented yet

This is a frontend prototype. It does **not** yet call Nebius Token Factory, run submitted code, enforce CPU/RAM/storage quotas, persist projects to a backend, provide authentication, or charge for subscriptions. The terminal and Run button are explicitly demo-only. Do not treat the resource numbers as real usage measurements.

## Requirements

- Node.js 20 or later recommended
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

## License

MIT. See [LICENSE](LICENSE).


### Full code view
Use the expand icon at the right end of the editor toolbar to expand the editor across the workspace. Press `Esc` or the minimize icon to return to the normal layout. The full view hides the explorer, AI panel, and terminal temporarily to maximize code space.


### Live Full Code Panel
The narrow panel on the right displays the complete contents of the currently selected file in a read-only code view. It updates live as you type in the main editor and includes its own scrollbar for long files. The existing editor toolbar button is unchanged.


### Code minimap

The main Monaco editor includes a VS Code-style minimap on the right edge, showing a compact overview of the full file. It stays part of the same editor in fullscreen mode; there is no duplicate code panel.


## Phase 2.1 — Persistent local workspace

This milestone adds browser-local workspace persistence using IndexedDB. File contents, the active file, and open tabs are restored when the app is reopened in the same browser profile.

### Workspace features
- Create a new file from the Explorer or with `Ctrl+N`.
- Edit code in Monaco and persist changes locally as you type.
- Save the current workspace with `Ctrl+S`.
- Open multiple editor tabs and close tabs individually.
- Right-click a file in the Explorer to open, rename, or delete it. Delete requires confirmation.
- File language highlighting is inferred from common file extensions.

### Current limitations
- Persistence is browser-local and does not sync across browsers or devices. Clearing site data can remove the workspace.
- Nested folders, importing/exporting a whole project, cloud storage, Git, and code execution are not included in this milestone.
- Nebius AI Cloud integration remains planned for a later Phase 2 milestone; no API key is required for this local workspace stage.


## Phase 2.1 workspace fixes

- Unsaved-change dots are tracked independently for every open file and remain visible when switching tabs.
- `Ctrl+S` / `Cmd+S` saves the active file's current content to browser IndexedDB.
- Workspace drafts and saved baselines are persisted separately so unsaved indicators remain accurate after refresh.
- Use `Ctrl+Alt+N` / `Cmd+Option+N` to create a file. Browsers reserve `Ctrl+N` / `Cmd+N` for opening a new browser window, so a website cannot reliably override that shortcut.


## Phase 2.2 — Backend API and workspace storage

Phase 2.2 adds a Node.js backend that serves the Vite frontend in development and exposes a same-origin workspace API. The backend persists workspace state to `data/workspace.json` on the server filesystem. The file is created automatically the first time the workspace is saved.

### Run

Requirements: Node.js 20 or later and npm.

```bash
npm install
npm run dev
```

Open the local URL printed in the terminal (default `http://localhost:4173`). Use `npm run build` to build the frontend, then `npm start` to serve the production build and API. Set `PORT` to change the server port.

### API endpoints

- `GET /api/health` — health and backend status.
- `GET /api/workspace` — load persisted workspace state.
- `PUT /api/workspace` — validate and persist workspace state.
- `GET /api/files` — list files.
- `POST /api/files` — create a file.
- `PUT /api/files/:name` — update file content.
- `PATCH /api/files/:name` — rename a file.
- `DELETE /api/files/:name` — delete a file.

The frontend now reads and writes workspace state through `/api/workspace`. Existing Phase 2.1 IndexedDB workspace data is migrated to the backend on first load when the backend has no saved workspace. The backend limits workspace state to 500 files and 12 MB of aggregate file content, validates file names, and uses atomic file replacement when saving.

### Scope and security notes

This is a single-user local development backend, not a public multi-user cloud service. It does not yet provide authentication, per-user workspaces, remote deployment, database-backed storage, code execution, or quota enforcement. Do not expose this server directly to the public internet. Nebius AI Cloud remains planned for the AI integration milestone; this phase does not send source code to Nebius or require a Nebius API key.


## Phase 2.3 — Nebius AI Cloud integration

ByteDock's AI Agent now uses the backend to call Nebius Token Factory's OpenAI-compatible Chat Completions API. The API key stays on the server and is never sent to the browser.

### Configure Nebius

1. Copy `.env.example` to `.env` in the project root.
2. Set `NEBIUS_API_KEY` to your Token Factory API key.
3. Set `NEBIUS_MODEL` to an exact model ID available in your Token Factory account.
4. Keep `NEBIUS_BASE_URL` as `https://api.tokenfactory.nebius.com/v1` unless your account uses a different documented endpoint.
5. Restart the dev server after editing `.env`.

```bash
npm install
npm run dev
```

Open the local URL (default `http://localhost:4173`). The AI Agent panel reports whether the backend is configured. Send a prompt to chat with the selected model. Enable **Include file** only when you want the active file's content sent with the prompt. The server keeps recent conversation turns in each request and returns token usage when the provider supplies it.

### AI API endpoints

- `GET /api/ai/status` — reports whether the key and model are configured, without returning the key.
- `POST /api/ai/chat` — validates messages and forwards them to Nebius Token Factory.

The backend uses `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, and `NEBIUS_MODEL`. It supports `.env` configuration without adding a runtime package. `.env` is ignored by Git; `.env.example` contains no secrets.

### Security and limitations

- Never commit `.env` or share your API key in screenshots, chat, or GitHub.
- The model ID must be available to your account. If it is missing or invalid, configure a supported model ID.
- AI responses are suggestions only. This milestone does not automatically edit files, run code, or provide a secure execution environment.
- Workspace storage is still local server filesystem storage and this is not a multi-user deployment.
- Real Nebius inference can only be verified after configuring a valid API key and model ID. Without credentials, the API deliberately returns a clear configuration error rather than a fake response.

## Phase 2.4 — GitHub Pages + remote execution

The deployment architecture now separates the static GitHub Pages frontend from the Node.js API backend. Code execution is proxied by the backend to Judge0; Docker Desktop is not required on visitor machines. See [README-PHASE-2.4-GITHUB-PAGES.md](README-PHASE-2.4-GITHUB-PAGES.md) for the backend deployment, GitHub Pages workflow, environment variables, and production limitations.

**Important:** GitHub Pages cannot host the Node.js backend. The included backend still uses shared JSON workspace storage and is not authenticated or multi-tenant. Do not expose public workspace writes until authentication and per-user storage are added. Configure a private/managed Judge0 endpoint for production; the public CE endpoint is only an integration default.
