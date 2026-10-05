"use client";

import { useEffect } from "react";
import { TaskEditorProblem } from "@/components/task-editor";

/**
 * The read failed: say so in the dialog, with a retry, rather than leave a
 * frame that never fills (#97). The raw error stays in the console.
 */
export default function TaskModalError({
	error,
	retry,
}: {
	error: Error & { digest?: string };
	/** Fetches the task again, not just re-renders (Next 16.3). */
	retry: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);
	return <TaskEditorProblem exit="back" onRetry={retry} />;
}
