import { CreateTrigger } from "@/components/create-dialog";
import { PageSkeleton } from "@/components/ui";

export default function Loading() {
	return (
		<PageSkeleton title="Routines" action={<CreateTrigger label="+ New routine" disabled />} />
	);
}
