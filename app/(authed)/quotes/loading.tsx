import { Button, PageSkeleton } from "@/components/ui";

export default function Loading() {
	return (
		<PageSkeleton
			title="Quotes"
			action={
				<Button type="button" variant="secondary" disabled>
					+ New quote
				</Button>
			}
		/>
	);
}
