import { Plus } from "lucide-react";
import { Button, Icon, PageSkeleton } from "@/components/ui";

export default function Loading() {
	return (
		<PageSkeleton
			title="Tasks"
			rows={8}
			// Disabled rather than absent: the page has exactly one standing
			// action and it is not data, so the slot is held. The dialog it opens
			// needs the domain list, which is what is still in flight.
			action={
				<Button type="button" shape="pill" variant="secondary" size="sm" isIconOnly disabled>
					<Icon icon={Plus} size="md" />
				</Button>
			}
		/>
	);
}
