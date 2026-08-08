import { Button, PageSkeleton } from "@/components/ui";

export default function Loading() {
	return (
		<PageSkeleton
			title="Routines"
			action={
				<Button type="button" variant="secondary" disabled>
					+ New routine
				</Button>
			}
		/>
	);
}
