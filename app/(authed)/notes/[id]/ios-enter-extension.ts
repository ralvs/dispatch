import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

// Return on an iPhone keyboard did not start a new line in a note.
//
// ProseMirror never cancels Enter on iOS: cancelling it confuses the virtual
// keyboard. Its keydown handler arms a flag instead, lets WebKit split the
// paragraph in the DOM, and then runs the editor's Enter in place of that DOM
// change. The flag is armed only for a keydown with keyCode 13 that comes
// outside a composition. A real iPhone often sends something else: with
// autocorrect or a word prediction pending, Return arrives as keyCode 229 (a
// composition key), or within 500ms of a compositionend, and ProseMirror
// skips both. WebKit then splits the paragraph on its own, and ProseMirror
// reads that split back as a plain text change, or not at all.
//
// WebKit announces the split first, with a cancelable `beforeinput` of type
// `insertParagraph`. When ProseMirror did not arm its flag for that press,
// cancel the native split and run the editor's Enter, the same handlers a
// desktop Enter runs (lists, tables, the `@` and `[[` menus).

/** ProseMirror's own iOS Enter flag. Internal to prosemirror-view, so read defensively. */
type InputState = { lastIOSEnter?: number };

// ProseMirror trusts its flag for 225ms after the keydown (readDOMChange).
const IOS_ENTER_WINDOW_MS = 225;

function inputState(view: EditorView): InputState | undefined {
	return (view as unknown as { input?: InputState }).input;
}

export function isIOS(nav: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">): boolean {
	// iPadOS reports a Mac user agent; a touch screen tells them apart.
	return (
		/iPad|iPhone|iPod/.test(nav.userAgent) ||
		(nav.platform === "MacIntel" && nav.maxTouchPoints > 1)
	);
}

/** An Enter keydown as ProseMirror builds its own: a handler may read `key` or `keyCode`. */
function enterKeydown(): KeyboardEvent {
	const event = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", cancelable: true });
	Object.defineProperty(event, "keyCode", { value: 13 });
	Object.defineProperty(event, "which", { value: 13 });
	return event;
}

/**
 * Runs the editor's Enter for a native paragraph split that ProseMirror will
 * not catch. Returns true when it handled the event (and cancelled it).
 */
export function handleIOSParagraph(view: EditorView, event: InputEvent): boolean {
	if (event.inputType !== "insertParagraph" || !event.cancelable) return false;
	// Mid-composition the keyboard still owns the text, and running Enter can
	// corrupt it. ProseMirror ends its composition on compositionend, which
	// WebKit fires before it splits the paragraph.
	if (view.composing || !view.editable) return false;

	const input = inputState(view);
	const armed = (input?.lastIOSEnter ?? 0) > Date.now() - IOS_ENTER_WINDOW_MS;
	// ProseMirror's own path is on: it will turn the DOM split into an Enter.
	if (armed) return false;

	let handled = false;
	try {
		handled = view.someProp("handleKeyDown", (handler) => handler(view, enterKeydown())) === true;
	} catch (error) {
		// Let WebKit split the paragraph natively rather than lose the press.
		console.error("[ios-enter] Enter handler failed", error);
		return false;
	}
	if (!handled) return false;

	event.preventDefault();
	// No DOM split follows now, so ProseMirror must not run Enter a second time.
	if (input) input.lastIOSEnter = 0;
	return true;
}

export const IOSEnter = Extension.create({
	name: "iosEnter",
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("iosEnter"),
				props: {
					handleDOMEvents: {
						beforeinput: (view, event) =>
							typeof navigator !== "undefined" &&
							isIOS(navigator) &&
							handleIOSParagraph(view, event as InputEvent),
					},
				},
			}),
		];
	},
});
