/**
 * The two ground colours, for the places that cannot read CSS.
 *
 * `--bg` in app/globals.css is the source of truth. Next's static metadata
 * exports — `viewport.themeColor` and the web manifest — are serialized at
 * build time and never see a custom property, so the value has to be repeated
 * in TypeScript. Repeated once, here, rather than at each of the five call
 * sites it was spread across.
 *
 * This does not close the loop: nothing links these back to `--bg`, and they
 * can still drift from it silently. Generating both from one source is more
 * machinery than two colours warrant — so if you retune the ground, change it
 * here too.
 */
export const GROUND_LIGHT = "#fafafa";
export const GROUND_DARK = "#1a1817";
