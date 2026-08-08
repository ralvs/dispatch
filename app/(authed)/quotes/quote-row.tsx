"use client";

import { useState, useTransition } from "react";
import { Button, ListRow, Textarea } from "@/components/ui";
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
		<ListRow align="start" className={pending ? "opacity-50" : ""}>
			<blockquote className="max-w-prose break-words text-base font-normal italic leading-[1.45] text-ink">
				“{quote.text}”
			</blockquote>
			<p className="mt-1 font-mono text-meta text-ink-4">
				{quote.source_author ?? quote.source_type ?? "—"}
				{annotations !== null
					? ` · ${annotations.length} annotation${annotations.length === 1 ? "" : "s"}`
					: ""}
			</p>
			<div className="mt-2 flex gap-2">
				<Button
					type="button"
					variant="tertiary"
					size="sm"
					aria-label={expanded ? "Collapse annotations" : "Expand annotations"}
					aria-pressed={expanded}
					onClick={toggleExpand}
				>
					{expanded ? "Hide" : "Annotations"}
				</Button>
				<Button
					type="button"
					variant="danger"
					size="sm"
					aria-label={`Delete quote "${quote.text.slice(0, 20)}"`}
					disabled={pending}
					onClick={() =>
						startTransition(async () => {
							await runAction(() => deleteQuoteAction(quote.id), "Couldn't delete quote.");
						})
					}
				>
					Delete
				</Button>
			</div>
			{expanded && (
				<div className="mt-3 space-y-2 border-line border-l pl-3">
					{(annotations ?? []).map((a) => (
						<p key={a.id} className="text-sm text-ink">
							{a.body}
						</p>
					))}
					<div className="flex gap-2">
						<Textarea
							value={annotationBody}
							onChange={(e) => setAnnotationBody(e.target.value)}
							rows={2}
							aria-label="Add annotation"
							placeholder="Add a reflection…"
							size="sm"
						/>
						<Button
							type="button"
							variant="primary"
							size="sm"
							className="shrink-0"
							disabled={pending}
							isPending={pending}
							onClick={addAnnotation}
						>
							Add
						</Button>
					</div>
				</div>
			)}
		</ListRow>
	);
}
