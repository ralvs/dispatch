import { screen } from "@testing-library/react";

/**
 * The page header's measure reading `1 saved`. The figure and its word are two
 * spans spaced by a margin, so the text has no space to match on.
 */
export function getMeasure(count: number, label: string): HTMLElement {
	return screen.getByText(
		(_, el) =>
			el?.tagName === "SPAN" &&
			el.firstElementChild?.textContent === String(count) &&
			el.textContent === `${count}${label}`,
	);
}
