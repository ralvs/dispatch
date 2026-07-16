// Parses the `?capture=voice` deep link used by the manifest shortcut and any
// other launcher that wants to land straight in dictation. Pure and
// framework-free so the palette's mount effect can stay a thin caller.

export function readCaptureIntent(search: string): "voice" | null {
	const params = new URLSearchParams(search);
	return params.get("capture") === "voice" ? "voice" : null;
}
