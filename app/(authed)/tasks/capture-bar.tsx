"use client";

import { useRef, useState, useTransition } from "react";
import { runAction } from "@/lib/client/toast";
import { type TaskDomainOption, TaskMetaFields } from "./task-fields";

/**
 * The one place a task gets written on /tasks (docs/adr/0020).
 *
 * One field, two depths. Type a sentence and press Enter and it goes through
 * the NL parser ("pagar aluguel toda segunda 9h" → recurring, 09:00). Open
 * Details and the same text becomes the title verbatim, with the meta row
 * beneath it — so a second title field never appears next to the first.
 */
export function CaptureBar({
	domains,
	todayIso,
	onQuickAdd,
	onCreate,
}: {
	domains: TaskDomainOption[];
	todayIso: string;
	/** Raw text → parser. Used when Details is closed. */
	onQuickAdd: (text: string) => Promise<void>;
	/** Title + meta, no parsing. Used when Details is open. */
	onCreate: (formData: FormData) => Promise<void>;
}) {
	const formRef = useRef<HTMLFormElement>(null);
	const [text, setText] = useState("");
	const [detailed, setDetailed] = useState(false);
	const [pending, startTransition] = useTransition();
	const title = text.trim();

	function submit(formData: FormData) {
		if (!title || pending) return;
		startTransition(async () => {
			// Failure toasts and the field keeps its text; success clears it.
			const ok = await runAction(
				() => (detailed ? onCreate(formData) : onQuickAdd(title)),
				"Couldn't add that task. Try again.",
			);
			if (!ok) return;
			setText("");
			setDetailed(false);
		});
	}

	return (
		<form
			ref={formRef}
			action={submit}
			className={`mt-8 ${pending ? "pointer-events-none opacity-50" : ""}`}
		>
			<div className="flex items-center gap-4 border-b border-line-strong pb-2 transition-colors focus-within:border-ink-3">
				<input
					type="text"
					value={text}
					disabled={pending}
					onChange={(event) => setText(event.target.value)}
					onKeyDown={(event) => {
						// Explicit rather than relying on implicit form submission,
						// which browsers only guarantee for a lone text input.
						if (event.key === "Enter") {
							event.preventDefault();
							formRef.current?.requestSubmit();
						}
					}}
					placeholder={'Add a task — "pagar aluguel toda segunda 9h"'}
					aria-label="Task title"
					className="min-w-0 flex-1 bg-transparent font-serif text-lg text-ink outline-none placeholder:font-normal placeholder:text-ink-4"
				/>
				{title && !detailed && (
					<span aria-hidden className="shrink-0 font-mono text-meta text-ink-4">
						↵
					</span>
				)}
				<button
					type="button"
					onClick={() => setDetailed((open) => !open)}
					aria-expanded={detailed}
					aria-controls="task-details"
					className="flex shrink-0 items-center gap-1.5 font-mono text-eyebrow uppercase tracking-widest text-ink-3 transition-colors hover:text-ink"
				>
					Details
					{/* The label stays put and the caret carries the state — a
					    "Hide details" label crowds the title field on mobile. */}
					<span
						aria-hidden
						className={`inline-block transition-transform ${detailed ? "rotate-180" : ""}`}
					>
						⌄
					</span>
				</button>
			</div>

			{detailed && (
				<div id="task-details" className="mt-5">
					<TaskMetaFields domains={domains} todayIso={todayIso} />
					<div className="mt-5 flex items-center gap-3">
						<button
							type="submit"
							disabled={pending || !title}
							className="rounded-md bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg transition-opacity disabled:opacity-40"
						>
							{pending ? "Adding…" : "Add task"}
						</button>
						<button
							type="button"
							onClick={() => setDetailed(false)}
							className="px-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 transition-colors hover:text-ink"
						>
							Cancel
						</button>
					</div>
				</div>
			)}
		</form>
	);
}
