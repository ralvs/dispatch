"use client";

import { useState, useTransition } from "react";
import { runAction } from "@/lib/client/toast";

const CONTROL =
	"w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-line-strong disabled:opacity-50 placeholder:text-ink-4";

/**
 * Task-scoped NL quick-add (docs/adr/0019 D3). Single-line, Enter submits.
 * The caller owns the optimistic row + server action (task-list.tsx mirrors
 * TaskForm's onCreate so both share the same useOptimistic transition).
 */
export function QuickAdd({ onSubmit }: { onSubmit: (text: string) => Promise<void> }) {
	const [text, setText] = useState("");
	const [pending, startTransition] = useTransition();

	function handleSubmit() {
		const value = text.trim();
		if (!value || pending) return;
		startTransition(async () => {
			// Failure toasts and the input keeps its text; success clears it.
			const ok = await runAction(() => onSubmit(value), "Couldn't add that task. Try again.");
			if (ok) setText("");
		});
	}

	return (
		<div className="mt-6">
			<input
				type="text"
				value={text}
				disabled={pending}
				onChange={(event) => setText(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						handleSubmit();
					}
				}}
				placeholder='Quick add — "pagar aluguel toda segunda 9h"'
				aria-label="Quick add task"
				className={CONTROL}
			/>
		</div>
	);
}
