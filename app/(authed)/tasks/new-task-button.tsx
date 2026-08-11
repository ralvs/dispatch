import { HeaderCreateButton } from "@/components/ui";

/**
 * The `+` that is the whole capture surface on /tasks (ADR-0043).
 *
 * Thin wrapper over the shared `HeaderCreateButton` so the route's
 * `loading.tsx` and the loaded page keep one import path, and so a change
 * to the control is not a second edit here.
 */
export function NewTaskButton({
	onClick,
	disabled = false,
}: {
	onClick?: () => void;
	disabled?: boolean;
}) {
	return <HeaderCreateButton label="New task" onClick={onClick} disabled={disabled} />;
}
