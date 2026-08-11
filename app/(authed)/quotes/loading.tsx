import { CreateTrigger } from "@/components/create-dialog";
import { PageSkeleton } from "@/components/ui";

export default function Loading() {
	return <PageSkeleton title="Quotes" action={<CreateTrigger label="New quote" disabled />} />;
}
