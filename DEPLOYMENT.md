# ByteDock deployment guide: GitHub Pages + Render + Supabase + Nebius + Judge0

This guide is written for a GitHub Pages project site such as `https://USERNAME.github.io/REPOSITORY/`.

## 0. Before you start

You need:

- A GitHub repository containing the ByteDock folder contents at its root (the folder that contains `package.json`, `src/`, `server/`, and `render.yaml`).
- A Supabase project.
- A Render account capable of creating a Node web service.
- A Nebius Token Factory API key and a model ID available to that account.
- A managed/private Judge0 endpoint for production code execution. Keep execution disabled until this service is configured and tested.

## 1. Set up Supabase authentication and storage

1. Create a Supabase project at <https://supabase.com/dashboard>.
2. Open **Project Settings → API** (the menu name may vary with dashboard updates).
3. Copy the project URL, publishable API key, and secret API key. Use the modern `sb_publishable_...` and `sb_secret_...` keys where available. A legacy anon key and service-role key are also supported by the backend, but the service-role/secret key must remain private.
4. Open **SQL Editor** in the Supabase dashboard.
5. Paste all of `database/supabase-schema.sql` and execute it. Confirm that `public.workspaces` and `public.usage_events` exist.
6. Open **Authentication → URL Configuration**.
7. Set **Site URL** to the exact deployed GitHub Pages URL, including the repository path and trailing slash, for example `https://USERNAME.github.io/REPOSITORY/`.
8. Add the same URL under **Redirect URLs**. Add any custom domain you intend to use as another exact redirect URL.
9. Check the email provider configuration. If email confirmation is enabled, new users must verify their email before signing in. For a time-limited demo you can disable confirmation only if your security and assessment requirements allow it.

The backend calls Supabase Auth to verify bearer tokens and uses its server-only secret key for database access. The frontend never receives the Supabase secret key.

## 2. Push the repository to GitHub

From the project root in PowerShell:

```powershell
git init
git branch -M main
git add .
git commit -m "ByteDock online IDE release"
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

If the repo already exists and has a remote, do not run `git init` or `git remote add` again. Use:

```powershell
git add .
git commit -m "ByteDock online IDE release"
git push origin main
```

Before pushing, check `git status` and verify `.env` is not staged. `.gitignore` excludes `.env` and `.env.*` except `.env.example`.

## 3. Deploy the backend on Render

1. Open <https://render.com/> and connect your GitHub account.
2. Choose **New → Blueprint** and select this repository.
3. Render reads `render.yaml` and creates the `bytedock-api` service.
4. Wait for the service to be created, then open **Environment**.
5. Set these values:

```dotenv
NODE_ENV=production
AUTH_REQUIRED=true
CORS_ORIGIN=https://USERNAME.github.io
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
SUPABASE_SECRET_KEY=sb_secret_YOUR_KEY
NEBIUS_API_KEY=YOUR_NEBIUS_KEY
NEBIUS_BASE_URL=https://api.tokenfactory.nebius.com/v1
NEBIUS_MODEL=YOUR_EXACT_ENABLED_MODEL_ID
EXECUTION_ENABLED=false
```

`CORS_ORIGIN` is the website **origin only**, without `/REPOSITORY/`. If you also use a custom domain, add it comma-separated, e.g. `https://USERNAME.github.io,https://ide.example.com`.

6. The Blueprint sets `JUDGE0_BASE_URL` to the public Judge0 CE endpoint as a quick smoke-test default, but keeps `EXECUTION_ENABLED=false`. Do not enable public execution until you have reviewed the provider limits and tested isolation. A managed/private endpoint is preferred for production traffic; add `JUDGE0_AUTH_TOKEN` manually in Render if your provider requires it.
7. Save changes and deploy. The API should start with its production dependencies only. The Render service does not build Vite; GitHub Actions builds the static UI.
8. Check `https://YOUR-SERVICE.onrender.com/api/health`. Expected fields include `ok: true`, `authRequired: true`, `authConfigured: true`, `storage: "supabase-postgres"`, and AI configuration status.
9. Check `https://YOUR-SERVICE.onrender.com/api/auth/config`. Expected: `enabled: true`, `required: true`.
10. Do not enable code execution until the configured Judge0 instance is verified.

### Render build settings

The Render Blueprint uses:

- Build command: `npm install --omit=dev --no-audit --no-fund`
- Start command: `npm start`
- Health check path: `/api/health`

Do not use `npm run build` on the Render API service. `vite` is a frontend build dependency, and the previous `vite: Permission denied` failure happened because the static frontend build was attempted in the backend service. GitHub Actions now owns that build step.

The Blueprint currently requests a Starter service. Confirm current Render pricing and your account's plan before creating it. If the provider offers a free plan for your account, you may change the plan, but expect sleep/cold-start and resource limitations. Supabase is the durable workspace database, not Render's local filesystem.

## 4. Configure GitHub Pages

1. In the GitHub repository, open **Settings → Pages**.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Open **Settings → Secrets and variables → Actions → Variables**.
4. Add repository variable:

   - Name: `VITE_API_BASE_URL`
   - Value: `https://YOUR-SERVICE.onrender.com`

   Do not append `/api`; do not add a trailing slash. This is a public API origin, not a secret.
5. Confirm the workflow `.github/workflows/deploy-pages.yml` is present and the default branch trigger is `main`.
6. Push a commit or run the workflow manually from **Actions → Deploy ByteDock to GitHub Pages → Run workflow**.
7. Wait for both the build and deployment jobs to succeed.
8. Open the page URL shown in the `github-pages` environment.

The workflow calculates the Vite base path for both a user site (`USERNAME.github.io`) and a project site (`USERNAME.github.io/REPOSITORY/`). It builds `dist/` and deploys it as the Pages artifact.

## 5. Configure remote execution

The browser submits source code to ByteDock's authenticated backend. The backend calls Judge0, submits asynchronously, polls for a result, and returns output to the IDE. Visitors do not install Docker, Python, or Node locally.

1. Provision a managed/private Judge0 endpoint suitable for your submission's expected traffic. For a one-off low-risk demo only, the Render Blueprint includes the public Judge0 CE endpoint as a smoke-test default; its availability and limits are controlled by that shared service, so do not send secrets or confidential source to it and do not rely on it for a public production launch.
2. Confirm your provider's API origin, API token requirements, supported language IDs, network-isolation support, maximum submission size, and rate limits.
3. In Render environment variables, set:

```dotenv
JUDGE0_BASE_URL=https://YOUR-JUDGE0-HOST
JUDGE0_AUTH_TOKEN=YOUR_PROVIDER_TOKEN
JUDGE0_PYTHON_LANGUAGE_ID=71
JUDGE0_JAVASCRIPT_LANGUAGE_ID=63
EXECUTION_ENABLED=true
```

4. Confirm the language IDs with your provider. The shown defaults are common Judge0 IDs, not a promise that every deployment uses the same catalog.
5. Redeploy the Render service.
6. Sign in to ByteDock and open `/api/runtime/status` through the authenticated app. It should report that the provider is reachable.
7. Test Python, JavaScript, stdin, syntax errors, an infinite loop, oversized source, and a network request. Confirm that the provider enforces isolation and resource limits.

The backend requests a 2-second CPU budget, a 5-second wall-time budget, a 128 MB memory budget, capped output, and network disabled. Provider-side configuration must enforce the actual sandbox. Do not use a public shared endpoint for production merely because it responds to a test request.

## 6. Configure Nebius AI

The Render environment values must include `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, and `NEBIUS_MODEL`. Use the exact model ID displayed in your Token Factory account. The current integration uses an OpenAI-compatible Chat Completions request at `/chat/completions`.

Never set `NEBIUS_API_KEY` as a GitHub Actions variable or a `VITE_` variable. Frontend build-time variables are visible to website visitors.

## 7. Production smoke tests

After deployment:

1. `/api/health` returns healthy.
2. `/api/auth/config` reports auth enabled and required.
3. The deployed site shows the sign-in/create-account screen.
4. Create a test account and complete email verification if enabled.
5. Sign in and create `private-a.py` with unique text.
6. Open a second browser profile and sign in with a different account. Confirm it cannot see the first account's workspace.
7. Refresh the first profile and confirm its workspace persists.
8. Test AI with `Reply exactly: BYTEDOCK_AI_OK`.
9. Verify AI file context is absent from the `/api/ai/chat` request payload when **Include file** is unchecked, and present only when checked.
10. Test remote Python and JavaScript execution using your configured Judge0 endpoint.
11. Test rate limits, invalid/oversized input, timeout, and network restrictions.
12. Check browser DevTools and repository source to ensure no `sb_secret_`, Nebius key, Judge0 token, or service-role JWT appears in the frontend bundle or Git history.

## Troubleshooting

### Render says `vite: Permission denied`

The Render API service must not run `npm run build`. Confirm that the Render build command is `npm install --omit=dev --no-audit --no-fund` and the start command is `npm start`. GitHub Actions builds Vite for Pages.

### ByteDock says it cannot reach the API

Check that `VITE_API_BASE_URL` is a repository **Variable** and points to the Render origin without `/api`. Confirm Render is live and add the exact GitHub Pages origin to `CORS_ORIGIN`. Re-run the Pages workflow after changing the variable because Vite embeds it at build time.

### Account configuration is unavailable

Check `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY` on Render. Re-run the SQL schema and confirm Supabase Auth is enabled. A missing secret key prevents database storage from being available.

### Signup works but login does not

Check the Supabase email confirmation setting and verify the account email. Confirm the Site URL and Redirect URLs match the deployed Pages URL.

### AI returns 401/403, 404, 429, or connection errors

Check the key, model ID, account permissions/credits, Token Factory service availability, and backend outbound networking. The model ID must be one available to your Nebius account.

### Run is disabled

Production execution intentionally defaults to disabled. Configure a managed/private Judge0 provider, verify its sandbox configuration, set `EXECUTION_ENABLED=true`, and redeploy Render.

### Workspace saves but disappears

Confirm `storage: "supabase-postgres"` in `/api/health`, ensure the schema ran successfully, and inspect Render logs for Supabase REST errors. Do not rely on Render local JSON storage for public workspaces.
