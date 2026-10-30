# ByteDock release checklist

Use this as the final submission validation record. Do not mark external-provider checks complete until they have been run against the deployed accounts.

## A. Source and build

- [ ] `npm install` completes on Node.js 20+.
- [ ] `npm test` passes.
- [ ] `npm run build` passes locally or in GitHub Actions.
- [ ] `.env` is not tracked by Git (`git status --short` and `git check-ignore .env`).
- [ ] The built `dist/` contains no Nebius, Supabase secret, or Judge0 private key.

## B. Supabase and accounts

- [ ] `database/supabase-schema.sql` executed without errors.
- [ ] Supabase Auth Site URL and Redirect URLs match the GitHub Pages address.
- [ ] Render `/api/auth/config` reports `enabled: true` and `required: true`.
- [ ] New user can sign up and verify email if confirmation is enabled.
- [ ] User can sign in, refresh the page, and remain signed in.
- [ ] User can sign out and sign back in.
- [ ] User A creates a private test file; User B cannot see or overwrite it.
- [ ] User A's workspace persists after reload and a new browser session.

## C. Nebius AI

- [ ] Render has the correct `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, and `NEBIUS_MODEL`.
- [ ] `/api/ai/status` reports configured without exposing the key.
- [ ] Prompt `Reply with exactly: BYTEDOCK_AI_OK` gets an actual provider response.
- [ ] A coding prompt returns code and a useful explanation.
- [ ] Multiple-turn conversation recalls a prior test string.
- [ ] With Include file unchecked, DevTools Network payload has no active file wrapper or file contents.
- [ ] With Include file checked, only the current active-file snapshot is included.
- [ ] Invalid key, unavailable model, quota/rate-limit, and provider outage show understandable errors.

## D. Remote execution

- [ ] Managed/private Judge0 endpoint configured and documented.
- [ ] Provider confirms sandbox isolation, network restrictions, and resource caps.
- [ ] `EXECUTION_ENABLED=true` only after the provider configuration is validated.
- [ ] `/api/runtime/status` reports provider reachable.
- [ ] Python `print('ByteDock Python OK')` returns expected output.
- [ ] JavaScript `console.log('ByteDock JS OK')` returns expected output.
- [ ] stdin is passed to a program using `input()` / stdin.
- [ ] Syntax error returns an error, not a crashed API.
- [ ] Infinite loop is stopped by the provider limit.
- [ ] Network access attempt fails in the sandbox.
- [ ] Oversized source/stdin, rate limits, and concurrency caps are enforced.

## E. GitHub Pages and Render

- [ ] Render Blueprint created with the production API build/start commands.
- [ ] Render `/api/health` returns `ok: true` and `storage: "supabase-postgres"`.
- [ ] `CORS_ORIGIN` contains the site origin only, no repository path.
- [ ] GitHub variable `VITE_API_BASE_URL` points to the Render origin without `/api` or trailing slash.
- [ ] Repository Pages source is GitHub Actions.
- [ ] GitHub Actions build and deploy both succeed.
- [ ] Project-site assets load from `https://USERNAME.github.io/REPOSITORY/`.
- [ ] Frontend can reach backend without CORS errors.
- [ ] Render service stays online under the selected plan.

## F. Submission evidence

Capture screenshots of:

- [ ] ByteDock editor with project files open.
- [ ] AI Agent model response from live Nebius.
- [ ] Successful Python execution output.
- [ ] Successful JavaScript execution output.
- [ ] Account sign-in screen or signed-in workspace.
- [ ] GitHub Pages deployed website.
- [ ] GitHub Actions successful deployment.
- [ ] Render healthy service status.

## Current automated checks in this source archive

The included `npm test` runs backend integration smoke tests against mock Nebius and Judge0-compatible services. It does not contact or validate the actual user's external accounts. The test output and exact limitations should be included honestly in any evaluator-facing report.
