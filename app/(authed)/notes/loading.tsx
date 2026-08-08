import { Button, PageSkeleton } from "@/components/ui";

export default function Loading() {
	return (
		<PageSkeleton
			title="Notes"
			action={
				<Button type="button" variant="secondary" disabled>
					+ New note
				</Button>
			}
		/>
	);
}
