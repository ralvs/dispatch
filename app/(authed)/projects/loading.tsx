import { CreateTrigger } from "@/components/create-dialog";
import { PageSkeleton } from "@/components/ui";

export default function Loading() {
	return (
		<PageSkeleton
			title="Projects"
			// Disabled rather than absent — create is not data (PageSkeleton).
			action={<CreateTrigger label="+ New project" disabled />}
		/>
	);
}
