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
