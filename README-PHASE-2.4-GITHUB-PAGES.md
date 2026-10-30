# Phase 2.4 deployment notes (superseded)

This historical note is retained for continuity. Its earlier warning about shared JSON workspace storage is superseded by the current Supabase per-user workspace implementation.

Use the current consolidated guides instead:

- [Deployment guide](DEPLOYMENT.md)
- [Complete phase map](PHASES-AND-SUBPHASES.md)
- [Release checklist](RELEASE-CHECKLIST.md)

The production architecture is GitHub Pages for the static React/Vite frontend, Render for the Node API, Supabase Auth/Postgres for user accounts and isolated workspaces, Nebius Token Factory for AI, and a configured managed/private Judge0 endpoint for remote execution. Production execution remains disabled until the operator configures and verifies that execution service.
