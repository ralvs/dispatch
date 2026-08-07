/**
 * The one axis the Today comps differ on.
 *
 * Two compositions were fully designed and rendered, and they differ on
 * exactly one thing — how **progress and priority** are drawn. Everything else
 * (header, day tape, timeline, Top 3, streak trails, quote card, empty states,
 * late labels) is identical between them.
 *
 *   ring — a completion ring on routines and projects; priority as a ring on
 *          the checkbox, with a halo on high and the title stepped to 500.
 *   rail — a horizontal bar on routines and projects; priority as a left rail
 *          whose height and opacity encode P1/P2/P3.
 *
 * A2 (ring) is what ships. This constant exists so reverting to A1 stays a
 * one-line change rather than a redesign: every site that draws progress or
 * priority reads it from here instead of hard-coding a rendering.
 *
 * Comps: .impeccable/mocks/today-a2-ring.html and today-a1-rail.html.
 */
export type TodayVariant = "ring" | "rail";

export const TODAY_VARIANT: TodayVariant = "ring";

/** Which `Progress` rendering the variant asks for. */
export const PROGRESS_RENDER = TODAY_VARIANT === "ring" ? "ring" : "bar";
