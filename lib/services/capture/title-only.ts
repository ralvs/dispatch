// Title-only create → sentence parser. Client-safe: TaskDialog reads FormData
// at submit; the same predicate is unit-tested here (docs/adr/0043).

/** Every field still in the state the create form opened in. */
export function titleOnlyCreate(formData: FormData): boolean {
	const blank = (name: string) => String(formData.get(name) ?? "").trim() === "";
	return (
		blank("due_date") &&
		blank("due_time") &&
		blank("notes") &&
		blank("domain_id") &&
		blank("project_id") &&
		blank("recurrence_rule") &&
		String(formData.get("priority") ?? "4") === "4"
	);
}
