import { TaskEditorLoading } from "@/components/task-editor";

// The dialog opens on the click; the row fills it when it lands.
export default function TaskModalLoading() {
	return <TaskEditorLoading exit="back" />;
}
