"use client";

import { useEffect } from "react";
import { TaskEditorProblem } from "@/components/task-editor";

/**
 * A task loaded by its URL whose read failed: the dialog's own failure frame,
 * with a retry, rather than the route's generic one (#97). It stands in for
 * the board too; Close leaves for `/tasks`, which reads it again.
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
