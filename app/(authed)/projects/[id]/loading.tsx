import { PageSkeleton } from "@/components/ui";

// No title: this route's h1 is the project's name, which is the data still in
// flight. PageSkeleton holds the h1's geometry with a placeholder instead.
export default function Loading() {
	return <PageSkeleton rows={5} />;
}
