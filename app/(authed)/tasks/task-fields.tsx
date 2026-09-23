"use client";

import { RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { type ReactNode, useId, useState } from "react";
import { MentionTextarea, MentionTextInput } from "@/components/mention-input";
import {
	Field,
	FieldError,
	fieldControl,
	Icon,
	Select,
	useFieldError,
	useFieldValue,
} from "@/components/ui";
import { shiftDay } from "@/lib/dates";
import type { MentionCandidate } from "@/lib/mentions";

import {
	formatCustomWeekly,
	parseCustomWeekly,
	RECURRENCE_LABELS,
	RECURRENCE_PATTERNS,
} from "@/lib/recurrence";

/*
 * The two pickers are react-aria-components + @internationalized/date: ~435 KB,
 * the single heaviest thing in the client graph, and the only page that wants
 * them is the task form — which lives inside Dialog, whose children are mounted
 * only while it is open. Statically imported they rode the @/components/ui
 * barrel into every /tasks load anyway, for a form most visits never open.
 *
 * `ssr: false` because the dialog has no server render to match: it returns
 * null until `mounted`. The placeholder is the field shell at its real height,
 * so opening the form does not reflow while the chunk arrives.
 */
const PickerPlaceholder = () => (
	<div className="field-shell h-9 w-full min-w-0 animate-pulse" aria-hidden="true" />
);

const DatePicker = dynamic(() => import("@/components/ui/date-picker").then((m) => m.DatePicker), {
	ssr: false,
	loading: PickerPlaceholder,
});

const TimePicker = dynamic(() => import("@/components/ui/time-picker").then((m) => m.TimePicker), {
	ssr: false,
	loading: PickerPlaceholder,
});

/**
 * The Repeats select's own value for "weekly on these weekdays". Never stored
 * — the strip below turns the chosen days into `weekly:tu,sa` (shape plan
 * §06 / P7). Distinct from every stored literal so the select cannot collide.
 */
const CUSTOM_OPTION = "__custom";

/** Sunday-first, matching lib/recurrence.ts's WEEKDAY_CODES index order. */
const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const WEEKDAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
] as const;

export type TaskDomainOption = {
	id: string;
	name: string;
	color: string | null;
};

/**
 * A project as the task form needs it. `domain_id` is not decoration: a
 * project already belongs to a domain, so the form must not offer the two as
 * independent answers the way it used to — picking a project now settles the
 * domain, and the domain control locks (see TaskMetaFields).
 */
export type TaskProjectOption = { id: string; name: string; domain_id: string };

/** Label always stacks above its control (block, not inline beside). */
const FIELD_LABEL = "field-caption mb-2 block text-xs";

/**
 * Date and time answer one question, so they share a row even on a phone.
 * Shortcuts wrap onto the next line (`col-span-2`) rather than squeezing
 * the two fields.
 */
const DUE_GRID = "grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 sm:gap-x-12 sm:gap-y-8";

/**
 * Domain · Project · Priority — the filing row, same column gap and the same
 * three-up rhythm as date / time / shortcuts above it.
 *
 * Three groups, one question each: when · how often · where and how much
 * (shape plan §06 / O7). Repeats used to sit in this row's third slot and
 * moved to a row of its own, because the Custom weekday strip cannot live in
 * a third of a row. Project took the slot it vacated. The relative chips did
 * not move — they are one of the Due row's three slots, not spare room.
 */
const META_TRIO = "grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 sm:gap-x-12";

/**
 * Shared field shell for non-primitive surfaces in this directory (mention
 * controls). Prefer Input/Select from `@/components/ui` for native fields.
 */
export const CONTROL = fieldControl({ size: "md" });

/**
 * Notes is a real `<textarea>`. iOS Safari zooms the page when a focused
 * control is under 16px — `text-sm` (14) trips it; `text-base` (16) does not.
 */
const NOTES_CONTROL = fieldControl({
	size: "md",
	className: "mt-2 block h-auto w-full py-1.5 text-base",
});

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

/**
 * Three labels, matching the dashboard's high / med / low ring, and three
 * stored levels: high is 1, med is 2, low is 3 (the create default).
 */
export const PRIORITIES = [
	{ value: 1, label: "high", title: "High" },
	{ value: 2, label: "med", title: "Medium" },
	{ value: 3, label: "low", title: "Low" },
] as const;

/**
 * Colour and glow from the list checkbox: one red at two intensities, then
 * grey. The chosen cell keeps the inset rule so Low still reads as selected.
 * Full class strings so Tailwind can see the peer-checked variants.
 */
const PRIORITY_CELL: Record<number, string> = {
	1: "peer-checked:text-priority-high peer-checked:shadow-[inset_0_-2px_0_currentColor,0_0_0_3.5px_var(--priority-high-halo)]",
	2: "peer-checked:text-priority-med peer-checked:shadow-[inset_0_-2px_0_currentColor,0_0_0_3.5px_var(--priority-med-halo)]",
	3: "peer-checked:text-ink-2 peer-checked:shadow-[inset_0_-2px_0_currentColor]",
};

/*
 * `PriorityBadge` used to live here — a P1–P4 chip in one of four tones (priority had four levels then), drawn
 * at the head of a task row's meta line. Pass 1 moved priority onto the
 * checkbox as a ring, which put the signal on the thing you actually reach for
 * and let one encoding serve both Today and Tasks. That left the badge with no
 * call sites, so it is gone rather than kept warm.
 *
 * The three intensities are not lost: `PriorityPicker` colours the chosen
 * cell with the same red halo the list checkbox uses, which is the one place
 * a priority is stated rather than read.
 */

export type TaskFieldDefaults = {
	title?: string;
	notes?: string | null;
	due_date?: string | null;
	due_time?: string | null;
	/** null = the task is unfiled; undefined = no task yet (create form). */
	domain_id?: string | null;
	priority?: number;
	/** null = no project; undefined = no task yet (create form). */
	project_id?: string | null;
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
	const error = useFieldError("title");
	const errorId = useId();
	return (
		<div>
			<MentionTextInput
				name="title"
				required
				value={value}
				onValueChange={setValue}
				people={people}
				placeholder={placeholder}
				aria-label="Task title"
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? errorId : undefined}
				data-autofocus={autoFocus || undefined}
				// Pass 5 retired `.type-title`; weight and tracking are inlined.
				// Tracking is now Tailwind's -0.025em rather than the class's -0.02em.
				className="field-shell h-auto w-full py-1.5 text-base font-medium tracking-tight text-ink placeholder:font-normal placeholder:text-ink-4"
			/>
			<FieldError name="title" id={errorId} />
		</div>
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
	projects = [],
	lockProject = false,
	lockDomain = false,
	todayIso,
	defaults = {},
}: {
	domains: TaskDomainOption[];
	/** Pickable projects. Empty renders the select with only "No project". */
	projects?: TaskProjectOption[];
	/**
	 * Opened from a project, so the answer is already given (shape plan §06).
	 * A disabled select posts nothing, so the value rides a hidden input.
	 */
	lockProject?: boolean;
	/** Same contract as `lockProject`, for the project's domain. */
	lockDomain?: boolean;
	/** App-timezone today (docs/adr/0002) — never `new Date()` in the browser. */
	todayIso: string;
	defaults?: TaskFieldDefaults;
}) {
	const [due, setDue] = useState(defaults.due_date ?? "");
	const [time, setTime] = useState(defaults.due_time ? defaults.due_time.slice(0, 5) : "");
	// Uncontrolled elsewhere in this file, but Reset has to clear it too, so it
	// needs to be React state here rather than a defaultValue-only <select>.
	// Two pieces of state for one answer: which option the select shows, and
	// which weekdays the strip has. They are only both live for Custom.
	const initialCustomDays = parseCustomWeekly(defaults.recurrence_rule);
	const [recurrence, setRecurrence] = useState(
		initialCustomDays === null ? (defaults.recurrence_rule ?? "") : CUSTOM_OPTION,
	);
	const [customDays, setCustomDays] = useState<number[]>(initialCustomDays ?? []);
	// What actually gets posted. Custom with nothing ticked is not a rule yet,
	// so it posts "" — the same as Never, which is what it means.
	const storedRecurrence =
		recurrence === CUSTOM_OPTION ? formatCustomWeekly(customDays) : recurrence;

	// ── Project decides the domain ───────────────────────────────────────
	//
	// These two were independent selects, which let the form state something
	// the data cannot hold: a task in a Work project filed under Home. A
	// project already belongs to a domain, so the project is the stronger
	// answer and the domain follows it.
	//
	// One piece of state for the domain rather than two, and picking a project
	// writes through to it. The alternative — deriving the domain while a
	// project is chosen — loses the answer the moment the project is cleared,
	// which is exactly when the user wants to keep it and adjust.
	const [projectId, setProjectId] = useState(defaults.project_id ?? "");
	const [domainId, setDomainId] = useState(defaults.domain_id ?? "");
	const selectedProject = projects.find((p) => p.id === projectId);
	const domainDisabled = lockDomain || selectedProject != null;
	// Locked either way: the caller's lock keeps the task's own domain, the
	// project's lock keeps the project's.
	const postedDomainId = selectedProject?.domain_id ?? domainId;

	function chooseProject(next: string) {
		setProjectId(next);
		const domain = projects.find((p) => p.id === next)?.domain_id;
		// Clearing the project leaves its domain behind, now editable — the task
		// is still about the same area of life, it just left the project.
		if (domain) setDomainId(domain);
	}
	function resetSchedule() {
		setDue("");
		setTime("");
		setRecurrence("");
		setCustomDays([]);
	}

	function toggleWeekday(day: number) {
		setCustomDays((current) =>
			current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
		);
	}
	const scheduleIsEmpty = due === "" && time === "" && recurrence === "";
	const dueError = useFieldError("due_date");
	const timeError = useFieldError("due_time");
	const repeatError = useFieldError("recurrence_rule");
	const dueErrorId = useId();
	const timeErrorId = useId();
	const repeatErrorId = useId();

	return (
		<div className="space-y-10">
			<div className="field-unit min-w-0">
				<span className={FIELD_LABEL}>Due</span>
				<div className={DUE_GRID}>
					<DatePicker
						name="due_date"
						value={due}
						todayIso={todayIso}
						aria-label="Due date"
						invalid={Boolean(dueError)}
						aria-describedby={dueError ? dueErrorId : undefined}
						onChange={(next) => {
							setDue(next);
							// A time with no date to sit on is meaningless (DB check
							// constraint) — clear it in the same gesture that clears the date.
							if (next === "") setTime("");
						}}
					/>
					<TimePicker
						name="due_time"
						value={time}
						disabled={due === ""}
						aria-label="Due time"
						invalid={Boolean(timeError)}
						aria-describedby={timeError ? timeErrorId : undefined}
						onChange={setTime}
					/>
					{/* Same column as Priority on sm+. On a phone it spans the
					    date+time row so the two fields stay on one line. */}
					<div className="col-span-2 flex h-9 w-full min-w-0 items-center justify-between sm:col-span-1">
						{RELATIVE_DAYS.map(({ label, title, days }) => (
							<button
								key={label}
								type="button"
								title={title}
								aria-label={title}
								onClick={() => setDue(shiftDay(todayIso, days))}
								className={`${CHIP} disabled:pointer-events-none disabled:opacity-30`}
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
				<FieldError name="due_date" id={dueErrorId} />
				<FieldError name="due_time" id={timeErrorId} />
			</div>

			<div className="space-y-10">
				{/* A row of its own: the weekday strip cannot live in a third
					of a row, which is what freed the slot Project now fills
					(shape plan O7). */}
				<div className="field-unit min-w-0">
					<span className={FIELD_LABEL}>Repeats</span>
					{/* The select is the control; the posted value is derived,
						so it rides a hidden input rather than the select's own
						name. Custom with no day ticked posts "" — Never. */}
					<input type="hidden" name="recurrence_rule" value={storedRecurrence} />
					<Select
						value={recurrence}
						aria-label="Repeats"
						invalid={Boolean(repeatError)}
						aria-describedby={repeatError ? repeatErrorId : undefined}
						onChange={(event) => setRecurrence(event.target.value)}
						className="w-full"
					>
						<option value="">Never</option>
						{RECURRENCE_PATTERNS.map((p) => (
							<option key={p} value={p}>
								{RECURRENCE_LABELS[p]}
							</option>
						))}
						<option value={CUSTOM_OPTION}>Custom…</option>
					</Select>
					{recurrence === CUSTOM_OPTION && (
						<fieldset className="mt-3 flex w-full gap-1">
							<legend className="sr-only">Repeat on these weekdays</legend>
							{WEEKDAY_INITIALS.map((initial, day) => {
								const on = customDays.includes(day);
								return (
									<button
										key={WEEKDAY_NAMES[day]}
										type="button"
										aria-pressed={on}
										aria-label={WEEKDAY_NAMES[day]}
										title={WEEKDAY_NAMES[day]}
										onClick={() => toggleWeekday(day)}
										className={`h-9 flex-1 rounded-control border font-mono text-meta transition-colors ${
											on
												? "border-accent bg-accent-bg text-accent-ink"
												: "border-line text-ink-3 hover:border-line-strong hover:text-ink"
										}`}
									>
										{initial}
									</button>
								);
							})}
						</fieldset>
					)}
					<FieldError name="recurrence_rule" id={repeatErrorId} />
				</div>

				<div className={META_TRIO}>
					<Field label="Domain" name="domain_id" className="min-w-0">
						{/* Locked: a disabled select posts nothing, so the answer rides a
							hidden input. Two ways to get here now — the caller locked it,
							or the chosen project settled it — and both post the same way. */}
						{domainDisabled && <input type="hidden" name="domain_id" value={postedDomainId} />}
						{/* No color dot on <option> — styling native option elements is
						    unreliable cross-browser, so this stays a plain name list. */}
						<Select
							name={domainDisabled ? undefined : "domain_id"}
							value={postedDomainId}
							onChange={(event) => setDomainId(event.target.value)}
							disabled={domainDisabled}
							required
							aria-label="Domain"
							className="w-full"
						>
							{/* A placeholder, not a choice. "Unfiled" used to be offered here
							    whenever it was already the answer, which made this form the one
							    place a task could be created straight into the /inbox review
							    queue — a queue nobody wants to fill on purpose. The field is
							    `required` instead: unfiled is still a state a task can be IN
							    (capture routes there when it cannot tell), but no longer one
							    this form can put it in. An inbox task opened for editing shows
							    this placeholder and must be given a domain to save, which is
							    the filing gesture /inbox exists for anyway (docs/adr/0027). */}
							<option value="" disabled>
								Pick a domain
							</option>
							{domains.map((d) => (
								<option key={d.id} value={d.id}>
									{d.name}
								</option>
							))}
						</Select>
					</Field>

					<Field label="Project" name="project_id" className="min-w-0">
						{/* Locked: the select still renders so the answer is
							visible and named, and a hidden input carries the id
							a disabled control would not post. */}
						{lockProject && (
							<input type="hidden" name="project_id" value={defaults.project_id ?? ""} />
						)}
						<Select
							name={lockProject ? undefined : "project_id"}
							value={projectId}
							onChange={(event) => chooseProject(event.target.value)}
							disabled={lockProject}
							aria-label="Project"
							className="w-full"
						>
							<option value="">No project</option>
							{projects.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
								</option>
							))}
						</Select>
					</Field>

					<PriorityPicker defaultValue={defaults.priority ?? 3} />
				</div>
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
	projects = [],
	lockProject = false,
	lockDomain = false,
	todayIso,
	defaults = {},
	titlePlaceholder = "What needs doing?",
	titleHint,
	showNotes = false,
	people = [],
	autoFocusTitle = false,
}: {
	domains: TaskDomainOption[];
	projects?: TaskProjectOption[];
	lockProject?: boolean;
	lockDomain?: boolean;
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

			<TaskMetaFields
				domains={domains}
				projects={projects}
				lockProject={lockProject}
				lockDomain={lockDomain}
				todayIso={todayIso}
				defaults={defaults}
			/>
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
	const error = useFieldError("notes");
	const errorId = useId();
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
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? errorId : undefined}
				className={NOTES_CONTROL}
			/>
			<FieldError name="notes" id={errorId} />
		</div>
	);
}

/**
 * Segmented priority control — radio group, colour reserved for the answer.
 * The segment fills its column rather than sizing to its three labels, so it
 * shares the grid's rhythm with Domain instead of leaving a gap at the end
 * of the row.
 */
export function PriorityPicker({ defaultValue = 3 }: { defaultValue?: number }) {
	// A rejected submit hands back the pick, so the form's reset keeps it (#23).
	const echoed = useFieldValue("priority");
	const checked = echoed ? Number(echoed) : defaultValue;
	return (
		<div className="field-unit min-w-0">
			<span className={FIELD_LABEL}>Priority</span>
			<div
				className="flex h-9 w-full rounded-control border border-line"
				role="radiogroup"
				aria-label="Priority"
			>
				{PRIORITIES.map((p, i) => {
					const ends =
						i === 0 ? "rounded-l-control" : i === PRIORITIES.length - 1 ? "rounded-r-control" : "";
					return (
						<label
							key={p.label}
							title={p.title}
							className={`relative flex-1 cursor-pointer ${i > 0 ? "border-l border-line" : ""} ${ends}`}
						>
							<input
								type="radio"
								name="priority"
								value={p.value}
								defaultChecked={p.value === checked}
								className="peer sr-only"
							/>
							<span
								className={`flex h-full items-center justify-center px-1.5 font-mono text-meta text-ink-3 transition-colors hover:text-ink peer-checked:relative peer-checked:z-10 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[-2px] peer-focus-visible:outline-accent ${ends} ${PRIORITY_CELL[p.value]}`}
							>
								{p.label}
							</span>
						</label>
					);
				})}
			</div>
		</div>
	);
}
