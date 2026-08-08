"use client";

import { useRef, useState, useTransition } from "react";
import {
	Button,
	Dialog,
	DialogBody,
	DialogFooter,
	Field,
	Input,
	Select,
	Textarea,
} from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import { createQuoteAction } from "./actions";

const SOURCE_TYPES = [
	{ value: "", label: "Unspecified" },
	{ value: "book", label: "Book" },
	{ value: "article", label: "Article" },
	{ value: "podcast", label: "Podcast" },
	{ value: "video", label: "Video" },
	{ value: "conversation", label: "Conversation" },
	{ value: "other", label: "Other" },
];

/** Create a quote — dialog behind `+ New quote` (Gate B / B1). */
export function QuoteCreateButton() {
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();
	const formRef = useRef<HTMLFormElement>(null);

	function submit(formData: FormData) {
		startTransition(async () => {
			const ok = await runAction(
				() => createQuoteAction(formData),
				"Couldn't save quote. Try again.",
			);
			if (ok) {
				formRef.current?.reset();
				setOpen(false);
			}
		});
	}

	return (
		<>
			<Button type="button" variant="secondary" onClick={() => setOpen(true)}>
				+ New quote
			</Button>
			<Dialog open={open} onClose={() => setOpen(false)} title="New quote">
				<form ref={formRef} action={submit}>
					<DialogBody className="space-y-4">
						<Field label="Text">
							<Textarea
								name="text"
								required
								rows={3}
								aria-label="Quote text"
								placeholder="Copy it verbatim"
								className="text-base"
								data-autofocus
							/>
						</Field>
						<div className="grid grid-cols-2 gap-3">
							<Field label="Source">
								<Select name="source_type" defaultValue="">
									{SOURCE_TYPES.map((s) => (
										<option key={s.value} value={s.value}>
											{s.label}
										</option>
									))}
								</Select>
							</Field>
							<Field label="Author">
								<Input name="source_author" placeholder="Optional" />
							</Field>
							<Field label="Tags" className="col-span-2">
								<Input name="tags" placeholder="comma, separated" />
							</Field>
						</div>
					</DialogBody>
					<DialogFooter>
						<span className="min-w-2 flex-1" />
						<Button
							type="button"
							variant="tertiary"
							size="sm"
							disabled={pending}
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="primary"
							size="sm"
							isPending={pending}
							disabled={pending}
						>
							Add quote
						</Button>
					</DialogFooter>
				</form>
			</Dialog>
		</>
	);
}
