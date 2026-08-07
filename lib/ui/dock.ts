/**
 * The mobile dock: the floating tab-bar pill and the capture button that sits
 * beside it. They are rendered by different components (the bar is nav, the
 * button belongs to the capture palette that owns its open state), so the
 * shared geometry and surface live here — one source of truth keeps the two
 * capsules the same height and the same material.
 *
 * The capture button reaches the dock row by portalling into
 * DOCK_ACTION_SLOT_ID, so both capsules are flex children of one centred row.
 */

/** Height of both capsules. Also the pill's outer height. */
export const DOCK_HEIGHT = "h-[54px]";

/**
 * Shape shared by both capsules: pill radius, hairline, soft lift. The lift is
 * deeper than a card's on purpose — the dock floats over white cards and has
 * to stay a separate object while it does.
 *
 * Deliberately carries no background. The two capsules fill differently, and
 * composing a fill here and overriding it there would leave which one wins to
 * stylesheet order rather than to intent.
 */
export const DOCK_SHELL = "rounded-pill border elevation-overlay";

/** The tab pill: translucent blurred paper, so content passes under it. */
export const DOCK_SURFACE = `${DOCK_SHELL} border-line-strong bg-surface/80 backdrop-blur-xl backdrop-saturate-[1.8]`;

/**
 * The capture capsule: ink-filled and square, so it reads as an action rather
 * than a sixth tab. The active tab takes accent-soft and capture takes ink —
 * two signals that can never be mistaken for one. No blur: it is opaque, and
 * blurring behind an opaque fill only costs a compositor layer.
 */
export const DOCK_ACTION = `${DOCK_SHELL} aspect-square shrink-0 border-ink bg-ink text-bg`;

/** Empty div in the dock row that the capture button portals into. */
export const DOCK_ACTION_SLOT_ID = "dock-action-slot";
