import { PageSkeleton } from "@/components/ui";
import { NewTaskButton } from "./new-task-button";

export default function Loading() {
	return (
		<PageSkeleton
			title="Tasks"
			rows={8}
			// Disabled rather than absent: the page has exactly one standing
			// action and it is not data, so the slot is held. The dialog it opens
			// needs the domain list, which is what is still in flight.
			action={<NewTaskButton disabled />}
		/>
	);
}
