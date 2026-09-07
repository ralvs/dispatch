"use client";

import { useRouter } from "next/navigation";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
	useTransition,
} from "react";
import { findAction } from "@/app/(authed)/find/actions";
import { Dialog, DialogBody, Input, ListRow, rowTitle } from "@/components/ui";
import { OPEN_FIND_EVENT } from "@/lib/find/palette-bus";
import { isFindShortcut } from "@/lib/find/shortcuts";
import type { FindNoteHit, FindResult, FindTaskHit } from "@/lib/services/find";

type Hit = FindTaskHit | FindNoteHit;

function flatten(result: FindResult | null): Hit[] {
	if (!result) return [];
	return [...result.tasks, ...result.notes];
}

function metaFor(hit: Hit, recents: boolean): string {
	if (hit.kind === "task") {
		if (recents) return hit.status;
		if (hit.field === "notes") return "in the task notes";
		return hit.status;
	}
	if (recents) return hit.needsReview ? "need review" : "";
	if (hit.field === "body") return "in the body";
	return hit.needsReview ? "need review" : "";
}

export function FindPalette() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [result, setResult] = useState<FindResult | null>(null);
	const [selected, setSelected] = useState(0);
	const [pending, startTransition] = useTransition();
	const listId = useId();
	const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
	const request = useRef(0);

	const close = useCallback(() => {
		setOpen(false);
		setQuery("");
		setResult(null);
		setSelected(0);
	}, []);

	const runFind = useCallback((q: string) => {
		const id = ++request.current;
		startTransition(async () => {
			const next = await findAction(q);
			if (id !== request.current) return;
			setResult(next);
			setSelected(0);
		});
	}, []);

	useEffect(() => {
		function onOpen() {
			setOpen(true);
		}
		function onKey(event: KeyboardEvent) {
			if (!isFindShortcut(event)) return;
			event.preventDefault();
			setOpen((was) => !was);
		}
		window.addEventListener(OPEN_FIND_EVENT, onOpen);
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener(OPEN_FIND_EVENT, onOpen);
			window.removeEventListener("keydown", onKey);
		};
	}, []);

	useEffect(() => {
		if (!open) {
			setQuery("");
			setResult(null);
			setSelected(0);
			return;
		}
		clearTimeout(debounce.current);
		debounce.current = setTimeout(() => runFind(query), 150);
		return () => clearTimeout(debounce.current);
	}, [open, query, runFind]);

	const hits = flatten(result);

	function go(hit: Hit) {
		close();
		router.push(hit.href);
	}

	function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setSelected((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setSelected((i) => Math.max(i - 1, 0));
			return;
		}
		if (event.key === "Enter") {
			event.preventDefault();
			const hit = hits[selected];
			if (hit) go(hit);
		}
	}

	return (
		<Dialog open={open} onClose={close} title="Find" size="md">
			<DialogBody>
				<Input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					onKeyDown={onKeyDown}
					placeholder="A task or a note"
					aria-label="Find"
					aria-controls={listId}
					aria-autocomplete="list"
					data-autofocus
					autoComplete="off"
				/>
				<div id={listId} role="listbox" aria-label="Find results" className="mt-3">
					{pending && !result ? <p className="font-mono text-meta text-ink-4">Looking…</p> : null}
					{result && hits.length === 0 ? (
						<p className="text-sm italic text-ink-3">Nothing matches.</p>
					) : null}
					{result && result.tasks.length > 0 ? (
						<HitGroup
							label={result.recents ? "Recent tasks" : "Tasks"}
							count={result.tasks.length}
							hits={result.tasks}
							offset={0}
							selected={selected}
							recents={result.recents}
							onPick={go}
							onHover={setSelected}
						/>
					) : null}
					{result && result.notes.length > 0 ? (
						<HitGroup
							label={result.recents ? "Recent notes" : "Notes"}
							count={result.notes.length}
							hits={result.notes}
							offset={result.tasks.length}
							selected={selected}
							recents={result.recents}
							onPick={go}
							onHover={setSelected}
						/>
					) : null}
				</div>
			</DialogBody>
		</Dialog>
	);
}

function HitGroup({
	label,
	count,
	hits,
	offset,
	selected,
	recents,
	onPick,
	onHover,
}: {
	label: string;
	count: number;
	hits: Hit[];
	offset: number;
	selected: number;
	recents: boolean;
	onPick: (hit: Hit) => void;
	onHover: (index: number) => void;
}) {
	return (
		<section className="mt-4 first:mt-3">
			<p className="mb-1 flex items-baseline justify-between font-mono text-eyebrow uppercase tracking-widest text-ink-4">
				<span>{label}</span>
				<span>{count}</span>
			</p>
			<ul>
				{hits.map((hit, i) => {
					const index = offset + i;
					const active = index === selected;
					const meta = metaFor(hit, recents);
					return (
						<ListRow
							key={`${hit.kind}-${hit.id}`}
							align="start"
							className={active ? "bg-surface-2" : ""}
						>
							<button
								type="button"
								role="option"
								aria-selected={active}
								onMouseEnter={() => onHover(index)}
								onClick={() => onPick(hit)}
								className="min-w-0 flex-1 text-left"
							>
								<p className={rowTitle()}>{hit.title}</p>
								{hit.snippet ? <p className="mt-0.5 text-sm text-ink-3">{hit.snippet}</p> : null}
								{meta ? <p className="mt-0.5 font-mono text-meta text-ink-4">{meta}</p> : null}
							</button>
						</ListRow>
					);
				})}
			</ul>
		</section>
	);
}
