# Header facts are not counts, and sections share one rhythm

Pass 4.5 (`.impeccable/BUILD-SYSTEM.md`, gate lab
`.impeccable/mocks/system-lab.html`) closed two system-wide questions that no
route pass owned: what the page header's measure may carry, and how much space
sits between peer sections.

## Gate A — measure vs facts

**Chosen: option A — a second reading type.**

`PageHeader` gains `facts?: ReactNode[]`, rendered plain at 14px / `ink-3` with
no tabular-nums, **before** the measure on the title's baseline.

- **Measure** stays what ADR-0042 defined: a figure and the word it counts
  (tabular-nums, figure medium at `ink-2`).
- **Facts** are identity attributes that are not quantities — project type and
  status, person relationship and company.

The defect this closes: both detail pages had been stuffing attributes into
`Measure` with an empty `label`, so words like `Internal` and an employer name
rendered in the numeral treatment with a label-less gap. Option B (push every
attribute into the Details card and leave the measure as counts only) was the
lab recommendation and lost: the owner wanted those attributes on the title line
without abusing the count slot.

## Gate B — section rhythm

**Chosen: option 1 — the doc wins.**

Peer sections share **36px** (`mt-9`). Detail pages no longer use 56px
(`mt-14`) between major blocks; list pages leave 32px (`mt-8`) for the same
band. The first section after `PageHeader` carries no top margin — the header
already owns that gap.

Clarify a sentence that was ambiguous in `DESIGN.md`: the **64px under the
header** is `AppHeader`'s `mb-16`, not `PageHeader`'s bottom margin
(`mb-[26px] lg:mb-[30px]`).

Option 2 (name the three-tier scale the tree was already using) and option 3
(`PageBody` owns gap, delete `first:mt-*`) were not taken. Call sites still set
`mt-9` / `first:mt-0` by hand.

## Out of scope for this ADR

- The More menu desktop `max-h` reset, the pending-dimming rule, and the two
  efficiency leave-alones shipped in the same pass without a gate.
- Today's internal grid spacing remains its own composition.
