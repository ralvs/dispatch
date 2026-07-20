// Parses the `?capture=…` deep link used by the manifest shortcut and any
// other launcher that wants to land straight in the capture palette. Pure and
// framework-free so the palette's mount effect can stay a thin caller.
// Accepts any non-empty value (including legacy `voice` from older installs).

export function readCaptureIntent(search: string): boolean {
	const params = new URLSearchParams(search);
	const value = params.get("capture");
	return value !== null && value !== "";
}
