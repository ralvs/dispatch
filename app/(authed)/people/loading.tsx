import { CreateTrigger } from "@/components/create-dialog";
import { PageSkeleton } from "@/components/ui";

export default function Loading() {
	return <PageSkeleton title="People" action={<CreateTrigger label="New person" disabled />} />;
}
