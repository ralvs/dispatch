# Migrations apply on merge

Date: 2026-09-23

Until now a migration reached production by hand: `supabase db push`, or the
Supabase MCP tool's `apply_migration`. The MCP tool stamps its own version, so
17 migrations sat in the production history table under versions that no file
in the repo had. The SQL was identical in all 17 (compared on 2026-09-23), so
the history rows were renumbered to the file versions, once, by SQL. After
that, the repo and production agree, and `supabase db push` can run unattended.

## Decisions

1. **`Migrate` applies new migrations after every merge to `main`.**
   `.github/workflows/migrate.yml` runs `supabase db push`, which applies only
   the files whose version the history table lacks. A merge without a
   migration is a quick no-op. It connects through the session pooler URL in
   the `SUPABASE_DB_URL` secret: runners have no IPv6, and the direct database
   host is IPv6 only. Only `main` ever sees that secret.
2. **The code waits for the schema.** Vercel's Deployment Checks hold the
   production deploy until `Migrate` is green, so new code never goes live
   before its columns exist. A failed migration keeps the old deploy live.
3. **`Migrations` guards the files on every PR**, with no secret
   (`scripts/check-migrations.ts`, required on `main` by ADR-0064):
   - An applied migration is never edited, renamed or deleted. `db push` would
     skip the change silently: `20260714194155_schema.sql` was edited in July
     and still differs from what ran. Fix forward with a new migration.
   - A new file sorts after the newest one on the base branch. `db push`
     refuses a version older than the newest one applied.
4. **Nobody applies a migration by hand any more** — not with the CLI, and not
   with the MCP tool's `apply_migration`. Local work uses `supabase db reset`.

## Consequences

- A migration must work with the code that is live while it runs. The old
  deploy keeps serving until the new one passes its checks. Add first; drop
  a column only in a later PR, after no live code reads it.
- A failed `Migrate` leaves `main` ahead of production. Fix it with a new PR,
  or re-run the job from the Actions tab (`workflow_dispatch`).
- This is not an iron rule #6 action. It changes the schema, not the owner's
  data, and its record is the workflow run.
