import { HeaderCreateButton, PageSkeleton } from "@/components/ui";

export default function Loading() {
	return (
		<div>
			<nav aria-label="Breadcrumb" className="pb-4">
				<span className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					← Projects
				</span>
			</nav>
			{/* No title: this route's h1 is the project's name, which is the data
			    still in flight. The + is not data — hold its slot disabled. */}
			<PageSkeleton rows={5} action={<HeaderCreateButton label="Add task" disabled />} />
		</div>
	);
}
