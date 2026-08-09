"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { captureText } from "@/app/(authed)/capture/actions";
import { Button, Dialog, DialogBody, DialogFooter, Textarea } from "@/components/ui";
import { Icon } from "@/components/ui/icon";
import {
	type CaptureEffect,
	type CaptureEvent,
	captureMachine,
	initialCaptureState,
} from "@/lib/capture/machine";
import { OPEN_CAPTURE_EVENT, openCapturePalette } from "@/lib/capture/palette-bus";
import { deriveReceipt } from "@/lib/capture/receipt";
import { isOpenShortcut, isSubmitShortcut } from "@/lib/capture/shortcuts";
import { isBlank } from "@/lib/capture/submission";
import { toastError } from "@/lib/client/toast";
import { readCaptureIntent } from "@/lib/pwa/capture-intent";
import type { CapturedRecord } from "@/lib/services/capture";
import { DOCK_ACTION, DOCK_ACTION_SLOT_ID, DOCK_HEIGHT } from "@/lib/ui/dock";

/**
 * Capture palette — shell chrome only. Status/text/submit sequence lives in
 * captureMachine; this component dispatches and drains effects.
 *
 * Pass 4 brought the overlay onto Dialog / Button / Textarea. The compose
 * field is prose being written, so measure-prose applies (Pass 3). Pass 5
 * retired `.type-title`; compose and receipt use font-medium tracking-tight.
 *
 * Iron rule #4: capture path never throws into the UI; failures keep the draft
 * and toast. The verb vocabulary and palette bus are behaviour — do not change.
 */
export function CapturePalette() {
	const [state, setState] = useState(initialCaptureState);
	const stateRef = useRef(state);
	stateRef.current = state;
	const [effectsBatch, setEffectsBatch] = useState<{ id: number; effects: CaptureEffect[] }>({
		id: 0,
		effects: [],
	});
	const [, startTransition] = useTransition();

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const receiptHeadingRef = useRef<HTMLParagraphElement>(null);

	const [dockSlot, setDockSlot] = useState<HTMLElement | null>(null);
	useEffect(() => {
		setDockSlot(document.getElementById(DOCK_ACTION_SLOT_ID));
	}, []);

	const dispatch = useCallback((event: CaptureEvent) => {
		const { state: next, effects } = captureMachine(stateRef.current, event);
		stateRef.current = next;
		setState(next);
		if (effects.length > 0) {
			setEffectsBatch((batch) => ({ id: batch.id + 1, effects }));
		}
	}, []);

	const runSubmitEffect = useCallback(
		(text: string, seq: number) => {
			startTransition(async () => {
				try {
					const record: CapturedRecord = await captureText({ text, via: "text" });
					dispatch({ type: "SUBMIT_OK", seq, receipt: deriveReceipt(record) });
				} catch {
					const offline = !navigator.onLine;
					dispatch({ type: "SUBMIT_ERR", seq, offline });
					toastError(
						offline
							? "Offline — draft kept. Reconnect and retry."
							: "Couldn't capture. Your text is kept — try again.",
					);
				}
			});
		},
		[dispatch],
	);

	useEffect(() => {
		for (const effect of effectsBatch.effects) {
			switch (effect.type) {
				case "SUBMIT":
					runSubmitEffect(effect.text, effect.seq);
					break;
				case "FOCUS_TEXTAREA":
					requestAnimationFrame(() => textareaRef.current?.focus());
					break;
				case "FOCUS_RECEIPT":
					receiptHeadingRef.current?.focus();
					break;
				case "RESTORE_FOCUS":
					// Dialog restores focus to the trigger on close.
					break;
			}
		}
	}, [effectsBatch, runSubmitEffect]);

	const onOpenCaptureEvent = useCallback(
		(event: Event) => {
			const detail = (event as CustomEvent<{ prefill?: string }>).detail;
			dispatch({ type: "OPEN", prefill: detail?.prefill });
		},
		[dispatch],
	);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (isOpenShortcut(event)) {
				event.preventDefault();
				dispatch({ type: "OPEN" });
			}
		}
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener(OPEN_CAPTURE_EVENT, onOpenCaptureEvent);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener(OPEN_CAPTURE_EVENT, onOpenCaptureEvent);
		};
	}, [dispatch, onOpenCaptureEvent]);

	const intentHandledRef = useRef(false);
	useEffect(() => {
		if (intentHandledRef.current) return;
		intentHandledRef.current = true;
		if (readCaptureIntent(window.location.search)) {
			dispatch({ type: "OPEN" });
			window.history.replaceState(null, "", window.location.pathname);
		}
	}, [dispatch]);

	// Land the caret after a chip's prefill once the dialog field exists.
	useEffect(() => {
		if (!state.open) return;
		const frame = requestAnimationFrame(() => {
			const textarea = textareaRef.current;
			textarea?.focus();
			textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
		});
		return () => cancelAnimationFrame(frame);
	}, [state.open]);

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

	const pending = state.status === "submitting";
	const showReceipt =
		state.receipt !== null && (state.status === "done" || state.status === "submitting");

	return (
		<>
			{dockSlot && !state.open
				? createPortal(
						<button
							type="button"
							aria-label="Capture a thought"
							onClick={() => openCapturePalette()}
							className={`pointer-events-auto flex items-center justify-center transition-opacity active:opacity-70 ${DOCK_HEIGHT} ${DOCK_ACTION}`}
						>
							<Icon icon={Plus} size="lg" strokeWidth={1.8} />
						</button>,
						dockSlot,
					)
				: null}

			<Dialog open={state.open} onClose={closePalette} title="Capture" size="md">
				{showReceipt && state.receipt ? (
					<>
						<DialogBody>
							<div role="status" aria-live="polite">
								<p
									ref={receiptHeadingRef}
									tabIndex={-1}
									className={`text-lg font-medium tracking-tight ${
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
							</div>
						</DialogBody>
						<DialogFooter>
							<span className="min-w-2 flex-1" />
							{state.status === "done" ? (
								<>
									<Button variant="tertiary" size="sm" onClick={closePalette}>
										Done
									</Button>
									<Button variant="primary" size="sm" onClick={captureAnother}>
										Capture another
									</Button>
								</>
							) : (
								<p className="font-mono text-meta uppercase tracking-widest text-ink-4">Working…</p>
							)}
						</DialogFooter>
					</>
				) : (
					<>
						<DialogBody>
							{/* Compose is a sentence being written — prose measure (Pass 3). */}
							<div className="measure-prose">
								<Textarea
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
									size="lg"
									data-autofocus
									className="text-lg font-medium tracking-tight"
								/>
							</div>
							<div role="status" aria-live="polite">
								{state.status === "error" ? (
									<p className="mt-2 text-sm text-error">
										{state.offlineError
											? "Offline — draft kept."
											: "Couldn't save — your text is kept. Check your connection and retry."}
									</p>
								) : null}
							</div>
						</DialogBody>
						<DialogFooter>
							<span className="min-w-2 flex-1" />
							<Button
								type="button"
								variant="primary"
								size="sm"
								onClick={submit}
								disabled={pending || isBlank(state.text)}
								isPending={pending}
							>
								{state.status === "error" ? "Retry" : pending ? "Capturing…" : "Capture"}
							</Button>
						</DialogFooter>
					</>
				)}
			</Dialog>
		</>
	);
}
