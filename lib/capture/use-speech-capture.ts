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
 */
export function useSpeechCapture(opts: {
	lang: RecognitionLang;
	onTranscript: (spoken: string) => void;
}): UseSpeechCapture {
	const [supported, setSupported] = useState(false);
	const [listening, setListening] = useState(false);
	const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
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
		recognitionRef.current?.stop();
	}, []);

	const start = useCallback(() => {
		const Ctor = getSpeechRecognitionCtor(speechWindow());
		if (!Ctor) return;
		// Drop any prior session before starting a fresh one.
		recognitionRef.current?.abort();
		const recognition = new Ctor();
		recognition.lang = langRef.current;
		recognition.continuous = true;
		recognition.interimResults = true;
		finalRef.current = "";
		recognition.onresult = (event: SpeechRecognitionEventLike) => {
			let interim = "";
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				const chunk = result[0]?.transcript ?? "";
				if (result.isFinal) finalRef.current = joinSpoken(finalRef.current, chunk);
				else interim = joinSpoken(interim, chunk);
			}
			onTranscriptRef.current(joinSpoken(finalRef.current, interim));
		};
		recognition.onerror = () => setListening(false);
		recognition.onend = () => setListening(false);
		recognitionRef.current = recognition;
		recognition.start();
		setListening(true);
	}, []);

	// Abort a running session on unmount so the mic is released.
	useEffect(() => () => recognitionRef.current?.abort(), []);

	return { supported, listening, start, stop };
}
