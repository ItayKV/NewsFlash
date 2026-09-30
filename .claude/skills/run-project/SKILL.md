---
name: run-project
description: Launches The Daily Web locally — checks for and applies database migrations (placeholder until a migration system exists), installs npm dependencies, then starts the dev server. Use when asked to run, start, launch, boot up, or spin up this project.
---

# Run Project

Launch The Daily Web locally, in this order. Run each step with the Bash or PowerShell tool and stop to report if a step fails (don't silently continue past an error).

## 1. Check for and run DB migrations (placeholder)

No migration tooling exists in this project yet, so this step is currently a no-op:

- Check whether a `migrate` script exists in [package.json](../../../package.json) (`npm run migrate` script) or a `data/migrations/` directory exists.
- If neither exists yet: skip this step silently — there is nothing to migrate against an empty database.
- If either exists in the future: run `npm run migrate` (or the equivalent) before continuing, and surface its output. Stop here if it fails rather than starting the server against an unmigrated schema.

## 2. Install dependencies

```
npm install
```

## 3. Start the dev server

```
npm run dev
```

This runs `nodemon server.js` (see [server.js](../../../server.js)), which starts Express and attempts the MongoDB connection non-blockingly — the server is reachable at `http://localhost:3000` (or `$PORT`) even before/without a Mongo connection succeeding.

Run this as the final step; since it's a long-running dev server, launch it in the background (or hand off to the user) rather than blocking on it.
