/**
 * A PostgREST list literal for `.not(col, "in", …)` / `.in` filters, every
 * value double-quoted. Inside the quotes a backslash is the escape character,
 * so it is escaped first and the quote second — otherwise a value ending in
 * `\` escapes its own closing quote and the filter matches the wrong rows.
 */
export function inListLiteral(values: Iterable<string>): string {
	const quoted = [...values].map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
	return `(${quoted.join(",")})`;
}
