# ByteDock Phase 2.4 — GitHub Pages + remote execution

## Deployment architecture

- **Frontend:** GitHub Pages (static Vite build).
- **Backend:** Node.js API hosted separately (Render blueprint included).
- **AI:** Nebius Token Factory called only by the backend. Keep `NEBIUS_API_KEY` server-side.
- **Code execution:** backend proxies submissions to Judge0. Browser clients never receive the Judge0 token.

GitHub Pages cannot run Node.js, Python, Docker, or server-side APIs. The API backend is therefore required. Visitors need only a modern browser; they do not install Docker or language runtimes.

## 1. Deploy the backend

1. Push this project to a GitHub repository.
2. In Render, create a new Blueprint and select the repository. Render reads `render.yaml` and creates the `bytedock-api` web service.
3. Set `CORS_ORIGIN` to the exact GitHub Pages origin, for example `https://YOUR-USERNAME.github.io` (no repository path and no trailing slash).
4. Set `NEBIUS_API_KEY` and `NEBIUS_MODEL` in the Render service environment. Do not put secrets in GitHub Pages variables or any `VITE_*` variable.
5. Configure a private/managed Judge0 endpoint and its `JUDGE0_AUTH_TOKEN` for production. The default `https://ce.judge0.com` is a public shared endpoint suitable only for initial integration/testing; availability, rate limits, terms and quotas are controlled by that provider.
6. Deploy and verify `https://YOUR-BACKEND.onrender.com/api/health` and `/api/runtime/status`.

The included Render blueprint uses a paid Starter instance. Select a different plan in Render if appropriate. This Node service currently stores workspace data in a local JSON file; Render's ordinary ephemeral filesystem is not durable. Add a persistent disk or replace workspace storage with a database before relying on saved workspaces in production.

## 2. Configure GitHub Pages

1. Open the GitHub repository → **Settings → Pages**.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Open **Settings → Secrets and variables → Actions → Variables**.
4. Create repository variable `VITE_API_BASE_URL` with the backend origin, e.g. `https://YOUR-BACKEND.onrender.com` (no trailing slash, no `/api`). This is a public URL, not a secret.
5. Ensure the default branch is `main`, then push. The workflow `.github/workflows/deploy-pages.yml` builds Vite and deploys `dist` to Pages.

For a different default branch, update the workflow trigger branch. GitHub's official Pages workflow uses `upload-pages-artifact` and `deploy-pages`.

## 3. Remote execution API

The backend accepts `POST /api/runtime/run` with `{ "language": "python" | "javascript", "code": "...", "stdin": "..." }`.

It submits to Judge0 asynchronously, polls for completion, and returns stdout, stderr, exit code, status, CPU time and memory. The backend applies request-size and per-IP rate limits. Judge0 applies sandboxed execution and resource limits. The UI continues to show output in ByteDock's existing Output panel.

`JUDGE0_BASE_URL`, `JUDGE0_AUTH_TOKEN`, and language IDs are backend environment variables. Never call a paid Judge0 endpoint with a secret directly from browser JavaScript.

## 4. Local development

```powershell
Copy-Item .env.example .env
# Edit .env with Nebius credentials and optional Judge0 credentials
npm install
npm run dev
```

For local Vite development, leave `VITE_API_BASE_URL` unset so requests use the same origin. Local execution now also uses the configured remote Judge0 service; Docker Desktop is not required.

## Important production limitations

- GitHub Pages is static hosting; it cannot host this Node backend.
- The backend's workspace JSON storage is currently shared by all visitors and is not multi-tenant/authenticated. **Do not open public write access to this backend for a real public launch until per-user authentication and isolated workspace storage are implemented.** The CORS allowlist is not authentication and does not prevent non-browser clients.
- Add authentication, per-user quotas, abuse protection, durable database storage, request logging with secret redaction, and a managed/private execution provider before inviting the public.
- The public Judge0 CE endpoint is a test default, not a production SLA or private execution service. Confirm current provider terms and limits.
- Nebius API keys and Judge0 tokens remain on the backend. Only `VITE_API_BASE_URL` belongs in GitHub Actions Variables.
