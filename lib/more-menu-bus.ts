/**
 * Bus for the More menu (Pass 4 / C4). Same shape as the capture palette bus:
 * any surface can open or toggle the menu without importing the panel.
 *
 * More is chrome, not a route — there is no /more page. The header tab and the
 * dock item both dispatch through this; the panel lives once in the shell.
 */

export const TOGGLE_MORE_MENU_EVENT = "dispatch:toggle-more-menu";
export const CLOSE_MORE_MENU_EVENT = "dispatch:close-more-menu";

export function toggleMoreMenu(): void {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new Event(TOGGLE_MORE_MENU_EVENT));
}

export function closeMoreMenu(): void {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new Event(CLOSE_MORE_MENU_EVENT));
}
