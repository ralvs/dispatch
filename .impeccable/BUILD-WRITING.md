# Build brief — Pass 3, the writing surfaces

Paste the block below into a fresh Claude Code session at the repo root, on
branch `design/impeccable`. Everything it needs is on disk; it should not need
this file's prose.

**Passes 0–2 are landed** (`a1de3b0` → `07e448f`). This is the first pass whose
surfaces are not lists, and the first that has to answer a question the design
system has never stated: how wide a line of prose is allowed to be.

---

## The prompt

> Build **Pass 3 of the Dispatch refactor: the writing surfaces**, on branch
> `design/impeccable`. Three surfaces where the content is long-form text a
> person is reading or composing, rather than rows they are scanning.
>
> **Read first, in this order:**
> 1. `DESIGN.md` — the visual system. Accurate and normative. Note what it does
>    **not** contain: there is no rule about line length anywhere in it.
> 2. `docs/adr/0044-list-rows-rest-and-create-is-a-header-action.md` — Pass 2's
>    decisions. Two reach into this pass: **row names rest at 400**, and
>    **`/journal` is not an object-list**, so its standing form is correct and
>    stays. That half of Gate B is settled; apply it, do not re-open it.
> 3. `docs/adr/0009-notes-live-markdown-editing.md` and
>    `docs/adr/0012-notes-are-a-title-list-plus-editor-page.md` — the editing
>    semantics. **All of it is settled product behaviour**: live markdown
>    shortcuts, `tiptap-markdown` serializing to plain markdown stored verbatim
>    (iron rule #5), autosave debounced 2000ms, blur/unmount flush, the
>    "Saving… / Saved" meta line instead of a Save button, Resolve and Delete as
>    explicit buttons. This is a visual pass; none of that changes.
> 4. `components/ui/` as it stands: `PageHeader`, `PageSkeleton`, `SectionHead`,
>    `EmptyState`, `ListRow`, `Card`, `Button`, `Field`. Read the real APIs.
> 5. `docs/adr/0041-the-iron-rules.md` and `CONTEXT.md`. Terminology is
>    load-bearing; do not vary words for readability.
>
> **Scope:**
> - `app/(authed)/notes/[id]/` — 8 files, ~1,140 lines. The editor, its title,
>   the prose styles, the backlink and link panels, the two suggestion popovers
>   and the link picker.
> - `app/(authed)/journal/` — page, form, entry row.
> - `app/(authed)/chat/` — page, thread.
>
> **Out of scope:** `/settings`, `/more` and `components/capture-palette.tsx`
> (Pass 4). `/notes` the list, `/today`, `/tasks` and the eight list surfaces are
> done — do not redesign them.
>
> ---
>
> ## Phase 0 — one gate, two coupled axes
>
> The two open questions are the same question asked twice, so they get one lab
> and one decision. **Do not settle them separately** — a larger type scale
> demands a wider measure, and a narrow measure makes a large scale look
> cramped.
>
> ### Axis 1 — the measure
>
> `DESIGN.md` has no line-length rule. The Layout section describes a frame
> centred at `max-width: 72rem`, and on a list that is right: a row is a line of
> scannable fields that wants the width. **On a page of prose it is not.** At
> 1092px the note body currently runs the full frame — roughly 150 characters
> per line, about twice a comfortable measure.
>
> What exists today is ad hoc and inconsistent: `max-w-prose` appears on chat's
> assistant messages and on some link rows, and nowhere on the note body, which
> is the longest text in the app.
>
> Decide the measure, state it as a rule in `DESIGN.md`, and say what it applies
> to. The interesting part is **what the frame does with the leftover width** —
> a 65ch column inside a 72rem frame leaves a lot of ground, and left-aligned,
> centred, and column-plus-sidebar are three different pages. `/notes/[id]` has
> a natural candidate for that ground: the backlinks and Linked panels currently
> sit *below* the note, at full width.
>
> ### Axis 2 — the editor's type scale
>
> The note editor is the app's largest departure from the closed ramp
> (56/44/36/30/18/16/14/12):
>
> - The **note title** is `text-2xl` — 24px, not a ramp step — as a borderless
>   input at 500.
> - The **prose headings** are `[&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg`
>   — 24 / 20 / 18, of which only 18 is on the ramp.
>
> `DESIGN.md`'s Closed Ramp Rule says a new size is a signal the layout is too
> dense, and that a genuinely warranted step "lands here first and in the code
> second." Neither of these did. So either the editor moves onto the ramp, or
> the ramp gains a documented step for authored prose and says why — but the
> current state, three undocumented sizes in the one place the reader is looking
> hardest, is not an option.
>
> **A note's headings are content, not chrome**, and that may be the argument
> for a separate scale: `# ` in a markdown body is the writer's own hierarchy,
> not the app's. Make that case or reject it, in `DESIGN.md`.
>
> ### The third question, decidable in the same comps
>
> `/notes/[id]` has **no `PageHeader`**. It opens with a breadcrumb (`← Notes`
> in mono eyebrow) and the note's name is an editable input inside the editor.
> That may be exactly right — a page whose title is editable content cannot put
> that title in a static header, and Today already sets the precedent that a
> surface may decline the page header for a reason. But it is currently an
> inheritance, not a decision. Settle it: either the breadcrumb is the
> considered header for an editor page, or the editor gets a header and the
> title input becomes something else.
>
> ### The lab
>
> Draw **two or three static comps** in `.impeccable/mocks/`, following
> `.impeccable/mocks/README.md` conventions (shared `_a.css`, plus a
> `*.standalone.html` that inlines it). Desktop and phone, light and dark.
>
> Comp **`/notes/[id]` and `/chat` under each option**. The note with a real
> body — 400–600 words, two heading levels, a list, a task list, a code span, a
> blockquote — plus the backlinks and Linked panels populated, and the
> "Saving…" state visible. Chat with a four-turn exchange, one long assistant
> answer, and the composer.
>
> Then **stop and show me.** Do not build past this line until I pick.
>
> ---
>
> ## Phases 1–4 — after I pick
>
> Commit at the end of each phase; do not bundle them.
>
> 1. **The measure and the type scale, as tokens and as `DESIGN.md` text.**
>    Whatever the gate decided, it lands in the system before it lands in three
>    files, so the next surface inherits it rather than copying it.
>
> 2. **`/notes/[id]`.** The editor, the title, the prose styles, and the panel
>    layout. Specifics that are already wrong and are yours to fix:
>    - The prose style string carries the comment *"matching the app's serif
>      headings."* There has been no serif since Pass 0. The comment and the
>      styling both need to say what is actually true.
>    - **Resolve and Delete are hand-rolled** `rounded-control border …` strings
>      rather than `Button`. They are the last two in the app.
>    - The **backlinks and Linked group labels** are two of the last eight mono
>      eyebrow group labels; Pass 2 moved group labels to `SectionHead`.
>    - The link rows use `type-title text-sm` for names. ADR-0044 rested row
>      names at 400 — these are rows.
>    - `EditorFallback` and `LinkSectionsFallback` are hand-built skeletons that
>      must still match whatever the panels become.
>
> 3. **`/chat`.** Two things are inverted here, and the Named vs Labelled Rule
>    is what names them:
>    - The **user's own message** renders `font-mono text-sm text-ink-2`,
>      right-aligned — the *labelled* register, which DESIGN.md reserves for what
>      the system labelled. A person wrote it.
>    - The **assistant's answer** renders `type-title text-base` — 500, the
>      register for a name a person gave something. It is running prose, and
>      after ADR-0044 nothing in a list rests at 500; a paragraph should not
>      either.
>
>    Decide the two registers deliberately — a chat has a real need to
>    distinguish speakers — but not by giving a person's words the machine voice
>    and the machine's words the human one. The **Send** button is hand-rolled
>    and should be a `Button`.
>
> 4. **`/journal`, then sweep.** The standing `JournalForm` **stays** — ADR-0044
>    settled that writing the entry is the page. What changes: the date group
>    label is a hand-rolled mono line and should be `SectionHead`, the entry row
>    should sit on `ListRow` with a rested title, and the form itself should
>    carry whatever measure the gate decided, since an entry is prose being
>    written. Then screenshot all three surfaces in both themes at both widths,
>    plus `/notes` and `/today` to confirm nothing moved under them, and update
>    `DESIGN.md`.
>
> ---
>
> **Constraints that outrank everything above:**
> - The six iron rules (ADR-0041). **Iron rule #5 is the live one here:** content
>   is stored verbatim in the language written and is never translated. UI chrome
>   is English; a note, an entry, a quote and a chat message are not chrome.
> - **Do not touch the autosave layer.** `lib/debounced-save.ts`, the 2000ms
>   debounce, the blur/unmount flush, and the markdown serialization are
>   behaviour with their own tests. If a visual change seems to require
>   restructuring them, stop and say so.
> - **Do not touch the TipTap extensions.** `mention-extension.ts`,
>   `wikilink-extension.ts` and their suggestion popovers carry ADR-0030's
>   mention contract and the wikilink resolution. Restyling the popovers is in
>   scope; changing what they match or emit is not.
> - **Do not redesign `/today`, `/tasks` or the list surfaces.**
> - **Mobile is a responsive layer, not a fork.** One component tree.
> - **Do not "fix" the `--ink-3` / `--ink-4` contrast** (`DESIGN.md`, "The
>   Recorded Contrast Tradeoff").
> - Compose `components/ui/` primitives; no raw hex in app code; Lucide only;
>   honour `prefers-reduced-motion`.
> - Biome lint, Biome format and `tsc --noEmit` clean before every commit.
>   Conventional commits.
>
> **Verify in the browser, not by assertion.** Use the `dispatch` entry in
> `.claude/launch.json`.
>
> Do not merge to `main`. The branch merges in one go when all five passes land.

---

## Why this pass is not just three more surfaces

Passes 0–2 refined one object — a page of rows — until it was consistent
fourteen times over. Nothing they settled says anything about a paragraph. The
measure, the scale of authored headings, and the distinction between a person's
words and the system's are all first questions here, and all three are on the
surfaces where the reader is looking hardest and longest.

The two axes are one gate on purpose. Line length and type size are the same
decision viewed from two sides: 65 characters at 16px and 65 characters at 20px
are different pages, and picking either alone guarantees rework of the other.

## What the gate is not allowed to reopen

`/journal`'s standing form. ADR-0044 already ruled that writing the entry is the
page rather than a create action beside a list, which is the same reasoning that
deleted the capture line from `/tasks` — applied in the opposite direction
because the surfaces differ. Pass 3 applies that half; it does not re-argue it.

## After this pass

**Pass 4 — `/settings`, `/more`, `components/capture-palette.tsx`.** Forms and a
menu, low risk, and the last five mono eyebrow group labels. It is also the
point at which `.type-title` can be looked at as a whole: Pass 2 shrank it off
list rows, Pass 3 takes it off the editor title and chat prose, and what remains
after that is forms, `/sign-in` and the capture palette — few enough to decide
whether the class still earns its name.
