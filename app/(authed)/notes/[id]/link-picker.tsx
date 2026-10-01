"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import { attachLinkAction, searchLinkTargetsAction } from "../actions";

type TargetType = "task" | "event";
type SearchResult = { id: string; label: string };

const LABELS: Record<TargetType, string> = {
	task: "+ Link task",
	event: "+ Link event",
};

export function LinkPicker({ noteId }: { noteId: string }) {
	const router = useRouter();
	const [open, setOpen] = useState<TargetType | null>(null);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchResult[]>([]);
	const [pending, startTransition] = useTransition();
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
	// Only the latest search may land: each search, toggle and close takes a
	// new id, so a slow older query never overwrites a newer one.
	const requestRef = useRef(0);

	useEffect(
		() => () => {
			clearTimeout(debounceRef.current);
			requestRef.current++;
		},
		[],
	);

	function cancelSearch() {
		clearTimeout(debounceRef.current);
		requestRef.current++;
	}

	function search(next: string) {
		setQuery(next);
		cancelSearch();
		if (!open || next.trim() === "") {
			setResults([]);
			return;
		}
		const targetType = open;
		debounceRef.current = setTimeout(() => {
			const id = ++requestRef.current;
			startTransition(async () => {
				const found = await runActionWithResult(
					() => searchLinkTargetsAction(targetType, next),
					[],
				);
				if (id !== requestRef.current) return;
				setResults(found);
			});
		}, 300);
	}

	function toggle(type: TargetType) {
		cancelSearch();
		setOpen(open === type ? null : type);
		setQuery("");
		setResults([]);
	}

	function close() {
		cancelSearch();
		setOpen(null);
		setQuery("");
		setResults([]);
	}

	function attach(targetId: string) {
		if (!open) return;
		const targetType = open;
		startTransition(async () => {
			const ok = await runAction(
				() => attachLinkAction(noteId, targetType, targetId),
				"Couldn't link that.",
			);
			if (ok) {
				close();
				router.refresh();
			}
		});
	}

	return (
		<div className="mt-3">
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="tertiary"
					size="sm"
					disabled={pending}
					onClick={() => toggle("task")}
				>
					{LABELS.task}
				</Button>
				<Button
					type="button"
					variant="tertiary"
					size="sm"
					disabled={pending}
					onClick={() => toggle("event")}
				>
					{LABELS.event}
				</Button>
			</div>

			{open && (
				<div className="mt-2">
					<Input
						aria-label={open === "task" ? "Search tasks" : "Search events"}
						value={query}
						onChange={(e) => search(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape") close();
						}}
						placeholder="Search by title…"
					/>
					{results.length > 0 && (
						<ul className="mt-1 border border-line">
							{results.map((r) => (
								<li key={r.id}>
									<button
										type="button"
										onClick={() => attach(r.id)}
										className="block w-full truncate px-2 py-1.5 text-left text-sm text-ink hover:bg-surface active:opacity-70"
									>
										{r.label}
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}

/** Read-only search helper — no toast on empty/failure, just an empty list. */
async function runActionWithResult<T>(action: () => Promise<T>, fallback: T): Promise<T> {
	try {
		return await action();
	} catch {
		return fallback;
	}
}
