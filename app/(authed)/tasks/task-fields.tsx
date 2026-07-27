"use client";

import { useState } from "react";
import { shiftDay } from "@/lib/dates";
import { RECURRENCE_LABELS, RECURRENCE_PATTERNS } from "@/lib/recurrence";

export type TaskDomainOption = {
	id: string;
	name: string;
	color: string | null;
};

/**
 * Native date/time inputs paint the browser's own `mm/dd/yyyy` / `--:-- --`
 * skeleton at full ink weight, so an empty field shouts as loudly as a filled
 * one and the picker glyph sits there at full brightness. CSS has no "this
 * date input is empty" selector, so emptiness is tracked in React and handed
 * to the stylesheet as `data-empty` — an untouched field then reads like every
 * other placeholder in the app instead of like an answer.
 */
const FIELD_CSS = `
.tf-native::-webkit-calendar-picker-indicator {
	opacity: 0.4;
	cursor: pointer;
	transition: opacity 120ms ease;
}

.tf-native:hover::-webkit-calendar-picker-indicator,
.tf-native:focus::-webkit-calendar-picker-indicator {
	opacity: 0.85;
}

/* The colour has to be set on each sub-field: setting it on the container
   pseudo-element alone does not cascade into them. */
.tf-native[data-empty="true"]::-webkit-datetime-edit,
.tf-native[data-empty="true"]::-webkit-datetime-edit-text,
.tf-native[data-empty="true"]::-webkit-datetime-edit-day-field,
.tf-native[data-empty="true"]::-webkit-datetime-edit-month-field,
.tf-native[data-empty="true"]::-webkit-datetime-edit-year-field,
.tf-native[data-empty="true"]::-webkit-datetime-edit-hour-field,
.tf-native[data-empty="true"]::-webkit-datetime-edit-minute-field,
.tf-native[data-empty="true"]::-webkit-datetime-edit-ampm-field {
	color: var(--ink-4);
}
`;

/** Label always stacks above its control (block, not inline beside). */
const FIELD_LABEL = "block font-mono text-eyebrow uppercase text-ink-3";
/** One height, one radius, one focus treatment for every control in the row. */
const CONTROL =
	"h-9 rounded-md border border-line bg-surface px-2.5 text-sm text-ink outline-none transition-colors hover:border-line-strong focus:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent";
/**
 * Borderless on purpose: five bordered boxes in a row (date, time, and three
 * shortcuts) read as five equal controls. The shortcuts are a shortcut to the
 * field beside them, so they keep the hit area and drop the chrome.
 */
const CHIP =
	"h-9 rounded-md px-2 font-mono text-eyebrow uppercase text-ink-3 transition-colors hover:bg-surface hover:text-ink";
const CHIP_ON = "bg-accent-bg text-accent-ink hover:bg-accent-bg hover:text-accent-ink";

/** What a due date actually gets set to, nine times out of ten. */
const RELATIVE_DAYS = [
	{ label: "Today", days: 0 },
	{ label: "Tomorrow", days: 1 },
	{ label: "+1 week", days: 7 },
] as const;

export const PRIORITIES = [
	{ value: 1, label: "P1", title: "Critical" },
	{ value: 2, label: "P2", title: "High" },
	{ value: 3, label: "P3", title: "Normal" },
	{ value: 4, label: "P4", title: "Someday" },
] as const;

/**
 * Only the chosen priority carries colour — an unselected scale in four
 * colours shouts before an answer exists — and selection is marked by a rule
 * in that colour rather than a filled cell, which reads as disabled at P4.
 * Full class strings so Tailwind can see the peer-checked variants.
 */
const PRIORITY_CELL: Record<number, string> = {
	1: "peer-checked:text-error",
	2: "peer-checked:text-warning",
	3: "peer-checked:text-accent-ink",
	4: "peer-checked:text-ink-2",
};

const PRIORITY_BADGE: Record<number, string> = {
	1: "text-error border-error/40",
	2: "text-warning border-warning/40",
	3: "text-accent-ink border-accent/40",
	4: "text-ink-4 border-line",
};

const PRIORITY_META: Record<number, { label: string; title: string }> = {
	1: { label: "P1", title: "Critical" },
	2: { label: "P2", title: "High" },
	3: { label: "P3", title: "Normal" },
	4: { label: "P4", title: "Someday" },
};

function priorityMeta(priority: number) {
	return PRIORITY_META[priority] ?? PRIORITY_META[4];
}

/** Compact P-badge for task rows (tasks list + today). */
export function PriorityBadge({
	priority,
	className = "",
}: {
	priority: number;
	className?: string;
}) {
	const meta = priorityMeta(priority);
	const tone = PRIORITY_BADGE[priority] ?? PRIORITY_BADGE[4];
	return (
		<span
			title={meta.title}
			className={`inline-block shrink-0 rounded border px-1 py-px font-mono text-[10px] leading-none tabular-nums tracking-wide ${tone} ${className}`}
		>
			{meta.label}
		</span>
	);
}

export type TaskFieldDefaults = {
	title?: string;
	notes?: string | null;
	due_date?: string | null;
	due_time?: string | null;
	/** null = the task is unfiled; undefined = no task yet (create form). */
	domain_id?: string | null;
	priority?: number;
	recurrence_rule?: string | null;
};

/**
 * The title line on its own — a display-weight field with a hairline under it.
 * Empty, the placeholder drops to normal weight so it reads as instruction
 * rather than as a heading someone already wrote.
 */
export function TaskTitleField({
	defaultValue = "",
	placeholder = "What needs doing?",
}: {
	defaultValue?: string;
	placeholder?: string;
}) {
	return (
		<input
			name="title"
			required
			defaultValue={defaultValue}
			placeholder={placeholder}
			aria-label="Task title"
			className="w-full border-b border-line bg-transparent pb-1.5 font-serif text-base text-ink outline-none placeholder:font-normal placeholder:text-ink-4"
		/>
	);
}

/**
 * When the task is due, where it files, whether it repeats, how much it
 * matters — four groups on one horizontal rhythm, every control the same
 * height. Due date and time share a group because they answer one question;
 * the relative chips are the fast path, the date field the exact one.
 */
export function TaskMetaFields({
	domains,
	todayIso,
	defaults = {},
}: {
	domains: TaskDomainOption[];
	/** App-timezone today (docs/adr/0002) — never `new Date()` in the browser. */
	todayIso: string;
	defaults?: TaskFieldDefaults;
}) {
	const [due, setDue] = useState(defaults.due_date ?? "");
	const [time, setTime] = useState(defaults.due_time ? defaults.due_time.slice(0, 5) : "");

	return (
		// Two deliberate rows rather than one that happens to wrap: "when" is
		// wide (a date, a time, three shortcuts), "where/how often/how much"
		// are three narrow answers that line up under it.
		<div className="space-y-4">
			<style>{FIELD_CSS}</style>

			<div className="min-w-0">
				<span className={FIELD_LABEL}>Due</span>
				<div className="mt-1 flex flex-wrap items-center gap-1.5">
					<input
						type="date"
						name="due_date"
						value={due}
						data-empty={due === ""}
						onChange={(event) => setDue(event.target.value)}
						aria-label="Due date"
						className={`tf-native ${CONTROL} w-[9.5rem]`}
					/>
					<input
						type="time"
						name="due_time"
						value={time}
						data-empty={time === ""}
						onChange={(event) => setTime(event.target.value)}
						aria-label="Due time"
						className={`tf-native ${CONTROL} w-[7.5rem]`}
					/>
					{RELATIVE_DAYS.map(({ label, days }) => {
						const target = shiftDay(todayIso, days);
						const on = due === target;
						return (
							<button
								key={label}
								type="button"
								aria-pressed={on}
								onClick={() => setDue(on ? "" : target)}
								className={`${CHIP} ${on ? CHIP_ON : ""}`}
							>
								{label}
							</button>
						);
					})}
				</div>
			</div>

			<div className="flex flex-wrap items-start gap-x-6 gap-y-4">
				<label className="block min-w-0">
					<span className={FIELD_LABEL}>Domain</span>
					{/* No color dot on <option> — styling native option elements is
					    unreliable cross-browser, so this stays a plain name list. */}
					<select
						name="domain_id"
						defaultValue={defaults.domain_id ?? ""}
						className={`${CONTROL} mt-1 block w-[11rem] max-w-full`}
					>
						{/* "Unfiled" is offered only when it is already the answer — on the
						    create form (undefined) or for a task sitting in the inbox (null).
						    A filed task never sees it, which is what keeps filing one-way
						    (docs/adr/0025). It also has to be listed in the inbox case, or
						    the <select> would drop its own value and silently reassign the
						    task to whichever domain sorts first. */}
						{defaults.domain_id == null && <option value="">Unfiled</option>}
						{domains.map((d) => (
							<option key={d.id} value={d.id}>
								{d.name}
							</option>
						))}
					</select>
				</label>

				<label className="block min-w-0">
					<span className={FIELD_LABEL}>Repeats</span>
					<select
						name="recurrence_rule"
						defaultValue={defaults.recurrence_rule ?? ""}
						className={`${CONTROL} mt-1 block w-[11rem] max-w-full`}
					>
						<option value="">Never</option>
						{RECURRENCE_PATTERNS.map((p) => (
							<option key={p} value={p}>
								{RECURRENCE_LABELS[p]}
							</option>
						))}
					</select>
				</label>

				<PriorityPicker defaultValue={defaults.priority ?? 4} />
			</div>
		</div>
	);
}

/**
 * Title + optional notes + the meta row — the full surface, used by the edit
 * form on a task row. The create path composes the pieces itself, so the
 * capture line never renders a second title field.
 */
export function TaskFormFields({
	domains,
	todayIso,
	defaults = {},
	titlePlaceholder = "What needs doing?",
	showNotes = false,
}: {
	domains: TaskDomainOption[];
	todayIso: string;
	defaults?: TaskFieldDefaults;
	titlePlaceholder?: string;
	showNotes?: boolean;
}) {
	return (
		<>
			<TaskTitleField defaultValue={defaults.title ?? ""} placeholder={titlePlaceholder} />

			{showNotes && (
				<label className="block">
					<span className={FIELD_LABEL}>Notes</span>
					<textarea
						name="notes"
						rows={2}
						defaultValue={defaults.notes ?? ""}
						className={`${CONTROL} mt-1 block h-auto w-full py-1.5`}
					/>
				</label>
			)}

			<TaskMetaFields domains={domains} todayIso={todayIso} defaults={defaults} />
		</>
	);
}

/** Segmented priority control — radio group, colour reserved for the answer. */
export function PriorityPicker({ defaultValue = 4 }: { defaultValue?: number }) {
	return (
		<fieldset className="block min-w-0">
			<legend className={FIELD_LABEL}>Priority</legend>
			<div
				className="mt-1 inline-flex h-9 overflow-hidden rounded-md border border-line"
				role="radiogroup"
				aria-label="Priority"
			>
				{PRIORITIES.map((p, i) => (
					<label
						key={p.value}
						title={p.title}
						className={`relative cursor-pointer ${i > 0 ? "border-l border-line" : ""}`}
					>
						<input
							type="radio"
							name="priority"
							value={p.value}
							defaultChecked={defaultValue === p.value}
							className="peer sr-only"
						/>
						<span
							className={`flex h-full items-center px-3 font-mono text-meta tabular-nums text-ink-3 transition-colors hover:text-ink peer-checked:shadow-[inset_0_-2px_0_currentColor] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[-2px] peer-focus-visible:outline-accent ${PRIORITY_CELL[p.value]}`}
						>
							{p.label}
						</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}
