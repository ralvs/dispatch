"use client";

import { type KeyboardEvent, useRef, useState, useTransition } from "react";
import { Button, Dialog, DialogBody, DialogFooter } from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import type { MentionCandidate } from "@/lib/mentions";
import { createTaskAction, updateTaskAction } from "./actions";
import { type TaskDomainOption, type TaskFieldDefaults, TaskFormFields } from "./task-fields";

/**
 * The one surface a task is written on (docs/adr/0020) — create and edit are
 * the same fields, the same footer, the same keyboard contract, so they are
 * the same component with two labels. Every entry point (the capture bar's
 * Details, a row's title, the `?edit=` deep link from Today) opens this.
 */

export type TaskDialogMode = "create" | "edit";

const COPY: Record<TaskDialogMode, { title: string; submit: string; pending: string }> = {
	create: { title: "New task", submit: "Add task", pending: "Adding…" },
	edit: { title: "Edit task", submit: "Save", pending: "Saving…" },
};

export function TaskDialog({
	open,
	onClose,
	mode,
	domains,
	todayIso,
	defaults,
	people = [],
	/**
	 * Create only, and optional: the tasks list passes its optimistic wrapper so
	 * a new row appears before the round-trip. Left out, the action runs bare.
	 */
	onCreate,
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
	/** App-timezone today (docs/adr/0002) — never `new Date()` in the browser. */
	todayIso: string;
	defaults?: TaskFieldDefaults;
	/** @mention candidates (docs/adr/0030) for title and notes. */
	people?: MentionCandidate[];
	onCreate?: (formData: FormData) => Promise<void>;
	taskId?: string;
	onDelete?: () => void;
	onSaved?: () => void;
}) {
	const formRef = useRef<HTMLFormElement>(null);
	const [pending, startTransition] = useTransition();
	// Guards the footer's primary against an empty title without making the
	// whole form controlled — `required` still carries the real enforcement.
	const [hasTitle, setHasTitle] = useState(false);
	// The fields unmount with the dialog, so they reseed from `defaults` on
	// every open — this flag has to do the same, or a title typed in the
	// capture bar after mount would still leave the primary disabled.
	const [wasOpen, setWasOpen] = useState(false);
	if (open !== wasOpen) {
		setWasOpen(open);
		if (open) setHasTitle(Boolean(defaults?.title?.trim()));
	}

	const copy = COPY[mode];

	function submit(formData: FormData) {
		if (pending) return;
		startTransition(async () => {
			const ok = await runAction(
				() => {
					if (mode === "edit") {
						if (!taskId) throw new Error("TaskDialog: edit mode needs a taskId");
						return updateTaskAction(taskId, formData);
					}
					return onCreate ? onCreate(formData) : createTaskAction(formData);
				},
				mode === "edit" ? "Couldn't save task. Try again." : "Couldn't add that task. Try again.",
			);
			if (!ok) return;
			onSaved?.();
			onClose();
		});
	}

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
		event.preventDefault();
		formRef.current?.requestSubmit();
	}

	return (
		<Dialog open={open} onClose={onClose} title={copy.title} size="lg">
			<form
				ref={formRef}
				action={submit}
				onKeyDown={onFormKeyDown}
				onInput={(event) => {
					const target = event.target;
					if (target instanceof HTMLInputElement && target.name === "title") {
						setHasTitle(target.value.trim().length > 0);
					}
				}}
				className={`flex min-h-0 flex-1 flex-col ${pending ? "opacity-50" : ""}`}
			>
				<DialogBody className="space-y-4">
					<TaskFormFields
						domains={domains}
						todayIso={todayIso}
						defaults={defaults}
						showNotes
						people={people}
						autoFocusTitle
					/>
				</DialogBody>

				{/* Destructive left · primary right: Delete | … | Cancel | Save */}
				<DialogFooter>
					{onDelete && (
						<Button type="button" variant="danger" size="sm" disabled={pending} onClick={onDelete}>
							Delete
						</Button>
					)}
					<span className="min-w-2 flex-1" />
					<Button type="button" variant="tertiary" size="sm" disabled={pending} onClick={onClose}>
						Cancel
					</Button>
					<Button
						type="submit"
						variant="primary"
						size="sm"
						isPending={pending}
						disabled={pending || !hasTitle}
					>
						{pending ? copy.pending : copy.submit}
					</Button>
				</DialogFooter>
			</form>
		</Dialog>
	);
}
