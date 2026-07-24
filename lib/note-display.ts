// Mem/Apple Notes-style index: titles only. Untitled notes fall back to
// their first body line.
export function displayTitle(note: { title: string | null; body: string }): string {
	const title = note.title?.trim();
	if (title) return title;
	const firstLine = note.body.split("\n")[0]?.trim();
	return firstLine || "Untitled";
}
