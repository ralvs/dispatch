# Today becomes a two-column Briefing; cadence and skips derive from existing data

The Today page moves from a single stacked column to the reference
implementation's "The Briefing" editorial layout: masthead with ISO-week
dateline and unread-notifications badge, a one-sentence commitments anchor,
an accent-bordered inbox strip, a `1.5fr/1fr` desktop grid (left: "In brief"
domain-cadence rows, Resurfaced + Latest quote cards, currently reading;
right: today's events, Doing task rail, bucketed routines, projects, health),
and capture chips. Mobile stacks in the same order. The shared authed `main`
widens from `lg:max-w-4xl` to `lg:max-w-6xl` — other pages stay single-column
and tolerate the extra width. Dispatch also adds right-rail widgets the
reference doesn't have: active projects with milestone progress, health at a
glance, and currently-reading books.

Two derivations deviate from the reference and are the point of this ADR:

**Brief-line cadence needs no schema.** The reference models cadence as
first-class fields; Dispatch already stores everything required:
`stewardship_domains.failure_patterns` jsonb carries numeric rules
(`{"rule":"no_activity_days","value":7}` / `days_since_journal`), and last
touch is the most recent of `last_shipped_at` and the domain's latest
completed task (`lastCompletedByDomain`, one bounded query). A domain
surfaces once days-since-touch reaches 75% of its threshold and is "slipping"
past 100% (`deriveBriefLines` in `lib/services/briefing.ts`). Domains without
a numeric rule, and the system Inbox domain, simply have no brief line —
malformed jsonb degrades to absence, never an error. Adding a dedicated
`cadence_days` column was rejected as a redundant second source of truth
unless cadence ever becomes numerically editable in the domains UI.

**Resurfaced skips are DB-backed, not a cookie.** The reference stores
"Next →" skips in a cookie; Dispatch records them as
`resurfacing_seen (item_type='quote', surfaced_on=today,
user_response='dismissed')` rows — the table already existed for exactly this
shape. Skips follow the account across devices (this is a PWA installed on
several), Reset deletes today's dismissed rows, and `pickResurfaced` advances
deterministically from the same daily hash `quoteOfDay` uses, wrapping past
skipped ids and returning null (an "exhausted" card state) when everything
has been skipped today. The unique `(item_type, item_id, surfaced_on)`
constraint makes re-skips idempotent.
