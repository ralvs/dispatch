"use client";

import { RECURRENCE_LABELS, RECURRENCE_PATTERNS } from "@/lib/recurrence";

export type TaskDomainOption = { id: string; name: string; is_system: boolean };

/** Label always stacks above its control (block, not inline beside). */
const FIELD_LABEL = "block font-mono text-eyebrow uppercase text-ink-3";
const CONTROL =
	"mt-1 block rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-line-strong";

/** Compact date input — fixed width so the browser control never crops. */
const DATE_CONTROL = `${CONTROL} w-[10.75rem]`;
/** Compact time input — fixed width so HH:MM stays fully visible. */
const TIME_CONTROL = `${CONTROL} w-[7.25rem]`;
const SELECT_CONTROL = `${CONTROL} max-w-[11rem] w-full`;

export const PRIORITIES = [
	{ value: 1, label: "P1", title: "Critical" },
	{ value: 2, label: "P2", title: "High" },
	{ value: 3, label: "P3", title: "Normal" },
	{ value: 4, label: "P4", title: "Someday" },
] as const;

/** Full class strings required so Tailwind can see peer-checked variants. */
const PRIORITY_CELL: Record<number, string> = {
	1: "text-error peer-checked:bg-error peer-checked:text-bg hover:bg-error/10 peer-checked:hover:bg-error peer-checked:hover:text-bg",
	2: "text-warning peer-checked:bg-warning peer-checked:text-bg hover:bg-warning/10 peer-checked:hover:bg-warning peer-checked:hover:text-bg",
	3: "text-accent-ink peer-checked:bg-accent peer-checked:text-bg hover:bg-accent-bg peer-checked:hover:bg-accent peer-checked:hover:text-bg",
	4: "text-ink-4 peer-checked:bg-ink-4 peer-checked:text-bg hover:bg-surface-2 peer-checked:hover:bg-ink-4 peer-checked:hover:text-bg",
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
	domain_id?: string;
	priority?: number;
	recurrence_rule?: string | null;
};

/**
 * Shared title + optional notes + the five compact meta controls used by both
 * create and edit. Meta fields use intrinsic widths so they stop stretching
 * across the row; notes stay full-width for real writing room.
 */
export function TaskFormFields({
	domains,
	defaults = {},
	titlePlaceholder = "What needs doing?",
	showNotes = false,
}: {
	domains: TaskDomainOption[];
	defaults?: TaskFieldDefaults;
	titlePlaceholder?: string;
	showNotes?: boolean;
}) {
	const dueTime = defaults.due_time ? defaults.due_time.slice(0, 5) : "";
	const priority = defaults.priority ?? 4;

	return (
		<>
			<input
				name="title"
				required
				defaultValue={defaults.title ?? ""}
				placeholder={titlePlaceholder}
				aria-label="Task title"
				className="w-full border-b border-line bg-transparent pb-1.5 font-serif text-base text-ink outline-none placeholder:text-ink-4"
			/>

			{showNotes && (
				<label className="block">
					<span className={FIELD_LABEL}>Notes</span>
					<textarea
						name="notes"
						rows={2}
						defaultValue={defaults.notes ?? ""}
						className={`${CONTROL} w-full py-1.5`}
					/>
				</label>
			)}

			{/* items-start keeps every label band on one horizontal rhythm (all labels on top). */}
			<div className="flex flex-wrap items-start gap-x-3 gap-y-2">
				<label className="block">
					<span className={FIELD_LABEL}>Due</span>
					<input
						type="date"
						name="due_date"
						defaultValue={defaults.due_date ?? ""}
						className={DATE_CONTROL}
					/>
				</label>
				<label className="block">
					<span className={FIELD_LABEL}>Time</span>
					<input type="time" name="due_time" defaultValue={dueTime} className={TIME_CONTROL} />
				</label>
				<label className="block min-w-0">
					<span className={FIELD_LABEL}>Domain</span>
					<select
						name="domain_id"
						defaultValue={defaults.domain_id ?? domains[0]?.id}
						className={SELECT_CONTROL}
					>
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
						className={SELECT_CONTROL}
					>
						<option value="">Never</option>
						{RECURRENCE_PATTERNS.map((p) => (
							<option key={p} value={p}>
								{RECURRENCE_LABELS[p]}
							</option>
						))}
					</select>
				</label>
				<PriorityPicker defaultValue={priority} />
			</div>
		</>
	);
}

/** Segmented priority control — radio group styled as compact colored buttons. */
export function PriorityPicker({ defaultValue = 4 }: { defaultValue?: number }) {
	return (
		<fieldset className="block min-w-0">
			<legend className={FIELD_LABEL}>Priority</legend>
			<div
				className="mt-1 inline-flex overflow-hidden rounded-md border border-line"
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
							className={`block px-2.5 py-1 font-mono text-meta tabular-nums transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[-2px] peer-focus-visible:outline-accent ${PRIORITY_CELL[p.value]}`}
						>
							{p.label}
						</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}
