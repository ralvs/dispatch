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
export const DOCK_HEIGHT = "h-14";

/** Translucent capsule material: blurred surface, hairline, soft lift. */
export const DOCK_SURFACE =
	"rounded-full border border-line-strong/70 bg-surface/75 shadow-[0_8px_30px_rgba(0,0,0,0.28)] backdrop-blur-xl backdrop-saturate-150";

/** Empty div in the dock row that the capture button portals into. */
export const DOCK_ACTION_SLOT_ID = "dock-action-slot";
