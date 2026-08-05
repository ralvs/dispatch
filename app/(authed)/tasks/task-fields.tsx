"use client";

import { useId, useState } from "react";
import { MentionTextarea, MentionTextInput } from "@/components/mention-input";
import { Badge, Field, fieldControl, Input, Select } from "@/components/ui";
import { shiftDay } from "@/lib/dates";
import type { MentionCandidate } from "@/lib/mentions";
import { RECURRENCE_LABELS, RECURRENCE_PATTERNS } from "@/lib/recurrence";

export type TaskDomainOption = {
	id: string;
	name: string;
	color: string | null;
};

/** Label always stacks above its control (block, not inline beside). */
const FIELD_LABEL = "block font-mono text-eyebrow uppercase text-ink-3";

/**
 * Shared field shell for non-primitive surfaces in this directory (mention
 * controls). Prefer Input/Select from `@/components/ui` for native fields.
 */
export const CONTROL = fieldControl({ size: "md" });

/**
 * Borderless on purpose: five bordered boxes in a row (date, time, and three
 * shortcuts) read as five equal controls. The shortcuts are a shortcut to the
 * field beside them, so they keep the hit area and drop the chrome.
 */
export const CHIP =
	"h-9 rounded-control px-2 font-mono text-eyebrow uppercase text-ink-3 transition-colors hover:bg-surface hover:text-ink";
export const CHIP_ON = "bg-accent-bg text-accent-ink hover:bg-accent-bg hover:text-accent-ink";
/** Reset is an action, not a relative day — visually subordinate to the chips beside it. */
const CHIP_RESET =
	"h-9 rounded-control px-2 font-mono text-eyebrow uppercase text-ink-4 transition-colors hover:bg-surface hover:text-accent-slip disabled:pointer-events-none disabled:opacity-0";

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

const PRIORITY_TONE: Record<number, "error" | "warning" | "accent" | "muted"> = {
	1: "error",
	2: "warning",
	3: "accent",
	4: "muted",
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
	const tone = PRIORITY_TONE[priority] ?? PRIORITY_TONE[4];
	return (
		<Badge tone={tone} title={meta.title} className={`tabular-nums ${className}`}>
			{meta.label}
		</Badge>
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
	people = [],
	autoFocus = false,
}: {
	defaultValue?: string;
	placeholder?: string;
	/** @mention candidates (docs/adr/0030) — empty disables the autocomplete but never the field. */
	people?: MentionCandidate[];
	/** Marks this as the field Dialog hands focus to on open. */
	autoFocus?: boolean;
}) {
	const [value, setValue] = useState(defaultValue);
	return (
		<MentionTextInput
			name="title"
			required
			value={value}
			onValueChange={setValue}
			people={people}
			placeholder={placeholder}
			aria-label="Task title"
			data-autofocus={autoFocus || undefined}
			className="field-shell h-auto w-full py-1.5 font-serif text-base text-ink placeholder:font-normal placeholder:text-ink-4"
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
	// Uncontrolled elsewhere in this file, but Reset has to clear it too, so it
	// needs to be React state here rather than a defaultValue-only <select>.
	const [recurrence, setRecurrence] = useState(defaults.recurrence_rule ?? "");

	function resetSchedule() {
		setDue("");
		setTime("");
		setRecurrence("");
	}
	const scheduleIsEmpty = due === "" && time === "" && recurrence === "";

	return (
		// Two deliberate rows rather than one that happens to wrap: "when" is
		// wide (a date, a time, three shortcuts), "where/how often/how much"
		// are three narrow answers that line up under it.
		<div className="space-y-4">
			<div className="min-w-0">
				<span className={FIELD_LABEL}>Due</span>
				<div className="mt-1 flex flex-wrap items-center gap-1.5">
					<Input
						type="date"
						name="due_date"
						value={due}
						onChange={(event) => {
							const next = event.target.value;
							setDue(next);
							// A time with no date to sit on is meaningless (DB check
							// constraint) — clear it in the same gesture that clears the date.
							if (next === "") setTime("");
						}}
						aria-label="Due date"
						className="w-[9.5rem]"
					/>
					<Input
						type="time"
						name="due_time"
						value={time}
						disabled={due === ""}
						onChange={(event) => setTime(event.target.value)}
						aria-label="Due time"
						className="w-[7.5rem]"
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
					{/* Not a relative day like the chips above — an action that clears
					    date, time, and recurrence together ("no dates at all"). Hidden
					    once there is nothing left to reset. */}
					<button
						type="button"
						onClick={resetSchedule}
						disabled={scheduleIsEmpty}
						aria-label="Clear due date, time, and recurrence"
						className={CHIP_RESET}
					>
						Reset
					</button>
				</div>
			</div>

			<div className="flex flex-wrap items-start gap-x-6 gap-y-4">
				<Field label="Domain" className="min-w-0">
					{/* No color dot on <option> — styling native option elements is
					    unreliable cross-browser, so this stays a plain name list. */}
					<Select
						name="domain_id"
						defaultValue={defaults.domain_id ?? ""}
						className="w-[11rem] max-w-full"
					>
						{/* "Unfiled" is offered only when it is already the answer — on the
						    create form (undefined) or for a task sitting in the inbox (null).
						    A filed task never sees it, which is what keeps filing one-way
						    (docs/adr/0027). It also has to be listed in the inbox case, or
						    the <select> would drop its own value and silently reassign the
						    task to whichever domain sorts first. */}
						{defaults.domain_id == null && <option value="">Unfiled</option>}
						{domains.map((d) => (
							<option key={d.id} value={d.id}>
								{d.name}
							</option>
						))}
					</Select>
				</Field>

				<Field label="Repeats" className="min-w-0">
					<Select
						name="recurrence_rule"
						value={recurrence}
						onChange={(event) => setRecurrence(event.target.value)}
						className="w-[11rem] max-w-full"
					>
						<option value="">Never</option>
						{RECURRENCE_PATTERNS.map((p) => (
							<option key={p} value={p}>
								{RECURRENCE_LABELS[p]}
							</option>
						))}
					</Select>
				</Field>

				<PriorityPicker defaultValue={defaults.priority ?? 4} />
			</div>
		</div>
	);
}

/**
 * Title + optional notes + the meta row — the full surface, used by the task
 * dialog for both create and edit. The capture bar keeps its own bare title
 * line for quick-add, so it never renders a second title field beside this one.
 */
export function TaskFormFields({
	domains,
	todayIso,
	defaults = {},
	titlePlaceholder = "What needs doing?",
	showNotes = false,
	people = [],
	autoFocusTitle = false,
}: {
	domains: TaskDomainOption[];
	todayIso: string;
	defaults?: TaskFieldDefaults;
	titlePlaceholder?: string;
	showNotes?: boolean;
	/** @mention candidates (docs/adr/0030), threaded to both title and notes. */
	people?: MentionCandidate[];
	/** Hands the title field to Dialog's open-focus. */
	autoFocusTitle?: boolean;
}) {
	return (
		<>
			<TaskTitleField
				defaultValue={defaults.title ?? ""}
				placeholder={titlePlaceholder}
				people={people}
				autoFocus={autoFocusTitle}
			/>

			{showNotes && <TaskNotesField defaultValue={defaults.notes ?? ""} people={people} />}

			<TaskMetaFields domains={domains} todayIso={todayIso} defaults={defaults} />
		</>
	);
}

function TaskNotesField({
	defaultValue,
	people,
}: {
	defaultValue: string;
	people: MentionCandidate[];
}) {
	const [value, setValue] = useState(defaultValue);
	const labelId = useId();
	return (
		<div className="block">
			<span id={labelId} className={FIELD_LABEL}>
				Notes
			</span>
			<MentionTextarea
				name="notes"
				rows={2}
				value={value}
				onValueChange={setValue}
				people={people}
				aria-labelledby={labelId}
				className={`${CONTROL} mt-1 block h-auto w-full py-1.5`}
			/>
		</div>
	);
}

/** Segmented priority control — radio group, colour reserved for the answer. */
export function PriorityPicker({ defaultValue = 4 }: { defaultValue?: number }) {
	return (
		<fieldset className="block min-w-0">
			<legend className={FIELD_LABEL}>Priority</legend>
			<div
				className="mt-1 inline-flex h-9 overflow-hidden rounded-control border border-line"
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
