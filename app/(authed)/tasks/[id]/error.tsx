"use client";

import { useEffect } from "react";
import { TaskEditorProblem } from "@/components/task-editor";

/**
 * A task loaded by its URL whose read failed: the dialog's own failure frame,
 * with a retry, rather than the route's generic one (#97). An error boundary
 * replaces the whole segment, so the board behind the dialog goes with it;
 * Close leaves for `/tasks`, which reads the board again.
 */
export default function TaskPageError({
	error,
	retry,
}: {
	error: Error & { digest?: string };
	/** Fetches the page again, not just re-renders (Next 16.3). */
	retry: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);
	return <TaskEditorProblem exit="tasks" onRetry={retry} />;
}
