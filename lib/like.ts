/** Escapes `%`, `_` and `\` so a search term is matched literally by like/ilike. */
export function escapeLike(q: string): string {
	return q.replace(/[%_\\]/g, (m) => `\\${m}`);
}
