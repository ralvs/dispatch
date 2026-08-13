"use client";

import { RotateCcw } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { MentionTextarea, MentionTextInput } from "@/components/mention-input";
import { Field, fieldControl, Icon, Input, Select } from "@/components/ui";
import { shiftDay } from "@/lib/dates";
import type { MentionCandidate } from "@/lib/mentions";
import { RECURRENCE_LABELS, RECURRENCE_PATTERNS } from "@/lib/recurrence";

export type TaskDomainOption = {
	id: string;
	name: string;
	color: string | null;
};

/** Label always stacks above its control (block, not inline beside). */
const FIELD_LABEL = "field-caption mb-2 block text-xs";

/** One column rhythm for both meta rows so date/time/chips sit on Domain/Repeats/Priority. */
const META_GRID = "grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-3";

/**
 * Shared field shell for non-primitive surfaces in this directory (mention
 * controls). Prefer Input/Select from `@/components/ui` for native fields.
 */
export const CONTROL = fieldControl({ size: "md" });

/**
 * Borderless on purpose: date, time, and the shortcut cluster would otherwise
 * read as five equal boxed controls. The shortcuts keep the hit area and drop
 * the chrome. Compact labels so reset can sit in the same row.
 */
export const CHIP =
	"h-9 whitespace-nowrap rounded-control px-2 font-mono text-eyebrow text-ink-3 transition-colors hover:bg-surface hover:text-ink";
/**
 * Reset lives with the relative chips — same row, last in the cluster. Always
 * rendered so neighbours never shift. Red when it can take an answer away;
 * muted once there is nothing left to clear.
 */
const RESET_BUTTON =
	"inline-flex size-9 shrink-0 items-center justify-center rounded-control text-error transition-colors hover:bg-surface hover:text-error disabled:pointer-events-none disabled:text-ink-4 disabled:opacity-30 disabled:hover:bg-transparent";

/** What a due date actually gets set to, nine times out of ten. */
const RELATIVE_DAYS = [
	{ label: "today", title: "Today", days: 0 },
	{ label: "+1d", title: "Tomorrow", days: 1 },
	{ label: "+1w", title: "In one week", days: 7 },
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

/*
 * `PriorityBadge` used to live here — a P1–P4 chip in one of four tones, drawn
 * at the head of a task row's meta line. Pass 1 moved priority onto the
 * checkbox as a ring, which put the signal on the thing you actually reach for
 * and let one encoding serve both Today and Tasks. That left the badge with no
 * call sites, so it is gone rather than kept warm.
 *
 * The four tones are not lost: `PriorityPicker` below still colours the chosen
 * cell, which is the one place a priority is stated rather than read.
 */

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
			// Pass 5 retired `.type-title`; weight and tracking are inlined.
			// Tracking is now Tailwind's -0.025em rather than the class's -0.02em.
			className="field-shell h-auto w-full py-1.5 text-base font-medium tracking-tight text-ink placeholder:font-normal placeholder:text-ink-4"
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
		<div className="space-y-10">
			<div className="field-unit min-w-0">
				<span className={FIELD_LABEL}>Due</span>
				<div className={META_GRID}>
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
						className="min-w-0 w-full"
					/>
					<Input
						type="time"
						name="due_time"
						value={time}
						disabled={due === ""}
						onChange={(event) => setTime(event.target.value)}
						aria-label="Due time"
						className="min-w-0 w-full"
					/>
					{/* Same column as Priority. justify-between so today shares
					    Priority's left edge and reset shares its right. */}
					<div className="flex h-9 w-full min-w-0 items-center justify-between">
						{RELATIVE_DAYS.map(({ label, title, days }) => (
							<button
								key={label}
								type="button"
								title={title}
								aria-label={title}
								onClick={() => setDue(shiftDay(todayIso, days))}
								className={CHIP}
							>
								{label}
							</button>
						))}
						<button
							type="button"
							onClick={resetSchedule}
							disabled={scheduleIsEmpty}
							aria-label="Clear due date, time, and recurrence"
							title="Clear due date, time, and recurrence"
							className={RESET_BUTTON}
						>
							<Icon icon={RotateCcw} size="sm" />
						</button>
					</div>
				</div>
			</div>

			<div className={META_GRID}>
				<Field label="Domain" className="min-w-0">
					{/* No color dot on <option> — styling native option elements is
					    unreliable cross-browser, so this stays a plain name list. */}
					<Select name="domain_id" defaultValue={defaults.domain_id ?? ""} className="w-full">
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
						className="w-full"
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
 * dialog for both create and edit, and since ADR-0043 the only place a task is
 * written on this page at all. The standing capture line that used to sit above
 * the list is gone; its natural-language path lives in the dialog's submit now,
 * so there is one title field rather than two that had to be kept from
 * appearing beside each other.
 */
export function TaskFormFields({
	domains,
	todayIso,
	defaults = {},
	titlePlaceholder = "What needs doing?",
	titleHint,
	showNotes = false,
	people = [],
	autoFocusTitle = false,
}: {
	domains: TaskDomainOption[];
	todayIso: string;
	defaults?: TaskFieldDefaults;
	titlePlaceholder?: string;
	/** One quiet line under the title — the place the parser announces itself. */
	titleHint?: ReactNode;
	showNotes?: boolean;
	/** @mention candidates (docs/adr/0030), threaded to both title and notes. */
	people?: MentionCandidate[];
	/** Hands the title field to Dialog's open-focus. */
	autoFocusTitle?: boolean;
}) {
	return (
		<>
			<div>
				<TaskTitleField
					defaultValue={defaults.title ?? ""}
					placeholder={titlePlaceholder}
					people={people}
					autoFocus={autoFocusTitle}
				/>
				{titleHint && <p className="mt-2 font-mono text-meta text-ink-4">{titleHint}</p>}
			</div>

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
		<div className="field-unit block">
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
				className={`${CONTROL} mt-2 block h-auto w-full py-1.5`}
			/>
		</div>
	);
}

/**
 * Segmented priority control — radio group, colour reserved for the answer.
 * The segment fills its column rather than sizing to its four labels, so it
 * shares the grid's rhythm with the two selects beside it instead of leaving
 * a gap at the end of the row.
 */
export function PriorityPicker({ defaultValue = 4 }: { defaultValue?: number }) {
	return (
		<div className="field-unit min-w-0">
			<span className={FIELD_LABEL}>Priority</span>
			<div
				className="flex h-9 w-full overflow-hidden rounded-control border border-line"
				role="radiogroup"
				aria-label="Priority"
			>
				{PRIORITIES.map((p, i) => (
					<label
						key={p.value}
						title={p.title}
						className={`relative flex-1 cursor-pointer ${i > 0 ? "border-l border-line" : ""}`}
					>
						<input
							type="radio"
							name="priority"
							value={p.value}
							defaultChecked={defaultValue === p.value}
							className="peer sr-only"
						/>
						<span
							className={`flex h-full items-center justify-center px-2 font-mono text-meta tabular-nums text-ink-3 transition-colors hover:text-ink peer-checked:shadow-[inset_0_-2px_0_currentColor] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[-2px] peer-focus-visible:outline-accent ${PRIORITY_CELL[p.value]}`}
						>
							{p.label}
						</span>
					</label>
				))}
			</div>
		</div>
	);
}
