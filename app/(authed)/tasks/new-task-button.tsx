import { Plus } from "lucide-react";
import { Button, Icon } from "@/components/ui";

/**
 * The `+` that is the whole capture surface on /tasks (ADR-0043).
 *
 * It lives in its own module because two routes render it: the loaded page,
 * where it opens the dialog, and `loading.tsx`, where it holds the slot
 * disabled. Those were two hand-built copies of the same pill and had already
 * drifted — the skeleton's copy carried no `aria-label`, so an icon-only
 * control sat in the header with no accessible name for as long as the query
 * took.
 */
export function NewTaskButton({
	onClick,
	disabled = false,
}: {
	onClick?: () => void;
	disabled?: boolean;
}) {
	return (
		<Button
			shape="pill"
			variant="secondary"
			size="sm"
			isIconOnly
			onClick={onClick}
			disabled={disabled}
			aria-haspopup="dialog"
			aria-label="New task"
			title="New task"
		>
			<Icon icon={Plus} size="md" />
		</Button>
	);
}
