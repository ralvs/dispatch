/*
 * Today's own stylesheet: the handful of things Tailwind utilities cannot
 * express here, and nothing else. Everything with a fixed size, colour or
 * spacing stays in utilities on the components.
 *
 * Three jobs:
 *
 *  1. The stack. Desktop is two columns; the phone is one, reordered
 *     orientation-first. That is ONE tree — `display: contents` dissolves the
 *     column wrappers below `lg` and `order` re-sequences the same sections.
 *     There is no <MobileToday>, and there must never be one.
 *  2. The day tape. Blocks are positioned by percentage of the window, which
 *     is per-render arithmetic, not a utility.
 *  3. The one authored moment: the tape assembling on load.
 *
 * The `lg` breakpoint here is 64rem, matching Tailwind's — the header/dock
 * swap at the same line, so the page never sits between two compositions.
 */
const TODAY_CSS = `
/* ── the stack ─────────────────────────────────────────────────────── */
.t-cols {
	display: flex;
	flex-direction: column;
	gap: 34px;
}
/* The two column wrappers stop existing on a phone, so their children become
   direct flex items and "order" can re-sequence across both of them. */
.t-cols > .t-col {
	display: contents;
}
.t-sec-top3 { order: 1 }
.t-sec-timeline { order: 2 }
.t-sec-open { order: 3 }
.t-sec-routines { order: 4 }
.t-sec-projects { order: 5 }
.t-sec-quote { order: 6 }

@media (min-width: 64rem) {
	.t-cols {
		display: grid;
		grid-template-columns: 1.5fr 1fr;
		gap: 40px;
		align-items: start;
	}
	.t-cols > .t-col {
		display: block;
		min-width: 0;
	}
	.t-col-main > * + * { margin-top: 40px }
	.t-col-side > * + * { margin-top: 16px }
}

/* Stepping a day dims only what the day owns. The header, counters, routines,
   projects and the quote are today's regardless of where the nav is, so they
   must not flicker when it moves. */
.t-day-owned {
	transition: opacity 0.18s ease;
}
[data-pending="true"] .t-day-owned {
	opacity: 0.55;
}

/* ── the day tape ──────────────────────────────────────────────────────
 * A proportional measure of the day: committed time is a filled block in its
 * domain colour, free time is empty, and the now-mark carries its own hour.
 *
 * Titles never go inside the blocks. At 1092px the tape runs 1.14px/min, so a
 * 30-minute meeting is 34px against the 141px its title needs — evidence in
 * .impeccable/mocks/tape-lab.html. Start times ride above the track instead,
 * and every title lives in the Timeline list directly below.
 */
.t-tape-times {
	position: relative;
	height: 16px;
	margin-bottom: 5px;
}
.t-tape-times > span {
	position: absolute;
	transform: translateX(-1px);
	font-family: var(--font-mono);
	font-size: 11px;
	color: var(--ink-3);
	white-space: nowrap;
}
.t-track {
	position: relative;
	height: 46px;
	background: var(--surface-2);
	border-radius: 12px;
}
/* top/height come from the block: events that overlap in time split the track
   into rows rather than drawing over one another. A day with no double-booking
   sets one row and the block fills the track exactly as before. */
.t-blk {
	position: absolute;
	top: 0;
	height: 100%;
	min-width: 7px;
	border-radius: 8px;
}
/* A scheduled task is a point in time, not a span: an outlined tick that still
   carries its own domain colour. The shape is what tells you which is which. */
.t-blk[data-kind="task"] {
	background: transparent;
	border: 2px solid currentColor;
	min-width: 9px;
}
.t-now {
	position: absolute;
	top: -6px;
	bottom: -6px;
	width: 2px;
	background: var(--ink);
	border-radius: 2px;
	z-index: 3;
}
/* Hover scrub: quieter than the now-mark (1px ink-3, no weight), and pointer-
   events none so it never steals the next move. Its label sits on the ruler
   below the track with the other clock readings — above the track is the
   events' own start times — and any hour it lands on gives way. Fine-pointer
   only, and gated in one place: the component sets the scrub for pointerType
   "mouse" alone, so on touch there is nothing to draw and no hour is displaced.
   A finger scrub would fight scroll and earn nothing. */
.t-hover {
	position: absolute;
	top: -4px;
	bottom: -4px;
	width: 1px;
	background: var(--ink-3);
	z-index: 2;
	pointer-events: none;
}
.t-ticks {
	position: relative;
	margin-top: 9px;
	height: 16px;
}
.t-ticks > span {
	position: absolute;
	font-family: var(--font-mono);
	font-size: 12px;
	color: var(--ink-4);
	transform: translateX(-50%);
	font-variant-numeric: tabular-nums;
}
.t-ticks > span[data-edge="start"] { transform: none }
.t-ticks > span[data-edge="end"] { left: auto; right: 0; transform: none }
.t-ticks > span[data-now] {
	color: var(--ink);
	font-weight: 500;
	transform: translateX(-50%);
}
/* The scrub reading: same row and same rhythm as the ruled hours, one step
   quieter than the now-label because it is only where the pointer is. */
.t-ticks > span[data-hover] {
	color: var(--ink-3);
	pointer-events: none;
}

/* At 393pt the tape runs 0.37px/min: a 30-minute meeting is 11px, and the
   per-block start times above the track would overlap two-deep. They go, and
   the ruler thins to its ends plus one landmark. The proportion, the domain
   colours and the outlined task tick are the desktop object untouched. */
@media (max-width: 63.99rem) {
	.t-tape-times { display: none }
	.t-track { height: 40px; border-radius: 11px }
	.t-blk { border-radius: 4px }
	.t-now { top: -5px; bottom: -5px }
	.t-ticks { margin-top: 8px; height: 15px }
	.t-ticks > span { font-size: 11px }
	.t-ticks > span[data-keep="false"] { display: none }
}

/* ── the one authored moment ───────────────────────────────────────────
 * The tape assembles: blocks wipe out from their own start edge, left to
 * right in clock order, and the now-mark drops in last. The resting state is
 * the default, so this only ever plays where motion is welcome.
 */
@media (prefers-reduced-motion: no-preference) {
	.t-blk {
		animation: t-wipe 0.62s cubic-bezier(0.16, 1, 0.3, 1) backwards;
	}
	.t-now {
		animation: t-drop 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.62s backwards;
	}
	.t-ticks > span[data-now] {
		animation: t-drop-label 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.68s backwards;
	}
	@keyframes t-wipe {
		from { clip-path: inset(0 100% 0 0) }
		to { clip-path: inset(0 0 0 0) }
	}
	@keyframes t-drop {
		from { opacity: 0; transform: translateY(-6px) }
	}
	/* the label already carries translateX(-50%); keep it inside the frames */
	@keyframes t-drop-label {
		from { opacity: 0; transform: translateX(-50%) translateY(-6px) }
		to { transform: translateX(-50%) translateY(0) }
	}
}
`;

export function TodayStyles() {
	return <style>{TODAY_CSS}</style>;
}
