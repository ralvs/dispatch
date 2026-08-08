"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Dialog, DialogBody, DialogFooter, Field, Input, Select } from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import { TIME_OF_DAY_LABELS, TIME_OF_DAY_ORDER } from "@/lib/schemas/routine";
import { createRoutineAction } from "./actions";

/** Create a routine — dialog behind `+ New routine` (Gate B / B1). */
export function RoutineCreateButton() {
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();
	const formRef = useRef<HTMLFormElement>(null);

	function submit(formData: FormData) {
		startTransition(async () => {
			const ok = await runAction(
				() => createRoutineAction(formData),
				"Couldn't add routine. Try again.",
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
				+ New routine
			</Button>
			<Dialog open={open} onClose={() => setOpen(false)} title="New routine">
				<form ref={formRef} action={submit}>
					<DialogBody className="space-y-4">
						<Field label="Name">
							<Input
								name="name"
								required
								aria-label="Routine name"
								placeholder="Stretch, read, drink water…"
								className="text-base"
								data-autofocus
							/>
						</Field>
						<Field label="Time of day">
							<Select name="time_of_day" defaultValue="anytime">
								{TIME_OF_DAY_ORDER.map((t) => (
									<option key={t} value={t}>
										{TIME_OF_DAY_LABELS[t]}
									</option>
								))}
							</Select>
						</Field>
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
							Add routine
						</Button>
					</DialogFooter>
				</form>
			</Dialog>
		</>
	);
}
