"use client";

import { NotchToaster } from "notch-toast";

/**
 * notch-toast host: one island attached to the top edge, morphing in place.
 * Callers use toastError / toastSuccess / toastNotice / runAction.
 *
 * The island is dark in both themes, so its icon colours are the `--island-*`
 * tokens in globals.css rather than the themed success/error.
 */
export function AppToaster() {
	return <NotchToaster position="top-center" mode="attached" animation="fluid" />;
}
