import { HeaderCreateButton, PageSkeleton } from "@/components/ui";

export default function Loading() {
	return (
		<PageSkeleton
			title="Notes"
			// Disabled rather than absent — create is not data (PageSkeleton).
			action={<HeaderCreateButton label="New note" disabled />}
		/>
	);
}
