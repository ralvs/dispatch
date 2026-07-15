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
