"use client";

import type { Editor } from "@tiptap/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
	activeIndexForScroll,
	blocksOverflow,
	maxTicksForHeight,
	previewFromText,
	roleForNodeName,
	scrollTopForTick,
	TICK_GAP_PX,
	type TickSpec,
	tickThickness,
	tickWidth,
	tickWindow,
} from "@/lib/note-ticks/layout";

type LiveTick = TickSpec & { el: HTMLElement };

/** Chevrons plus breathing room. What the dash stack may not eat. */
const RAIL_CHROME_PX = 120;

function collectTicks(editor: Editor, titleEl: HTMLInputElement | null): LiveTick[] {
	const ticks: LiveTick[] = [];
	if (titleEl) {
		ticks.push({
			id: "title",
			role: "Title",
			preview: previewFromText(titleEl.value || "Untitled"),
			el: titleEl,
		});
	}
	let offset = 0;
	editor.state.doc.forEach((node) => {
		const pos = offset;
		offset += node.nodeSize;
		if (node.type.name === "paragraph" && node.content.size === 0) return;
		const role = roleForNodeName(node.type.name);
		if (!role) return;
		const el = editor.view.nodeDOM(pos);
		if (!(el instanceof HTMLElement)) return;
		const preview = previewFromText(node.textContent);
		if (!preview) return;
		ticks.push({ id: `n-${pos}`, role, preview, el });
	});
	return ticks;
}

/*
 * Content-space tops, read fresh. Caching them was tempting and wrong: a font
 * swap or a streamed-in panel moves the blocks without changing the article's
 * own box, so a cached offset silently points at the wrong paragraph. One
 * batch of reads per animation frame is cheap; being wrong is not.
 */
function topsOf(ticks: LiveTick[], scroller: HTMLElement): number[] {
	const origin = scroller.getBoundingClientRect().top - scroller.scrollTop;
	return ticks.map((t) => t.el.getBoundingClientRect().top - origin);
}

/** Vertical run from the first indexed block to the last. */
function blockSpan(ticks: LiveTick[]): number {
	if (ticks.length === 0) return 0;
	const first = ticks[0].el.getBoundingClientRect().top;
	const last = ticks[ticks.length - 1].el.getBoundingClientRect().bottom;
	return last - first;
}

export function TickRail({
	editor,
	titleRef,
	articleRef,
}: {
	editor: Editor;
	titleRef: RefObject<HTMLInputElement | null>;
	articleRef: RefObject<HTMLElement | null>;
}) {
	const [ticks, setTicks] = useState<LiveTick[]>([]);
	const [active, setActive] = useState(0);
	const [hovered, setHovered] = useState<number | null>(null);
	const [hidden, setHidden] = useState(true);
	const [railHeight, setRailHeight] = useState(0);
	const ticksRef = useRef<LiveTick[]>([]);
	const frameRef = useRef(0);

	const syncActive = useCallback((scroller: HTMLElement) => {
		setActive(
			activeIndexForScroll(
				topsOf(ticksRef.current, scroller),
				scroller.scrollTop,
				scroller.clientHeight,
				scroller.scrollHeight,
			),
		);
	}, []);

	/* Rebuild the dash list. Runs on edits and layout changes, never on scroll. */
	const measure = useCallback(() => {
		if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
			setHidden(true);
			return;
		}
		const article = articleRef.current;
		const scroller = document.getElementById("main");
		if (!article || !scroller || !editor) {
			setHidden(true);
			return;
		}
		const next = collectTicks(editor, titleRef.current);
		ticksRef.current = next;
		setTicks(next);
		setRailHeight(Math.max(0, scroller.clientHeight - RAIL_CHROME_PX));
		if (next.length < 2 || !blocksOverflow(blockSpan(next), scroller.clientHeight)) {
			setHidden(true);
			return;
		}
		setHidden(false);
		syncActive(scroller);
	}, [articleRef, editor, syncActive, titleRef]);

	useEffect(() => {
		measure();
		const scroller = document.getElementById("main");
		const article = articleRef.current;
		if (!scroller) return;

		const onScroll = () => {
			if (frameRef.current) return;
			frameRef.current = requestAnimationFrame(() => {
				frameRef.current = 0;
				syncActive(scroller);
			});
		};

		scroller.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", measure);
		const ro = article ? new ResizeObserver(measure) : null;
		if (article) ro?.observe(article);
		editor.on("update", measure);
		// The title is a plain input, so the editor's update event never sees it.
		const titleEl = titleRef.current;
		titleEl?.addEventListener("input", measure);
		return () => {
			if (frameRef.current) cancelAnimationFrame(frameRef.current);
			frameRef.current = 0;
			scroller.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", measure);
			ro?.disconnect();
			editor.off("update", measure);
			titleEl?.removeEventListener("input", measure);
		};
	}, [articleRef, editor, measure, syncActive, titleRef]);

	const jump = useCallback((index: number) => {
		const scroller = document.getElementById("main");
		if (!scroller) return;
		const tops = topsOf(ticksRef.current, scroller);
		const top = tops[index];
		if (top === undefined) return;
		const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		scroller.scrollTo({
			top: scrollTopForTick(top, scroller.clientHeight),
			behavior: smooth ? "smooth" : "auto",
		});
		setActive(index);
	}, []);

	if (hidden || ticks.length < 2) return null;

	const max = maxTicksForHeight(railHeight);
	const { start, end } = tickWindow(ticks.length, active, max);
	const shown = ticks.slice(start, end);

	return (
		<nav
			aria-label="Note sections"
			/* Keyboard focus outranks the mouse: leaving the rail must not blank a
			   pill the user reached with Tab. */
			onMouseLeave={(e) => {
				if (!e.currentTarget.contains(document.activeElement)) setHovered(null);
			}}
			/* Fixed, not sticky: the rail belongs to the viewport's right gutter,
			   outside the 6xl frame, and stays centred whatever the note does. */
			className="group fixed top-1/2 right-2 z-20 hidden -translate-y-1/2 flex-col items-end lg:flex xl:right-5"
		>
			<button
				type="button"
				aria-label="Previous section"
				disabled={active <= 0}
				onClick={() => jump(Math.max(0, active - 1))}
				/* Kept mounted and tabbable, revealed by hover or by focus landing
				   anywhere in the rail — an invisible focusable control is a trap.
				   Opacity is the reveal channel and nothing else: dimming the
				   disabled state with it would outrank `opacity-0` and leave a
				   ghost chevron in the gutter, so disabled reads as colour. */
				className="mb-2 text-ink-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-ink focus-visible:opacity-100 disabled:text-line motion-reduce:transition-none"
			>
				<Icon icon={ChevronUp} size="sm" />
			</button>

			<div className="flex flex-col items-end" style={{ gap: TICK_GAP_PX }}>
				{shown.map((tick, i) => {
					const index = start + i;
					const isActive = index === active;
					const isHover = index === hovered;
					return (
						<div key={tick.id} className="relative flex items-center justify-end">
							<button
								type="button"
								aria-label={`${tick.role}: ${tick.preview}`}
								aria-current={isActive ? "true" : undefined}
								onMouseEnter={() => setHovered(index)}
								onFocus={() => setHovered(index)}
								onBlur={() => setHovered(null)}
								onClick={() => jump(index)}
								className="block rounded-pill transition-all duration-150 motion-reduce:transition-none"
								style={{
									width: tickWidth(isActive || isHover),
									height: tickThickness(isActive || isHover),
									backgroundColor: isActive || isHover ? "var(--ink)" : "var(--ink-3)",
								}}
							/>
							{isHover ? (
								<div
									role="tooltip"
									className="pointer-events-none absolute top-1/2 right-8 z-20 w-56 -translate-y-1/2 rounded-control border border-line bg-surface-2 px-3.5 py-2.5 elevation-overlay"
								>
									<p className="truncate text-sm font-medium text-ink">{tick.preview}</p>
									<p className="mt-0.5 font-mono text-meta text-ink-4">
										{tick.role} · {index + 1}/{ticks.length}
									</p>
								</div>
							) : null}
						</div>
					);
				})}
			</div>

			<button
				type="button"
				aria-label="Next section"
				disabled={active >= ticks.length - 1}
				onClick={() => jump(Math.min(ticks.length - 1, active + 1))}
				className="mt-2 text-ink-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-ink focus-visible:opacity-100 disabled:text-line motion-reduce:transition-none"
			>
				<Icon icon={ChevronDown} size="sm" />
			</button>
		</nav>
	);
}
