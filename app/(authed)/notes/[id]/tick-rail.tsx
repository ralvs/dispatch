"use client";

import type { Editor } from "@tiptap/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { type RefObject, useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
	previewFromText,
	roleForNodeName,
	TICK_GAP_PX,
	TICK_WIDTH_PX,
	type TickSpec,
	tickThickness,
} from "@/lib/note-ticks/layout";

type LiveTick = TickSpec & { el: HTMLElement };

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

function readingLineTop(scroller: HTMLElement): number {
	const rect = scroller.getBoundingClientRect();
	return rect.top + rect.height * 0.3;
}

function indexAtReadingLine(ticks: LiveTick[], scroller: HTMLElement): number {
	const line = readingLineTop(scroller);
	for (let i = 0; i < ticks.length; i++) {
		const rect = ticks[i].el.getBoundingClientRect();
		if (rect.top <= line && rect.bottom > line) return i;
	}
	if (ticks.length === 0) return 0;
	if (ticks[0].el.getBoundingClientRect().top >= line) return 0;
	return ticks.length - 1;
}

function noteFits(article: HTMLElement, scroller: HTMLElement): boolean {
	return article.getBoundingClientRect().height <= scroller.clientHeight - 24;
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
	const [railHot, setRailHot] = useState(false);
	const [hidden, setHidden] = useState(true);

	const recalc = useCallback(() => {
		if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
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
		setTicks(next);
		if (next.length < 2 || noteFits(article, scroller)) {
			setHidden(true);
			return;
		}
		setHidden(false);
		setActive(indexAtReadingLine(next, scroller));
	}, [articleRef, editor, titleRef]);

	useEffect(() => {
		recalc();
		const scroller = document.getElementById("main");
		const article = articleRef.current;
		if (!scroller) return;
		const onScroll = () => {
			const live = collectTicks(editor, titleRef.current);
			setTicks(live);
			setActive(indexAtReadingLine(live, scroller));
		};
		scroller.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", recalc);
		const ro = article ? new ResizeObserver(recalc) : null;
		if (article) ro?.observe(article);
		editor.on("update", recalc);
		return () => {
			scroller.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", recalc);
			ro?.disconnect();
			editor.off("update", recalc);
		};
	}, [articleRef, editor, recalc, titleRef]);

	function jump(index: number) {
		const tick = ticks[index];
		if (!tick) return;
		tick.el.scrollIntoView({ block: "start" });
		tick.el.focus?.({ preventScroll: true });
		setActive(index);
	}

	if (hidden || ticks.length < 2) return null;

	return (
		<aside
			aria-label="Note sections"
			onMouseEnter={() => setRailHot(true)}
			onMouseLeave={() => {
				setRailHot(false);
				setHovered(null);
			}}
			className="pointer-events-none absolute top-2 right-0 z-10 hidden w-6 flex-col items-end lg:flex"
		>
			<div className="pointer-events-auto sticky top-24 flex flex-col items-end">
				{railHot ? (
					<button
						type="button"
						aria-label="Previous section"
						disabled={active <= 0}
						onClick={() => jump(Math.max(0, active - 1))}
						className="mb-1 text-ink-4 hover:text-ink disabled:opacity-30"
					>
						<Icon icon={ChevronUp} size="sm" />
					</button>
				) : null}

				<div className="relative flex flex-col items-end" style={{ gap: TICK_GAP_PX }}>
					{ticks.map((tick, i) => {
						const isActive = i === active;
						const isHover = i === hovered;
						const thick = tickThickness(isActive || isHover);
						return (
							<div key={tick.id} className="relative">
								<button
									type="button"
									aria-label={`${tick.role}: ${tick.preview}`}
									aria-current={isActive ? "true" : undefined}
									onMouseEnter={() => setHovered(i)}
									onClick={() => jump(i)}
									className={`block rounded-pill transition-transform motion-reduce:transition-none ${
										isHover ? "-translate-x-1" : ""
									}`}
									style={{
										width: TICK_WIDTH_PX,
										height: thick,
										backgroundColor: isActive || isHover ? "var(--ink)" : "var(--ink-4)",
									}}
								/>
								{isHover ? (
									<div
										role="tooltip"
										className="absolute top-1/2 right-7 z-20 w-56 -translate-y-1/2 rounded-[18px] border border-line bg-surface-2 px-3.5 py-2.5 elevation-overlay"
									>
										<p className="truncate text-sm font-medium text-ink">{tick.preview}</p>
										<p className="mt-0.5 font-mono text-meta text-ink-4">
											{tick.role} · {i + 1}/{ticks.length}
										</p>
									</div>
								) : null}
							</div>
						);
					})}
				</div>

				{railHot ? (
					<button
						type="button"
						aria-label="Next section"
						disabled={active >= ticks.length - 1}
						onClick={() => jump(Math.min(ticks.length - 1, active + 1))}
						className="mt-1 text-ink-4 hover:text-ink disabled:opacity-30"
					>
						<Icon icon={ChevronDown} size="sm" />
					</button>
				) : null}
			</div>
		</aside>
	);
}
