# Main takes squash-merged PRs only

Date: 2026-09-23

Dispatch moved from local merges to pull requests (the first stack was #36 →
#40). Every change now reaches `main` through a PR that Renan merges. There was
no CI: the only PR checks came from Vercel, and nothing stopped a direct push
to `main`. The shape is copied from `pingdotgg/t3code`, cut down to what a
one-person repo needs.

## Decisions

1. **The repo is public, for the ruleset.** GitHub refuses branch protection
   and rulesets on a private repo on the free plan (HTTP 403). Public gets
   both, and free Actions minutes. The cost is that the code, the docs and
   every commit are readable by anyone. gitleaks found no secret in the 604
   commits before the switch. The docs name the owner and the life domains
   (CONTEXT.md); no row from the database is in the repo. The external routes
   stay safe because each one checks a secret (iron rule #2).
2. **Squash is the only merge method.** One PR becomes one commit on `main`,
   titled with the PR title and `(#n)`. The PR title must therefore be a
   Conventional Commit; `PR title` checks it. Small commits inside a PR stay
   on the PR page.
3. **The ruleset on `main`** blocks deletion and force pushes, requires a PR,
   allows squash only, and requires five checks by name:
   - `Check` — `.github/workflows/ci.yml`, runs `bun run check`.
   - `PR title` — `.github/workflows/pr-title.yml`.
   - `Vercel` — the preview deploy built.
   - `Region` — every function in the deploy runs in `gru1` (ADR-0062).
   - `Migrations` — the migration files are safe to apply on merge (ADR-0065).
   Checks are not strict: a PR does not need a rebase each time `main` moves.
   No one bypasses the ruleset. In an emergency, Renan turns it off in
   Settings → Rules.

## Consequences

- A renamed job silently blocks every PR, because the ruleset waits for the
  old name. Rename a job and the ruleset together.
- `Region` reports only after a successful Vercel deploy. A PR whose preview
  does not deploy cannot merge.
- Workflows use `pull_request`, never `pull_request_target`, and pass PR text
  through `env:`. Fork PRs need approval before their workflows run.
- Stacks: `gh stack merge` squash-merges the whole stack at once. After a
  single squash merge, the next branch still holds the unsquashed commits.
  Rebase it before it merges: `gh stack rebase` (after `gh stack checkout`),
  or `git rebase --onto origin/main <old-bottom-branch> <next-branch>` if
  that stops on the squashed commits.
