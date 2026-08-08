import { Button, PageSkeleton } from "@/components/ui";

export default function Loading() {
	return (
		<PageSkeleton
			title="People"
			action={
				<Button type="button" variant="secondary" disabled>
					+ New person
				</Button>
			}
		/>
	);
}
