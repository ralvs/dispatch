"use client";

import { useState, useTransition } from "react";
import { runAction } from "@/lib/client/toast";
import type { QuoteAnnotationRow, QuoteRow } from "@/lib/services/quotes";
import { createAnnotationAction, deleteQuoteAction, listAnnotationsAction } from "./actions";

export function QuoteRowItem({ quote }: { quote: QuoteRow }) {
	const [pending, startTransition] = useTransition();
	const [expanded, setExpanded] = useState(false);
	const [annotations, setAnnotations] = useState<QuoteAnnotationRow[] | null>(null);
	const [annotationBody, setAnnotationBody] = useState("");

	function toggleExpand() {
		if (!expanded && annotations === null) {
			startTransition(async () => {
				const ok = await runAction(async () => {
					setAnnotations(await listAnnotationsAction(quote.id));
				}, "Couldn't load annotations.");
				if (!ok) return;
			});
		}
		setExpanded((e) => !e);
	}

	function addAnnotation() {
		if (!annotationBody.trim()) return;
		const fd = new FormData();
		fd.set("body", annotationBody);
		startTransition(async () => {
			const ok = await runAction(async () => {
				await createAnnotationAction(quote.id, fd);
				setAnnotations(await listAnnotationsAction(quote.id));
				setAnnotationBody("");
			}, "Couldn't add annotation.");
			if (!ok) return;
		});
	}

	return (
		<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`}>
			<blockquote className="max-w-prose break-words font-serif text-base italic text-ink">
				“{quote.text}”
			</blockquote>
			<p className="mt-1 font-mono text-meta text-ink-4">
				{quote.source_author ?? quote.source_type ?? "—"}
				{annotations !== null
					? ` · ${annotations.length} annotation${annotations.length === 1 ? "" : "s"}`
					: ""}
			</p>
			<div className="mt-2 flex gap-2">
				<button
					type="button"
					aria-label={expanded ? "Collapse annotations" : "Expand annotations"}
					aria-pressed={expanded}
					onClick={toggleExpand}
					className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink active:opacity-70"
				>
					{expanded ? "Hide" : "Annotations"}
				</button>
				<button
					type="button"
					aria-label={`Delete quote "${quote.text.slice(0, 20)}"`}
					disabled={pending}
					onClick={() =>
						startTransition(async () => {
							await runAction(() => deleteQuoteAction(quote.id), "Couldn't delete quote.");
						})
					}
					className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-error hover:border-error active:opacity-70"
				>
					Delete
				</button>
			</div>
			{expanded && (
				<div className="mt-3 space-y-2 border-line border-l pl-3">
					{(annotations ?? []).map((a) => (
						<p key={a.id} className="text-sm text-ink">
							{a.body}
						</p>
					))}
					<div className="flex gap-2">
						<textarea
							value={annotationBody}
							onChange={(e) => setAnnotationBody(e.target.value)}
							rows={2}
							aria-label="Add annotation"
							placeholder="Add a reflection…"
							className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
						/>
						<button
							type="button"
							disabled={pending}
							onClick={addAnnotation}
							className="shrink-0 rounded-md bg-ink px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50 active:opacity-70"
						>
							Add
						</button>
					</div>
				</div>
			)}
		</li>
	);
}
