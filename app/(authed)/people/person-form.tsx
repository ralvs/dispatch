"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Dialog, DialogBody, DialogFooter, Field, Input, Select } from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import { createPersonAction } from "./actions";
import { RELATIONSHIP_TYPES } from "./constants";

/**
 * Create a person — dialog behind the header's `+ New person` (Gate B / B1).
 * Same rule as projects/quotes/routines: a list of objects opens as a list.
 */
export function PersonCreateButton() {
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();
	const formRef = useRef<HTMLFormElement>(null);

	function submit(formData: FormData) {
		startTransition(async () => {
			const ok = await runAction(
				() => createPersonAction(formData),
				"Couldn't add person. Try again.",
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
				+ New person
			</Button>
			<Dialog open={open} onClose={() => setOpen(false)} title="New person">
				<form ref={formRef} action={submit}>
					<DialogBody className="space-y-4">
						<Field>
							<Input
								name="name"
								required
								placeholder="Name"
								aria-label="Person name"
								size="lg"
								data-autofocus
							/>
						</Field>
						<div className="grid grid-cols-2 gap-3">
							<Field label="Relationship">
								<Select name="relationship_type" defaultValue="">
									{RELATIONSHIP_TYPES.map((r) => (
										<option key={r.value} value={r.value}>
											{r.label}
										</option>
									))}
								</Select>
							</Field>
							<Field label="Company">
								<Input name="company" placeholder="Optional" />
							</Field>
							<Field label="Email">
								<Input name="email" type="email" placeholder="Optional" />
							</Field>
							<Field label="Phone">
								<Input name="phone" placeholder="Optional" />
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
							Add person
						</Button>
					</DialogFooter>
				</form>
			</Dialog>
		</>
	);
}
