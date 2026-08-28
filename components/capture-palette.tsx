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
	type CaptureSlip,
	captureMachine,
	hasPendingSlips,
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
 * Capture palette — shell chrome only. Slip queue / text / submit lifecycle
 * lives in captureMachine; this component dispatches and drains effects.
 *
 * The composer never blocks. Each submit becomes a slip that files on its own
 * while the field clears for the next thought, so five things can be captured
 * in a row without waiting on the parser (p50 ~4s) between them.
 *
 * Pass 4 brought the overlay onto Dialog / Button / Textarea. The compose
 * field is prose being written, so measure-prose applies (Pass 3). Pass 5
 * retired `.type-title`; compose and receipt use font-medium tracking-tight.
 *
 * Iron rule #4: capture path never throws into the UI; a failed slip keeps its
 * text and offers a retry.
 */
export function CapturePalette() {
	const [state, setState] = useState(initialCaptureState);
	const stateRef = useRef(state);
	stateRef.current = state;
	// Effects queue up in a ref and are drained on a tick, rather than living in
	// state. Two dispatches inside one React batch would otherwise collapse into
	// a single render, and the earlier batch's effects — a SUBMIT among them —
	// would be dropped without ever running. Concurrent submits are the whole
	// point now, so the queue accumulates and the drain empties it.
	const effectQueue = useRef<CaptureEffect[]>([]);
	const [effectTick, setEffectTick] = useState(0);
	const [, startTransition] = useTransition();

	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const [dockSlot, setDockSlot] = useState<HTMLElement | null>(null);
	useEffect(() => {
		setDockSlot(document.getElementById(DOCK_ACTION_SLOT_ID));
	}, []);

	const dispatch = useCallback((event: CaptureEvent) => {
		const { state: next, effects } = captureMachine(stateRef.current, event);
		stateRef.current = next;
		setState(next);
		if (effects.length > 0) {
			effectQueue.current.push(...effects);
			setEffectTick((tick) => tick + 1);
		}
	}, []);

	const runSubmitEffect = useCallback(
		(text: string, id: number) => {
			startTransition(async () => {
				try {
					const record: CapturedRecord = await captureText({ text, via: "text" });
					dispatch({ type: "SUBMIT_OK", id, receipt: deriveReceipt(record) });
				} catch {
					const offline = !navigator.onLine;
					dispatch({ type: "SUBMIT_ERR", id, offline });
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
		if (effectTick === 0) return;
		const queued = effectQueue.current;
		effectQueue.current = [];
		for (const effect of queued) {
			switch (effect.type) {
				case "SUBMIT":
					runSubmitEffect(effect.text, effect.id);
					break;
				case "FOCUS_TEXTAREA":
					requestAnimationFrame(() => textareaRef.current?.focus());
					break;
				case "RESTORE_FOCUS":
					// Dialog restores focus to the trigger on close.
					break;
			}
		}
	}, [effectTick, runSubmitEffect]);

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

	const pending = hasPendingSlips(state);

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
				<DialogBody>
					{/* Compose is a sentence being written — prose measure (Pass 3). */}
					<div className="measure-prose">
						<Textarea
							ref={textareaRef}
							value={state.text}
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

					{state.slips.length > 0 ? (
						<ul aria-label="Captures filing" className="mt-4 space-y-2">
							{state.slips.map((slip) => (
								<SlipRow
									key={slip.id}
									slip={slip}
									onRetry={() => dispatch({ type: "RETRY", id: slip.id })}
									onDismiss={() => dispatch({ type: "DISMISS", id: slip.id })}
								/>
							))}
						</ul>
					) : null}
				</DialogBody>
				<DialogFooter>
					<p
						role="status"
						aria-live="polite"
						className="min-w-2 flex-1 font-mono text-meta uppercase tracking-widest text-ink-4"
					>
						{pending ? "Filing…" : ""}
					</p>
					<Button variant="tertiary" size="sm" onClick={closePalette}>
						Done
					</Button>
					<Button
						type="button"
						variant="primary"
						size="sm"
						onClick={submit}
						disabled={isBlank(state.text)}
					>
						Capture
					</Button>
				</DialogFooter>
			</Dialog>
		</>
	);
}

/**
 * One submitted capture. Shows the words it is carrying so a slow slip is
 * still identifiable, then its receipt — or a retry when it failed.
 */
function SlipRow({
	slip,
	onRetry,
	onDismiss,
}: {
	slip: CaptureSlip;
	onRetry: () => void;
	onDismiss: () => void;
}) {
	const tone =
		slip.status === "error"
			? "text-error"
			: slip.receipt?.tone === "needs_review"
				? "text-accent"
				: "text-ink";

	return (
		<li className="flex items-start gap-3 border-line border-t pt-2">
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm text-ink-2">{slip.text}</p>
				<div role="status" aria-live="polite">
					{slip.status === "error" ? (
						<p className="text-sm text-error">
							{slip.offline ? "Offline — kept." : "Couldn't save — kept."}
						</p>
					) : (
						<p className={`text-sm ${tone}`}>
							{slip.receipt?.title}
							{slip.status === "done" && slip.receipt ? ` — ${slip.receipt.lines.join(" ")}` : "…"}
						</p>
					)}
				</div>
			</div>
			{slip.status === "error" ? (
				<Button variant="tertiary" size="sm" onClick={onRetry}>
					Retry
				</Button>
			) : null}
			{slip.status === "done" ? (
				<Button
					variant="tertiary"
					size="sm"
					onClick={onDismiss}
					aria-label={`Dismiss receipt for ${slip.text}`}
				>
					Clear
				</Button>
			) : null}
		</li>
	);
}
