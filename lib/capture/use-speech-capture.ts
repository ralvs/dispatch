"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	getSpeechRecognitionCtor,
	joinSpoken,
	type RecognitionLang,
	type SpeechRecognitionEventLike,
	type SpeechRecognitionLike,
	type SpeechWindow,
} from "@/lib/capture/speech";

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
	stop: () => void;
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

	const stop = useCallback(() => {
		// Keep handlers attached: the terminal onend must still fire (and its
		// session still matches) so a caller can act on the finalised transcript.
		recognitionRef.current?.stop();
	}, []);

	const start = useCallback(() => {
		const Ctor = getSpeechRecognitionCtor(speechWindow());
		if (!Ctor) return;
		// Retire any prior session before starting a fresh one.
		detach(recognitionRef.current);
		sessionRef.current += 1;
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
		recognition.onerror = () => {
			if (sessionRef.current === session) setListening(false);
		};
		recognition.onend = () => {
			if (sessionRef.current === session) setListening(false);
		};
		recognitionRef.current = recognition;
		recognition.start();
		setListening(true);
	}, []);

	// Retire a running session on unmount so the mic is released and no late
	// event can fire into an unmounted tree.
	useEffect(
		() => () => {
			sessionRef.current += 1;
			detach(recognitionRef.current);
		},
		[],
	);

	return { supported, listening, start, stop };
}
