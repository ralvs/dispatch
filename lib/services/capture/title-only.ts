// Title-only create → sentence parser. Client-safe: TaskDialog reads FormData
// at submit; the same predicate is unit-tested here (docs/adr/0043).

/**
 * Every field still in the state the create form opened in.
 *
 * `domain_id` is deliberately NOT one of them. The form used to open Unfiled,
 * so a set domain meant the operator had reached for the row — but a task may
 * no longer be created without a domain, which made picking one mandatory and
 * would have made this predicate permanently false. That would have retired
 * the sentence parser by accident, through a change about something else.
 *
 * The two compose instead: the sentence is still read for dates and repeats,
 * and the chosen domain is applied over whatever the parser inferred (it is
 * stated, not guessed, so it wins). `project_id` stays in the list — choosing
 * a project is a real act of filing, and it settles the domain with it.
 */
export function titleOnlyCreate(formData: FormData): boolean {
	const blank = (name: string) => String(formData.get(name) ?? "").trim() === "";
	return (
		blank("due_date") &&
		blank("due_time") &&
		blank("notes") &&
		blank("project_id") &&
		blank("recurrence_rule") &&
		String(formData.get("priority") ?? "3") === "3"
	);
}
