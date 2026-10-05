import { redirect } from "next/navigation";
import { Suspense } from "react";
import { type TaskFilters, TasksBody, TasksFallback } from "./tasks-body";

type TasksSearch = TaskFilters & { edit?: string };

async function TasksRoute({ searchParams }: { searchParams: Promise<TasksSearch> }) {
	const { edit, ...filters } = await searchParams;
	// `?edit=<id>` was a task's address before it had its own (docs/adr/0079).
	// Old notification rows still carry it, so it goes to `/tasks/<id>`.
	if (edit) redirect(`/tasks/${encodeURIComponent(edit)}`);
	return <TasksBody filters={filters} />;
}

// The header carries data (its measure), so the whole body streams in behind
// the page's own boundary and the old loading.tsx is its fallback (#21). The
// async child is where the entity store gets seeded (#26).
export default function TasksPage({ searchParams }: { searchParams: Promise<TasksSearch> }) {
	return (
		<Suspense fallback={<TasksFallback />}>
			<TasksRoute searchParams={searchParams} />
		</Suspense>
	);
}
