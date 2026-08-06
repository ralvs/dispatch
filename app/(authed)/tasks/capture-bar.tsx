"use client";

import { useRef, useState, useTransition } from "react";
import { MentionTextInput } from "@/components/mention-input";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/client/toast";
import type { MentionCandidate } from "@/lib/mentions";
import { TaskDialog } from "./task-dialog";
import type { TaskDomainOption } from "./task-fields";

/**
 * The one place a task gets written on /tasks (docs/adr/0020).
 *
 * One field, two depths. Type a sentence and press Enter and it goes through
 * the NL parser ("pay rent every monday 9am" → recurring, 09:00). Press
 * Details and the same text opens the shared task dialog as the title
 * verbatim, with every other field beside it — so a second title field never
 * appears next to the first.
 */
export function CaptureBar({
	domains,
	todayIso,
	onQuickAdd,
	onCreate,
	people = [],
}: {
	domains: TaskDomainOption[];
	todayIso: string;
	/** Raw text → parser. Used by the inline Enter path. */
	onQuickAdd: (text: string) => Promise<void>;
	/** Title + meta, no parsing. Used by the dialog. */
	onCreate: (formData: FormData) => Promise<void>;
	/** @mention candidates (docs/adr/0030) for the title field's autocomplete. */
	people?: MentionCandidate[];
}) {
	const formRef = useRef<HTMLFormElement>(null);
	const [text, setText] = useState("");
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [pending, startTransition] = useTransition();
	const title = text.trim();

	function quickAdd() {
		if (!title || pending) return;
		startTransition(async () => {
			// Failure toasts and the field keeps its text; success clears it.
			const ok = await runAction(() => onQuickAdd(title), "Couldn't add that task. Try again.");
			if (ok) setText("");
		});
	}

	return (
		<>
			<form
				ref={formRef}
				action={quickAdd}
				className={`mt-8 ${pending ? "pointer-events-none opacity-50" : ""}`}
			>
				<div className="field-shell flex items-center gap-4 py-2 transition-colors focus-within:border-ink-3">
					<MentionTextInput
						type="text"
						name="title"
						value={text}
						disabled={pending}
						onValueChange={setText}
						people={people}
						onKeyDown={(event) => {
							// Explicit rather than relying on implicit form submission,
							// which browsers only guarantee for a lone text input. The
							// mention dropdown consumes Enter itself when a suggestion
							// is open, so this only fires on a plain Enter.
							if (event.key === "Enter") {
								event.preventDefault();
								formRef.current?.requestSubmit();
							}
						}}
						placeholder={'Add a task — "pay rent every monday 9am"'}
						aria-label="Task title"
						wrapperClassName="min-w-0 flex-1"
						className="w-full min-w-0 bg-transparent font-serif text-lg text-ink placeholder:font-normal placeholder:text-ink-4"
					/>
					{title && (
						<span aria-hidden className="shrink-0 text-meta text-ink-4">
							↵
						</span>
					)}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => setDetailsOpen(true)}
						aria-haspopup="dialog"
						className="relative shrink-0 after:absolute after:-inset-3 after:content-['']"
					>
						Details
					</Button>
				</div>
			</form>

			{/* Whatever is already typed becomes the dialog's title, verbatim — the
			    parser is the Enter path only, so opening Details is the way to say
			    "take this literally and let me fill in the rest". */}
			<TaskDialog
				open={detailsOpen}
				onClose={() => setDetailsOpen(false)}
				mode="create"
				domains={domains}
				todayIso={todayIso}
				people={people}
				defaults={{ title }}
				onCreate={onCreate}
				onSaved={() => setText("")}
			/>
		</>
	);
}
