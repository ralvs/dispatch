import { CreateTrigger } from "@/components/create-dialog";
import { PageSkeleton } from "@/components/ui";

export default function Loading() {
	return <PageSkeleton title="Domains" action={<CreateTrigger label="+ New domain" disabled />} />;
}
