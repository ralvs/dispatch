import { PageSkeleton } from "@/components/ui";

export default function Loading() {
	return (
		<PageSkeleton
			title="Ask"
			subtitle="Read-only over your tasks, notes, quotes and projects."
			rows={4}
		/>
	);
}
