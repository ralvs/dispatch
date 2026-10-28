// A write: one intent and the server call that confirms it, built together
// from the same arguments by the kind's writes module (docs/adr/0077).
// Client-safe — no React.

import type { ActionResult } from "@/lib/action-result";
import type {
	AnyIntent,
	EntityMap,
	IntentCtx,
	IntentMap,
	Kind,
	StoreWrite,
} from "@/lib/store/types";

export type WriteResult<K extends Kind> = ActionResult<StoreWrite<EntityMap[K]>>;

export type Write<K extends Kind> = {
	readonly kind: K;
	readonly intent: IntentMap[K];
	/** Server half. `ctx` is the ctx the store applied `intent` with; a day goes from `intent` or `ctx.todayIso`. */
	readonly call: (ctx: IntentCtx) => Promise<WriteResult<K>>;
	/** Toast copy on failure. Default GENERIC_FORM_ERROR. */
	readonly errorMessage?: string;
	/** Toast copy once the server confirms. Default successCopy(); null confirms silently. */
	readonly successMessage?: string | null;
};

export function write<K extends Kind>(
	kind: K,
	intent: IntentMap[K],
	call: Write<K>["call"],
	errorMessage?: string,
	successMessage?: string | null,
): Write<K> {
	return { kind, intent, call, errorMessage, successMessage };
}

const NOUN: Record<Kind, string> = {
	task: "Task",
	notification: "Notification",
	routine: "Routine",
	note: "Note",
	quote: "Quote",
	journal: "Entry",
	link: "Link",
	person: "Person",
	personFact: "Fact",
	personInteraction: "Interaction",
	project: "Project",
	domain: "Domain",
};

/**
 * The success toast a confirmed write shows unless its builder names one.
 * Null for the writes that already say so elsewhere: a task tick, skip or
 * reopen toasts on claim (toastTaskToggle), and a note's autosave shows
 * "Saved" in the editor.
 */
export function successCopy({ kind, intent }: AnyIntent): string | null {
	const noun = NOUN[kind];
	switch (intent.type) {
		case "create":
			return `${noun} added`;
		case "delete":
			return `${noun} deleted`;
		case "complete":
		case "skip":
		case "reopen":
		case "save":
			return null;
		case "setTop3":
			return intent.starred ? "Starred" : "Unstarred";
		case "assign":
		case "file":
			return `${noun} filed`;
		case "pin":
			return intent.pinned ? "Pinned" : "Unpinned";
		case "resolve":
			return "Marked reviewed";
		case "touch":
			return "File removed";
		case "mark":
			return intent.status === "read" ? "Marked read" : "Dismissed";
		case "markAll":
			return intent.status === "read" ? "All marked read" : "All dismissed";
		case "toggle":
			return intent.done ? "Routine done" : "Routine unchecked";
		default:
			return `${noun} updated`;
	}
}

/** The copy a confirmed write toasts, or null for none. */
export function writeSuccessMessage<K extends Kind>(w: Write<K>): string | null {
	if (w.successMessage !== undefined) return w.successMessage;
	return successCopy({ kind: w.kind, intent: w.intent } as AnyIntent);
}
