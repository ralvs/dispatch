"use client";

import { Plus } from "lucide-react";
import { Button } from "./button";
import { Icon } from "./icon";

/**
 * The bare `+` that creates an object from a list page header.
 *
 * Lifted from `/tasks`'s `NewTaskButton` (ADR-0043) and shared so every object
 * list carries the same control: a 32px pill, secondary hairline, icon only.
 * The page title names the collection; the glyph does not need to restate it.
 * `label` is the accessible name and the hover title — never drawn.
 *
 * Lives here (not beside each route's form) so a route's `loading.tsx` can hold
 * the same element the loaded page will render (DESIGN.md, Invisible Slot Rule).
 */
export function HeaderCreateButton({
	label,
	onClick,
	disabled = false,
	type = "button",
}: {
	/** Accessible name — "New task", "New project". Not shown. */
	label: string;
	onClick?: () => void;
	disabled?: boolean;
	/** `submit` for the notes blank-create form; `button` opens a dialog. */
	type?: "button" | "submit";
}) {
	return (
		<Button
			shape="pill"
			variant="secondary"
			size="sm"
			isIconOnly
			type={type}
			onClick={onClick}
			disabled={disabled}
			aria-haspopup={type === "button" ? "dialog" : undefined}
			aria-label={label}
			title={label}
		>
			<Icon icon={Plus} size="md" />
		</Button>
	);
}
