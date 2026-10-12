"use client";

import { SkipForward } from "lucide-react";
import { Icon } from "@/components/ui/icon";

/**
 * Skip this cycle of a recurring task (docs/adr/0083): the task moves to its
 * next due date and nothing is saved as done. Quiet, beside the star, and
 * only on an open recurring row — the handler is absent everywhere else.
 */
export function SkipButton({ title, onSkip }: { title: string; onSkip: () => void }) {
	return (
		<button
			type="button"
			aria-label={`Skip this time of "${title}"`}
			title="Skip this time"
			onClick={onSkip}
			className="hit-area relative inline-flex size-4 shrink-0 items-center justify-center leading-none text-ink-4 [--hit-x:8px] [--hit-y:14px] hover:text-ink-2 active:opacity-70"
		>
			<Icon icon={SkipForward} size="md" />
		</button>
	);
}
