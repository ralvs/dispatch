// ─────────────────────────────────────────────────────────────────────────
// Web Speech API glue, pure parts only (docs/adr/0008: "the palette sends
// text"). Voice is progressive enhancement — the browser transcribes locally
// and the recognised text flows into the textarea, so the user can edit before
// submitting. The DOM lib does not ship SpeechRecognition types and the API is
// still vendor-prefixed (webkitSpeechRecognition) in most browsers, so we
// declare the minimal shape we depend on here.
//
// Everything in this file is framework-free and unit-testable in the node
// vitest env; the React wiring lives in use-speech-capture.ts.
// ─────────────────────────────────────────────────────────────────────────

// Content is bilingual PT-BR/EN and stored verbatim (iron rule #5); recognition
// defaults to pt-BR with a toggle to en-US. The value doubles as the BCP-47 tag
// handed to SpeechRecognition.lang.
export type RecognitionLang = "pt-BR" | "en-US";

export function nextLang(current: RecognitionLang): RecognitionLang {
	return current === "pt-BR" ? "en-US" : "pt-BR";
}

/** Join two transcript fragments with a single space, tolerating blanks. */
export function joinSpoken(a: string, b: string): string {
	const left = a.trim();
	const right = b.trim();
	if (!left) return right;
	if (!right) return left;
	return `${left} ${right}`;
}

type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; [index: number]: SpeechAlternative };
type SpeechResultList = { length: number; [index: number]: SpeechResult };

export type SpeechRecognitionEventLike = { resultIndex: number; results: SpeechResultList };

export type SpeechRecognitionLike = {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	start(): void;
	stop(): void;
	abort(): void;
	onresult: ((event: SpeechRecognitionEventLike) => void) | null;
	onerror: (() => void) | null;
	onend: (() => void) | null;
};

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export type SpeechWindow = {
	SpeechRecognition?: SpeechRecognitionCtor;
	webkitSpeechRecognition?: SpeechRecognitionCtor;
};

/** The standard constructor if present, else the webkit-prefixed one, else null. */
export function getSpeechRecognitionCtor(win: SpeechWindow): SpeechRecognitionCtor | null {
	return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(win: SpeechWindow): boolean {
	return getSpeechRecognitionCtor(win) !== null;
}

export type TerminalSettle = {
	/** Starts the fallback timer. Idempotent — a no-op if already armed, or if
	 * already settled/cancelled. No timer runs before this is called. */
	arm: () => void;
	/** Fires `onSettle` if it hasn't already; every trigger after the first is a no-op. */
	settle: () => void;
	/** Suppresses the fallback timer without firing `onSettle` — used when the
	 * session is superseded or torn down before a terminal event arrives. */
	cancel: () => void;
};

/**
 * A recognizer's graceful `stop()` should end in exactly one terminal signal,
 * but the Web Speech API gives no guarantee: `onend`, `onerror`, a synchronous
 * throw from `stop()`, or (rarely) nothing at all are all observed in the
 * wild. This wraps a callback so the first of those triggers wins and the
 * rest are no-ops, with a fallback timer — armed only once a stop is actually
 * requested, standing in for "nothing at all" — as the last resort.
 */
export function createTerminalSettle(
	onSettle: () => void,
	timeoutMs: number,
	scheduler: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout } = {
		setTimeout,
		clearTimeout,
	},
): TerminalSettle {
	let settled = false;
	let timer: ReturnType<typeof setTimeout> | null = null;

	function arm(): void {
		if (settled || timer !== null) return;
		timer = scheduler.setTimeout(() => settle(), timeoutMs);
	}

	function settle(): void {
		if (settled) return;
		settled = true;
		if (timer !== null) scheduler.clearTimeout(timer);
		onSettle();
	}

	function cancel(): void {
		if (settled) return;
		settled = true;
		if (timer !== null) scheduler.clearTimeout(timer);
	}

	return { arm, settle, cancel };
}
