import { Button, PageSkeleton } from "@/components/ui";

export default function Loading() {
	return (
		<PageSkeleton
			title="Projects"
			// Disabled rather than absent — create is not data (PageSkeleton).
			action={
				<Button type="button" variant="secondary" disabled>
					+ New project
				</Button>
			}
		/>
	);
}
