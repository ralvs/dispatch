"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	createTerminalSettle,
	getSpeechRecognitionCtor,
	joinSpoken,
	type RecognitionLang,
	type SpeechRecognitionEventLike,
	type SpeechRecognitionLike,
	type SpeechWindow,
	type TerminalSettle,
} from "@/lib/capture/speech";

// Fallback for a graceful stop() whose recognizer fires neither `onend` nor
// `onerror` — without this, a deferred submit waiting on `listening` to flip
// false would stay armed forever.
const STOP_SETTLE_TIMEOUT_MS = 2000;

// The DOM lib does not type SpeechRecognition on Window, so read it through
// our minimal shape.
function speechWindow(): SpeechWindow {
	return window as unknown as SpeechWindow;
}

// Null a superseded/finished recognizer's handlers before abandoning it, so a
// late event from an old session can never update the new one or flip state.
function detach(recognition: SpeechRecognitionLike | null): void {
	if (!recognition) return;
	recognition.onresult = null;
	recognition.onerror = null;
	recognition.onend = null;
	recognition.abort();
}

type UseSpeechCapture = {
	// False until the effect confirms the browser exposes SpeechRecognition;
	// the palette hides the mic button while false.
	supported: boolean;
	listening: boolean;
	start: () => void;
	// Graceful stop for the submit handoff: handlers stay attached so the
	// terminal onend/onerror (or the safety timeout) can still flip `listening`.
	stop: () => void;
	// Immediate retirement for palette close/unmount: bumps the session,
	// detaches handlers, and aborts the recognizer so no late onresult can
	// reach a closed palette.
	cancel: () => void;
};

/**
 * Thin React wrapper over the browser's SpeechRecognition. Emits the full
 * recognised text for the current dictation session (final results plus the
 * live interim tail) through `onTranscript`; the caller composes it with
 * whatever was already typed. The pure helpers it leans on live in speech.ts.
 *
 * Every recognizer carries a session id; its handlers no-op once the session
 * is superseded, so `stop()` can keep the current handlers live (its terminal
 * `onend` is what the caller waits on) while `start()` cleanly retires the old.
 */
export function useSpeechCapture(opts: {
	lang: RecognitionLang;
	onTranscript: (spoken: string) => void;
}): UseSpeechCapture {
	const [supported, setSupported] = useState(false);
	const [listening, setListening] = useState(false);
	const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
	const terminalRef = useRef<TerminalSettle | null>(null);
	const sessionRef = useRef(0);
	const finalRef = useRef("");
	// Latest callback/lang without re-creating start().
	const onTranscriptRef = useRef(opts.onTranscript);
	onTranscriptRef.current = opts.onTranscript;
	const langRef = useRef(opts.lang);
	langRef.current = opts.lang;

	useEffect(() => {
		setSupported(getSpeechRecognitionCtor(speechWindow()) !== null);
	}, []);

	// Retires the current session: bumps the id so any in-flight handlers and
	// timers become no-ops, cancels a pending terminal-settle timer, and
	// detaches/aborts the recognizer. Does not touch `listening` — callers that
	// need the UI to reflect the retirement (cancel(), below) set it themselves.
	const retire = useCallback(() => {
		sessionRef.current += 1;
		terminalRef.current?.cancel();
		terminalRef.current = null;
		detach(recognitionRef.current);
		recognitionRef.current = null;
	}, []);

	const stop = useCallback(() => {
		// Keep handlers attached: the terminal onend must still fire (and its
		// session still matches) so a caller can act on the finalised transcript.
		// Arm the fallback timer only now — a stop is actually in flight — so it
		// can't fire mid-dictation and flip `listening` false under a still-live
		// recognizer. A synchronous throw is itself a terminal signal — settle on
		// it rather than leaving a deferred submit armed forever.
		terminalRef.current?.arm();
		try {
			recognitionRef.current?.stop();
		} catch {
			terminalRef.current?.settle();
		}
	}, []);

	// Immediate retirement, e.g. on palette close: unlike stop(), no late event
	// (onresult included) can reach this session afterwards.
	const cancel = useCallback(() => {
		retire();
		setListening(false);
	}, [retire]);

	const start = useCallback(() => {
		const Ctor = getSpeechRecognitionCtor(speechWindow());
		if (!Ctor) return;
		// Retire any prior session before starting a fresh one.
		retire();
		const session = sessionRef.current;
		const recognition = new Ctor();
		recognition.lang = langRef.current;
		recognition.continuous = true;
		recognition.interimResults = true;
		finalRef.current = "";
		recognition.onresult = (event: SpeechRecognitionEventLike) => {
			if (sessionRef.current !== session) return;
			let interim = "";
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				const chunk = result[0]?.transcript ?? "";
				if (result.isFinal) finalRef.current = joinSpoken(finalRef.current, chunk);
				else interim = joinSpoken(interim, chunk);
			}
			onTranscriptRef.current(joinSpoken(finalRef.current, interim));
		};
		const terminal = createTerminalSettle(() => {
			if (sessionRef.current === session) setListening(false);
		}, STOP_SETTLE_TIMEOUT_MS);
		recognition.onerror = () => terminal.settle();
		recognition.onend = () => terminal.settle();
		terminalRef.current = terminal;
		recognitionRef.current = recognition;
		recognition.start();
		setListening(true);
	}, [retire]);

	// Retire a running session on unmount so the mic is released and no late
	// event can fire into an unmounted tree.
	useEffect(() => retire, [retire]);

	return { supported, listening, start, stop, cancel };
}
