"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { captureText } from "@/app/(authed)/capture/actions";
import { OPEN_CAPTURE_EVENT } from "@/lib/capture/palette-bus";
import { type CaptureReceipt, deriveReceipt } from "@/lib/capture/receipt";
import { isOpenShortcut, isSubmitShortcut } from "@/lib/capture/shortcuts";
import { joinSpoken, nextLang, type RecognitionLang } from "@/lib/capture/speech";
import { isBlank, isStaleSubmission } from "@/lib/capture/submission";
import { useSpeechCapture } from "@/lib/capture/use-speech-capture";
import type { CapturedRecord } from "@/lib/services/capture";

type Status = "idle" | "pending" | "done" | "error";

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,[tabindex]:not([tabindex="-1"])';

export function CapturePalette() {
	const [open, setOpen] = useState(false);
	const [text, setText] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [receipt, setReceipt] = useState<CaptureReceipt | null>(null);
	const [lang, setLang] = useState<RecognitionLang>("pt-BR");
	const [pending, startTransition] = useTransition();

	const dialogRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const receiptHeadingRef = useRef<HTMLParagraphElement>(null);
	const restoreFocusRef = useRef<HTMLElement | null>(null);
	// Text present when dictation started, so recognised speech appends to it.
	const speechBaseRef = useRef("");
	// Whether the current draft came (even partly) from the mic — decides `via`.
	const usedVoiceRef = useRef(false);
	// Monotonic submit sequence: a completion whose sequence is no longer current
	// (a newer submit, or a close/reopen) is stale and must not touch the UI.
	const seqRef = useRef(0);
	// Set when submit is requested mid-dictation: the actual request is deferred
	// until recognition ends so a final result can't land after the snapshot.
	const submitAfterStopRef = useRef(false);

	const titleId = useId();

	const speech = useSpeechCapture({
		lang,
		onTranscript: (spoken) => {
			usedVoiceRef.current = true;
			setText(joinSpoken(speechBaseRef.current, spoken));
		},
	});

	const openPalette = useCallback(() => setOpen(true), []);

	const closePalette = useCallback(() => {
		// Invalidate any in-flight submit so its completion can't clobber a draft
		// typed after a reopen, and cancel a deferred (mid-dictation) submit.
		seqRef.current += 1;
		submitAfterStopRef.current = false;
		speech.stop();
		setOpen(false);
		setStatus("idle");
		setReceipt(null);
		restoreFocusRef.current?.focus();
	}, [speech]);

	// Global open triggers: Cmd/Ctrl+J and the window event from other triggers.
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (isOpenShortcut(event)) {
				event.preventDefault();
				setOpen(true);
			}
		}
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener(OPEN_CAPTURE_EVENT, openPalette);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener(OPEN_CAPTURE_EVENT, openPalette);
		};
	}, [openPalette]);

	// Move focus into the palette on open, restore it on close.
	useEffect(() => {
		if (open) {
			restoreFocusRef.current = document.activeElement as HTMLElement | null;
			textareaRef.current?.focus();
		}
	}, [open]);

	// On success the textarea unmounts; move focus onto the receipt (announced
	// via its role="status" live region) so focus can't escape the dialog.
	useEffect(() => {
		if (status === "done") receiptHeadingRef.current?.focus();
	}, [status]);

	// The actual request. Snapshots the draft verbatim (untrimmed — iron rule #5)
	// and guards its completion with the submit sequence.
	const performSubmit = useCallback(() => {
		const value = text;
		if (isBlank(value) || pending) return;
		seqRef.current += 1;
		const seq = seqRef.current;
		setStatus("pending");
		startTransition(async () => {
			try {
				const record: CapturedRecord = await captureText({
					text: value,
					via: usedVoiceRef.current ? "voice" : "text",
				});
				if (isStaleSubmission(seq, seqRef.current)) return;
				setReceipt(deriveReceipt(record));
				setStatus("done");
				// Cleared only on a durable success — capture another starts fresh.
				setText("");
				usedVoiceRef.current = false;
			} catch {
				if (isStaleSubmission(seq, seqRef.current)) return;
				// Never-lose at the UI layer (iron rule #4): the raw insert or the
				// network failed, so nothing was persisted. Keep the draft exactly
				// as typed and offer a retry — never clear on error.
				setStatus("error");
			}
		});
	}, [text, pending]);

	const submit = useCallback(() => {
		if (isBlank(text) || pending) return;
		// Mid-dictation: stop first and defer the request until recognition ends,
		// so a final result arriving after stop() is included, not dropped.
		if (speech.listening) {
			submitAfterStopRef.current = true;
			speech.stop();
			return;
		}
		performSubmit();
	}, [text, pending, speech, performSubmit]);

	// Fire the deferred submit once recognition has fully stopped (by which time
	// its final result has flowed into `text`).
	useEffect(() => {
		if (!speech.listening && submitAfterStopRef.current) {
			submitAfterStopRef.current = false;
			performSubmit();
		}
	}, [speech.listening, performSubmit]);

	function captureAnother() {
		setStatus("idle");
		setReceipt(null);
		requestAnimationFrame(() => textareaRef.current?.focus());
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
		if (speech.listening) {
			speech.stop();
			return;
		}
		speechBaseRef.current = text;
		speech.start();
	}

	return (
		<>
			{/* Mobile trigger — the rail carries the desktop one. Hidden while the
			    palette is open so it never becomes a stray tab target behind it. */}
			{open ? null : (
				<button
					type="button"
					aria-label="Capture a thought"
					onClick={openPalette}
					className="fixed bottom-24 right-5 z-30 flex h-12 w-12 items-center justify-center border border-line-strong bg-accent font-serif text-2xl leading-none text-bg shadow-lg lg:hidden"
				>
					<span aria-hidden="true">+</span>
				</button>
			)}

			{open ? (
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
						className="w-full max-w-md border border-line-strong bg-surface p-5 shadow-xl"
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

						{status === "done" && receipt ? (
							<div role="status" aria-live="polite">
								<p
									ref={receiptHeadingRef}
									tabIndex={-1}
									className={`font-serif text-lg outline-none ${
										receipt.tone === "needs_review" ? "text-accent" : "text-ink"
									}`}
								>
									{receipt.title}
								</p>
								<ul className="mt-1 space-y-0.5 text-sm text-ink-2">
									{receipt.lines.map((line) => (
										<li key={line}>{line}</li>
									))}
								</ul>
								<div className="mt-4 flex gap-2">
									<button
										type="button"
										onClick={captureAnother}
										className="bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg"
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
									value={text}
									disabled={pending}
									onChange={(event) => setText(event.target.value)}
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

								{status === "error" ? (
									<p className="mt-2 text-sm text-accent">
										Couldn't save — your text is kept. Check your connection and retry.
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
													className={`flex h-9 w-9 items-center justify-center border disabled:opacity-50 ${
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
													aria-label={`Recognition language: ${lang}. Switch to ${nextLang(lang)}`}
													onClick={() => {
														speech.stop();
														setLang((current) => nextLang(current));
													}}
													className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink disabled:opacity-50"
												>
													{lang === "pt-BR" ? "PT" : "EN"}
												</button>
											</>
										) : null}
									</div>
									<button
										type="button"
										onClick={submit}
										disabled={pending || isBlank(text)}
										className="bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
									>
										{status === "error" ? "Retry" : pending ? "Capturing…" : "Capture"}
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
