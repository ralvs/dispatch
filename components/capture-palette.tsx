"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { captureText } from "@/app/(authed)/capture/actions";
import {
	type CaptureEffect,
	type CaptureEvent,
	captureMachine,
	initialCaptureState,
} from "@/lib/capture/machine";
import { OPEN_CAPTURE_EVENT, openCapturePalette } from "@/lib/capture/palette-bus";
import { deriveReceipt } from "@/lib/capture/receipt";
import { isOpenShortcut, isSubmitShortcut } from "@/lib/capture/shortcuts";
import { nextLang } from "@/lib/capture/speech";
import { isBlank } from "@/lib/capture/submission";
import { useSpeechCapture } from "@/lib/capture/use-speech-capture";
import { readCaptureIntent } from "@/lib/pwa/capture-intent";
import type { CapturedRecord } from "@/lib/services/capture";

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,[tabindex]:not([tabindex="-1"])';

export function CapturePalette() {
	// All status/text/speech/submit-sequence logic lives in captureMachine
	// (lib/capture/machine.ts); this component is a thin shell that dispatches
	// events into it and drains the effects it emits.
	const [state, setState] = useState(initialCaptureState);
	const stateRef = useRef(state);
	stateRef.current = state;
	const [effectsBatch, setEffectsBatch] = useState<{ id: number; effects: CaptureEffect[] }>({
		id: 0,
		effects: [],
	});
	const [, startTransition] = useTransition();

	const dialogRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const receiptHeadingRef = useRef<HTMLParagraphElement>(null);
	const restoreFocusRef = useRef<HTMLElement | null>(null);

	const titleId = useId();

	// Plain callback (not a useReducer reducer) so dispatching is never
	// double-invoked under StrictMode — each call runs the pure machine exactly
	// once and queues whatever effects it emits for the drain effect below.
	const dispatch = useCallback((event: CaptureEvent) => {
		const { state: next, effects } = captureMachine(stateRef.current, event);
		stateRef.current = next;
		setState(next);
		if (effects.length > 0) {
			setEffectsBatch((batch) => ({ id: batch.id + 1, effects }));
		}
	}, []);

	const speech = useSpeechCapture({
		lang: state.lang,
		onTranscript: (spoken) => dispatch({ type: "TRANSCRIPT", spoken }),
	});

	// The actual request behind a SUBMIT effect. Guards its completion via the
	// seq the machine handed out, same as before.
	const runSubmitEffect = useCallback(
		(text: string, via: "voice" | "text", seq: number) => {
			startTransition(async () => {
				try {
					const record: CapturedRecord = await captureText({ text, via });
					dispatch({ type: "SUBMIT_OK", seq, receipt: deriveReceipt(record) });
				} catch {
					dispatch({ type: "SUBMIT_ERR", seq, offline: !navigator.onLine });
				}
			});
		},
		[dispatch],
	);

	// Drain effects emitted by the most recent dispatch. Runs after commit, so
	// FOCUS_RECEIPT/FOCUS_TEXTAREA can rely on the DOM already reflecting the
	// state that produced them.
	useEffect(() => {
		for (const effect of effectsBatch.effects) {
			switch (effect.type) {
				case "START_SPEECH":
					speech.start();
					break;
				case "STOP_SPEECH":
					speech.stop();
					break;
				case "CANCEL_SPEECH":
					speech.cancel();
					break;
				case "SUBMIT":
					runSubmitEffect(effect.text, effect.via, effect.seq);
					break;
				case "FOCUS_TEXTAREA":
					requestAnimationFrame(() => textareaRef.current?.focus());
					break;
				case "FOCUS_RECEIPT":
					receiptHeadingRef.current?.focus();
					break;
				case "RESTORE_FOCUS":
					restoreFocusRef.current?.focus();
					break;
			}
		}
	}, [effectsBatch, speech.start, speech.stop, speech.cancel, runSubmitEffect]);

	// Opens from the window event, optionally starting dictation in the same
	// tick — this only works when the event was dispatched from a real user
	// gesture (the FAB tap), since starting SpeechRecognition needs that
	// activation to still be live. Voice is only actually requested when the
	// browser supports it — matches current behaviour of never landing the
	// machine in a "listening" state that can never receive a terminal event.
	const onOpenCaptureEvent = useCallback(
		(event: Event) => {
			const detail = (event as CustomEvent<{ voice?: boolean; prefill?: string }>).detail;
			dispatch({
				type: "OPEN",
				voice: (detail?.voice ?? false) && speech.supported,
				prefill: detail?.prefill,
			});
		},
		[dispatch, speech.supported],
	);

	// Global open triggers: Cmd/Ctrl+J and the window event from other triggers.
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (isOpenShortcut(event)) {
				event.preventDefault();
				dispatch({ type: "OPEN", voice: false });
			}
		}
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener(OPEN_CAPTURE_EVENT, onOpenCaptureEvent);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener(OPEN_CAPTURE_EVENT, onOpenCaptureEvent);
		};
	}, [dispatch, onOpenCaptureEvent]);

	// Deep link from the manifest shortcut (?capture=voice): open the palette
	// but never auto-start the mic — arriving via navigation isn't a user
	// gesture, so SpeechRecognition.start() would be silently rejected. Runs
	// once on mount; the ref guards against the effect re-firing after the
	// param is stripped.
	const intentHandledRef = useRef(false);
	useEffect(() => {
		if (intentHandledRef.current) return;
		intentHandledRef.current = true;
		if (readCaptureIntent(window.location.search) === "voice") {
			dispatch({ type: "OPEN", voice: false });
			window.history.replaceState(null, "", window.location.pathname);
		}
	}, [dispatch]);

	// Move focus into the palette on open, restore it on close.
	useEffect(() => {
		if (state.open) {
			restoreFocusRef.current = document.activeElement as HTMLElement | null;
			const textarea = textareaRef.current;
			textarea?.focus();
			// Land the caret after a chip's prefill, not in front of it.
			textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
		}
	}, [state.open]);

	// Keep the machine's dictation status in sync with the real recognizer: any
	// time it stops — mic toggle, lang switch, the submit handoff, or the
	// browser ending it on its own — feeds SPEECH_ENDED back in. The machine
	// no-ops unless it actually cares (deferred submit, or "listening" status).
	useEffect(() => {
		if (!speech.listening) dispatch({ type: "SPEECH_ENDED" });
	}, [speech.listening, dispatch]);

	// While an error is showing and the browser was offline for it, retry once
	// automatically as soon as connectivity returns; ONLINE is a no-op in the
	// machine for every other status.
	useEffect(() => {
		function onOnline() {
			dispatch({ type: "ONLINE" });
		}
		window.addEventListener("online", onOnline);
		return () => window.removeEventListener("online", onOnline);
	}, [dispatch]);

	function closePalette() {
		dispatch({ type: "CLOSE" });
	}

	function submit() {
		dispatch({ type: "SUBMIT" });
	}

	function captureAnother() {
		dispatch({ type: "CAPTURE_ANOTHER" });
	}

	function onDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		if (event.key === "Escape") {
			event.stopPropagation();
			closePalette();
			return;
		}
		if (event.key !== "Tab" || !dialogRef.current) return;
		// Minimal focus trap so Tab cycles within the modal.
		const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
		if (items.length === 0) return;
		const first = items[0];
		const last = items[items.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	function toggleMic() {
		dispatch({ type: "MIC_TOGGLED" });
	}

	const pending = state.status === "submitting";

	return (
		<>
			{/* Mobile trigger — the rail carries the desktop one. Hidden while the
			    palette is open so it never becomes a stray tab target behind it. */}
			{state.open ? null : (
				<button
					type="button"
					aria-label="Capture a thought"
					onClick={() => openCapturePalette({ voice: true })}
					style={{ bottom: "calc(6rem + env(safe-area-inset-bottom))" }}
					className="fixed right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-accent font-serif text-2xl leading-none text-bg shadow-lg lg:hidden"
				>
					<span aria-hidden="true">+</span>
				</button>
			)}

			{state.open ? (
				// biome-ignore lint/a11y/noStaticElementInteractions: backdrop is a click-to-dismiss convenience; Escape and the close button are the keyboard paths.
				<div
					className="fixed inset-0 z-50 flex items-start justify-center bg-bg/80 px-4 pt-[12vh] backdrop-blur-sm"
					onClick={closePalette}
					role="presentation"
				>
					<div
						ref={dialogRef}
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						onClick={(event) => event.stopPropagation()}
						onKeyDown={onDialogKeyDown}
						className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-xl border border-line-strong bg-surface p-5 shadow-xl"
					>
						<div className="mb-3 flex items-center justify-between">
							<h2
								id={titleId}
								className="font-mono text-eyebrow uppercase tracking-widest text-ink-3"
							>
								Capture
							</h2>
							<button
								type="button"
								aria-label="Close capture palette"
								onClick={closePalette}
								className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink"
							>
								Esc
							</button>
						</div>

						{state.status === "done" && state.receipt ? (
							<div role="status" aria-live="polite">
								<p
									ref={receiptHeadingRef}
									tabIndex={-1}
									className={`font-serif text-lg outline-none ${
										state.receipt.tone === "needs_review" ? "text-accent" : "text-ink"
									}`}
								>
									{state.receipt.title}
								</p>
								<ul className="mt-1 space-y-0.5 text-sm text-ink-2">
									{state.receipt.lines.map((line) => (
										<li key={line}>{line}</li>
									))}
								</ul>
								<div className="mt-4 flex gap-2">
									<button
										type="button"
										onClick={captureAnother}
										className="rounded-md bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg"
									>
										Capture another
									</button>
									<button
										type="button"
										onClick={closePalette}
										className="px-3 py-2 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink"
									>
										Done
									</button>
								</div>
							</div>
						) : (
							<div>
								<textarea
									ref={textareaRef}
									value={state.text}
									disabled={pending}
									onChange={(event) => dispatch({ type: "TEXT_CHANGED", text: event.target.value })}
									onKeyDown={(event) => {
										if (isSubmitShortcut(event)) {
											event.preventDefault();
											submit();
										}
									}}
									rows={3}
									placeholder="What's on your mind?"
									aria-label="Capture text"
									className="w-full resize-none border-b border-line bg-transparent pb-2 font-serif text-lg text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 placeholder:text-ink-4"
								/>

								{state.status === "error" ? (
									<p className="mt-2 text-sm text-error">
										{state.offlineError
											? "Offline — draft kept."
											: "Couldn't save — your text is kept. Check your connection and retry."}
									</p>
								) : null}

								<div className="mt-4 flex items-center justify-between">
									<div className="flex items-center gap-2">
										{speech.supported ? (
											<>
												<button
													type="button"
													disabled={pending}
													aria-label={
														speech.listening ? "Stop dictation" : "Dictate with your voice"
													}
													aria-pressed={speech.listening}
													onClick={toggleMic}
													className={`flex h-9 w-9 items-center justify-center rounded-full border disabled:opacity-50 ${
														speech.listening
															? "border-accent text-accent"
															: "border-line-strong text-ink-3 hover:text-ink"
													}`}
												>
													<span aria-hidden="true">{speech.listening ? "◉" : "🎙"}</span>
												</button>
												<button
													type="button"
													disabled={pending}
													aria-label={`Recognition language: ${state.lang}. Switch to ${nextLang(state.lang)}`}
													onClick={() => dispatch({ type: "LANG_TOGGLED" })}
													className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink disabled:opacity-50"
												>
													{state.lang === "pt-BR" ? "PT" : "EN"}
												</button>
											</>
										) : null}
									</div>
									<button
										type="button"
										onClick={submit}
										disabled={pending || isBlank(state.text)}
										className="rounded-md bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
									>
										{state.status === "error" ? "Retry" : pending ? "Capturing…" : "Capture"}
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			) : null}
		</>
	);
}
