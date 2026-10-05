"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
	Dialog,
	DialogBody,
	DialogFooter,
	FIRST_INVALID,
	FormButton,
	FormStateProvider,
	SubmitButton,
	useResultAction,
} from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";
import { createTaskAction, quickAddTaskAction, updateTaskAction } from "@/lib/actions/tasks";
import type { MentionCandidate } from "@/lib/mentions";
import type { DomainItem } from "@/lib/schemas/domain";
import type { ProjectRow } from "@/lib/schemas/project";
import { useLiveOptions } from "@/lib/store/live-options";
import { useStoreWrite } from "@/lib/store/run";
import {
	optimisticTaskFromForm,
	optimisticTaskFromText,
} from "@/lib/task-interaction/optimistic-task";
import {
	type TaskDomainOption,
	type TaskFieldDefaults,
	TaskFormFields,
	type TaskProjectOption,
} from "./task-fields";
import { titleOnlyCreate } from "./title-only";

/**
 * The one surface a task is written on (docs/adr/0040, docs/adr/0043) — create
 * and edit are the same fields, the same footer, the same keyboard contract, so
 * they are the same component with two labels. Both entry points (the header's
 * `+ New task`, and a task's own URL `/tasks/<id>`, docs/adr/0079) open this.
 *
 * Since ADR-0043 it is also the fast path. `/tasks` used to carry a standing
 * capture line whose only job was to run the natural-language parser without
 * spending an AI call on the shell's Capture — a third way to write a task,
 * for a distinction the reader never asked about. The line is gone and the
 * parser moved in here: **a create that carries nothing but a title goes
 * through the parser; a create that has touched any other field is taken
 * literally.** One rule, one form, and it holds for Enter and for the footer's
 * primary equally, so the two can never disagree.
 *
 * "Taken literally" is the conservative half on purpose. If a due date has been
 * set by hand, parsing the title could only overrule it.
 *
 * Every write goes through the entity store (docs/adr/0069): a create shows
 * its row at once and swaps in the server's on confirm, an edit lands the
 * saved row. Callers say only whether the parser may read a bare title.
 */

export type TaskDialogMode = "create" | "edit";

const COPY: Record<TaskDialogMode, { title: string; submit: string; pending: string }> = {
	create: { title: "New task", submit: "Add task", pending: "Adding…" },
	edit: { title: "Edit task", submit: "Save", pending: "Saving…" },
};

/** An archived domain is no task's domain. */
const toDomainOption = (row: DomainItem): TaskDomainOption | null =>
	row.active ? { id: row.id, name: row.name, color: row.color } : null;
const toProjectOption = (row: ProjectRow): TaskProjectOption => ({
	id: row.id,
	name: row.name,
	domain_id: row.domain_id,
});

const NO_PROJECTS: TaskProjectOption[] = [];

export function TaskDialog({
	open,
	onClose,
	mode,
	domains,
	projects = NO_PROJECTS,
	lockProject = false,
	lockDomain = false,
	todayIso,
	defaults,
	people = [],
	/**
	 * Create only: raw text → the natural-language parser (ADR-0043). Taken
	 * when the form carries nothing but a title. Off, every create is literal,
	 * which is what a project's `Add task` wants: its answers must not be
	 * overruled.
	 */
	quickAdd = false,
	/** Create only: the new row's provisional id, as it appears. */
	onCreating,
	/** Edit only — the id the update is written against. */
	taskId,
	/** Edit only: parent owns the confirm + optimistic removal. */
	onDelete,
	/** Runs after a successful write, before the dialog closes. */
	onSaved,
}: {
	open: boolean;
	onClose: () => void;
	mode: TaskDialogMode;
	domains: TaskDomainOption[];
	/** Pickable projects for the filing row (shape plan §06). */
	projects?: TaskProjectOption[];
	/** Opened from a project: the field shows the answer and cannot be changed. */
	lockProject?: boolean;
	/** Opened from a project: domain is the project's domain and cannot be changed. */
	lockDomain?: boolean;
	/** App-timezone today (docs/adr/0002) — never `new Date()` in the browser. */
	todayIso: string;
	defaults?: TaskFieldDefaults;
	/** @mention candidates (docs/adr/0030) for title and notes. */
	people?: MentionCandidate[];
	quickAdd?: boolean;
	onCreating?: (id: string) => void;
	taskId?: string;
	onDelete?: () => void;
	onSaved?: () => void;
}) {
	// A domain or project created in this tab is offered at once (#31).
	const liveDomains = useLiveOptions("domain", domains, toDomainOption);
	const liveProjects = useLiveOptions("project", projects, toProjectOption);
	return (
		// `sheet`: a phone gives the task form the whole screen (docs/adr/0079).
		<Dialog open={open} onClose={onClose} title={COPY[mode].title} size="lg" sheet>
			{/* Mounted only while open (Dialog), so every open reseeds from
			    `defaults` and starts with no errors. */}
			<TaskDialogForm
				mode={mode}
				domains={liveDomains}
				projects={liveProjects}
				lockProject={lockProject}
				lockDomain={lockDomain}
				todayIso={todayIso}
				defaults={defaults}
				people={people}
				quickAdd={quickAdd}
				onCreating={onCreating}
				taskId={taskId}
				onDelete={onDelete}
				onDone={() => {
					onSaved?.();
					onClose();
				}}
				onCancel={onClose}
			/>
		</Dialog>
	);
}

function TaskDialogForm({
	mode,
	domains,
	projects,
	lockProject,
	lockDomain,
	todayIso,
	defaults,
	people,
	quickAdd,
	onCreating,
	taskId,
	onDelete,
	onDone,
	onCancel,
}: {
	mode: TaskDialogMode;
	domains: TaskDomainOption[];
	projects: TaskProjectOption[];
	lockProject: boolean;
	lockDomain: boolean;
	todayIso: string;
	defaults?: TaskFieldDefaults;
	people: MentionCandidate[];
	quickAdd: boolean;
	onCreating?: (id: string) => void;
	taskId?: string;
	onDelete?: () => void;
	onDone: () => void;
	onCancel: () => void;
}) {
	const formRef = useRef<HTMLFormElement>(null);
	// Guards the footer's primary against an empty title without making the
	// whole form controlled — the server still carries the real enforcement.
	const [hasTitle, setHasTitle] = useState(Boolean(defaults?.title?.trim()));
	const copy = COPY[mode];
	const store = useStoreWrite("task");

	/**
	 * Whether the form carries anything beyond its title. Every value here is
	 * the field's own untouched state — the create form opens with no date, no
	 * time, no notes, Never, and Low priority — so this is "the operator typed a sentence
	 * and nothing else", which is exactly when reading the sentence is the
	 * helpful thing to do (ADR-0043).
	 *
	 * The domain is NOT among them: it is mandatory now, so it has no untouched
	 * state to read (ADR-0027, ADR-0043's amendment). It rides along to the
	 * parser instead of suppressing it.
	 *
	 * Read off FormData rather than tracked in state on purpose: the fields are
	 * uncontrolled by design and remount on every open, so the submitted payload
	 * is the only place that cannot drift out of sync with what is on screen.
	 */
	async function write(formData: FormData): Promise<ActionResult<unknown>> {
		if (mode === "edit") {
			if (!taskId) throw new Error("TaskDialog: edit mode needs a taskId");
			// The edit waits for the server; the store takes the saved row.
			return store({ type: "edit", id: taskId }, () => updateTaskAction(taskId, formData));
		}
		const title = String(formData.get("title") ?? "").trim();
		if (quickAdd && title && titleOnlyCreate(formData)) {
			// The sentence goes to the parser, the domain goes as stated — the
			// field is mandatory now, so it is never "untouched" and cannot be
			// read as the operator declining to file. Not a form-fed action
			// (#22 scope), so it still throws on failure.
			const domainId = String(formData.get("domain_id") ?? "");
			const optimistic = optimisticTaskFromText(title, domainId, domains);
			onCreating?.(optimistic.id);
			const result = await store({ type: "create", task: optimistic }, () =>
				quickAddTaskAction({ text: title, domainId }),
			);
			if (!result.ok) throw new Error(result.formError ?? "Couldn't add that task.");
			return { ok: true, data: undefined };
		}
		// A rejected field resolves as a failed result and the store drops the
		// optimistic row; a confirmed one swaps it for the server's.
		const optimistic = optimisticTaskFromForm(formData, domains, projects);
		onCreating?.(optimistic.id);
		return store({ type: "create", task: optimistic }, () => createTaskAction(formData));
	}

	const [state, formAction, pending] = useResultAction(write, {
		onSuccess: onDone,
		errorMessage:
			mode === "edit" ? "Couldn't save task. Try again." : "Couldn't add that task. Try again.",
	});

	useEffect(() => {
		if (state.fieldErrors) formRef.current?.querySelector<HTMLElement>(FIRST_INVALID)?.focus();
	}, [state]);

	function onFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
		// Enter saves from single-line fields; the notes textarea keeps newlines,
		// and buttons/selects keep Enter for their own activation.
		if (event.key !== "Enter") return;
		if (
			event.target instanceof HTMLTextAreaElement ||
			event.target instanceof HTMLButtonElement ||
			event.target instanceof HTMLSelectElement
		) {
			return;
		}
		// Date segments and the time ComboBox own Enter (commit a slot / a day).
		if (
			event.target instanceof Element &&
			event.target.closest("[data-rac], [role='combobox'], [role='spinbutton']")
		) {
			return;
		}
		event.preventDefault();
		if (!pending) formRef.current?.requestSubmit();
	}

	return (
		<form
			ref={formRef}
			action={formAction}
			noValidate
			onKeyDown={onFormKeyDown}
			onInput={(event) => {
				const target = event.target;
				if (target instanceof HTMLInputElement && target.name === "title") {
					setHasTitle(target.value.trim().length > 0);
				}
			}}
			className={`flex min-h-0 flex-1 flex-col ${pending ? "opacity-50" : ""}`}
		>
			{/* space-y-10: each label belongs to the control under it, and at a
			    tighter gap it starts reading as a caption on the one above. */}
			<FormStateProvider state={state}>
				<DialogBody className="space-y-10">
					<TaskFormFields
						domains={domains}
						projects={projects}
						lockProject={lockProject}
						lockDomain={lockDomain}
						todayIso={todayIso}
						defaults={defaults}
						showNotes
						people={people}
						autoFocusTitle
						titlePlaceholder={
							quickAdd ? 'What needs doing? — "pay rent every monday 9am"' : undefined
						}
						/* The rule is invisible from the field alone, and a rule nobody
						   can see is a rule that surprises. One quiet line, only where
						   the parser is actually wired up. */
						titleHint={quickAdd ? "A title on its own gets read for dates and repeats." : undefined}
					/>
				</DialogBody>
			</FormStateProvider>

			{/* Destructive left · primary right: Delete | … | Cancel | Save */}
			<DialogFooter>
				{onDelete && (
					<FormButton variant="danger" size="sm" onClick={onDelete}>
						Delete
					</FormButton>
				)}
				<span className="min-w-2 flex-1" />
				<FormButton variant="tertiary" size="sm" onClick={onCancel}>
					Cancel
				</FormButton>
				<SubmitButton variant="primary" size="sm" disabled={!hasTitle} pendingLabel={copy.pending}>
					{copy.submit}
				</SubmitButton>
			</DialogFooter>
		</form>
	);
}
