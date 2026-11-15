import { Editor, Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, expect, it, vi } from "vitest";
import { handleIOSParagraph, IOSEnter, isIOS } from "./ios-enter-extension";

// Return on an iPhone with autocorrect or a prediction pending arrives as
// keyCode 229, which ProseMirror skips. WebKit's cancelable `insertParagraph`
// beforeinput is the one signal left; the editor's Enter must run on it.

const IPHONE_UA =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1";

let editor: Editor | undefined;
afterEach(() => {
	editor?.destroy();
	editor = undefined;
	vi.restoreAllMocks();
});

function make(content: string, extra: Extension[] = []): Editor {
	editor = new Editor({ extensions: [StarterKit, IOSEnter, ...extra], content });
	return editor;
}

function insertParagraph(cancelable = true): InputEvent {
	return new InputEvent("beforeinput", {
		inputType: "insertParagraph",
		cancelable,
		bubbles: true,
	});
}

function lastIOSEnter(e: Editor): { lastIOSEnter: number } {
	return (e.view as unknown as { input: { lastIOSEnter: number } }).input;
}

it("runs the editor's Enter when ProseMirror's own iOS path is off", () => {
	const e = make("<p>one</p>");
	e.commands.setTextSelection(4);
	const event = insertParagraph();
	expect(handleIOSParagraph(e.view, event)).toBe(true);
	expect(event.defaultPrevented).toBe(true);
	expect(e.getHTML()).toBe("<p>one</p><p></p>");
});

it("follows the list's Enter, not a bare paragraph split", () => {
	const e = make("<ul><li><p>one</p></li></ul>");
	// Inside the list item's paragraph, after "one": ul, li, p, then 3 letters.
	e.commands.setTextSelection(6);
	expect(handleIOSParagraph(e.view, insertParagraph())).toBe(true);
	// The trailing paragraph is StarterKit's TrailingNode, there before the press.
	expect(e.getHTML()).toBe("<ul><li><p>one</p></li><li><p></p></li></ul><p></p>");
});

it("leaves the press to ProseMirror when a keyCode 13 keydown armed its flag", () => {
	const e = make("<p>one</p>");
	e.commands.setTextSelection(4);
	lastIOSEnter(e).lastIOSEnter = Date.now();
	const event = insertParagraph();
	expect(handleIOSParagraph(e.view, event)).toBe(false);
	expect(event.defaultPrevented).toBe(false);
	expect(e.getHTML()).toBe("<p>one</p>");
});

it("clears a stale flag so ProseMirror does not run Enter twice", () => {
	const e = make("<p>one</p>");
	e.commands.setTextSelection(4);
	lastIOSEnter(e).lastIOSEnter = Date.now() - 1000;
	expect(handleIOSParagraph(e.view, insertParagraph())).toBe(true);
	expect(lastIOSEnter(e).lastIOSEnter).toBe(0);
	expect(e.getHTML()).toBe("<p>one</p><p></p>");
});

it("ignores events it must not cancel", () => {
	const e = make("<p>one</p>");
	e.commands.setTextSelection(4);
	expect(handleIOSParagraph(e.view, insertParagraph(false))).toBe(false);
	const lineBreak = new InputEvent("beforeinput", {
		inputType: "insertLineBreak",
		cancelable: true,
	});
	expect(handleIOSParagraph(e.view, lineBreak)).toBe(false);
	e.setEditable(false);
	expect(handleIOSParagraph(e.view, insertParagraph())).toBe(false);
	expect(e.getHTML()).toBe("<p>one</p>");
});

it("lets WebKit split natively, and logs, when the Enter handler throws", () => {
	const boom = Extension.create({
		name: "boom",
		priority: 10_000,
		addProseMirrorPlugins: () => [
			new Plugin({
				props: {
					handleKeyDown: () => {
						throw new Error("boom");
					},
				},
			}),
		],
	});
	const e = make("<p>one</p>", [boom]);
	const logged = vi.spyOn(console, "error").mockImplementation(() => {});
	const event = insertParagraph();
	expect(handleIOSParagraph(e.view, event)).toBe(false);
	expect(event.defaultPrevented).toBe(false);
	expect(logged).toHaveBeenCalledWith("[ios-enter] Enter handler failed", expect.any(Error));
});

it("handles a real beforeinput on an iPhone, and nowhere else", () => {
	const ua = vi.spyOn(navigator, "userAgent", "get");
	const e = make("<p>one</p>");
	e.commands.setTextSelection(4);

	ua.mockReturnValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
	const desktop = insertParagraph();
	e.view.dom.dispatchEvent(desktop);
	expect(desktop.defaultPrevented).toBe(false);
	expect(e.getHTML()).toBe("<p>one</p>");

	ua.mockReturnValue(IPHONE_UA);
	const phone = insertParagraph();
	e.view.dom.dispatchEvent(phone);
	expect(phone.defaultPrevented).toBe(true);
	expect(e.getHTML()).toBe("<p>one</p><p></p>");
});

it("tells iPhones and iPads from other devices", () => {
	expect(isIOS({ userAgent: IPHONE_UA, platform: "iPhone", maxTouchPoints: 5 })).toBe(true);
	// iPadOS asks for desktop sites with a Mac user agent.
	expect(isIOS({ userAgent: "Macintosh", platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
	expect(isIOS({ userAgent: "Macintosh", platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
	expect(isIOS({ userAgent: "Android", platform: "Linux armv8l", maxTouchPoints: 5 })).toBe(false);
});
