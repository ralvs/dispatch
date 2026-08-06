import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { createRoot, type Root } from "react-dom/client";
import { displayTitle } from "@/lib/note-display";
import { sanitizeLabel } from "@/lib/wikilinks";

export type WikilinkCandidate = { id: string; title: string | null; body: string };

const MAX_RESULTS = 8;

// @tiptap/suggestion defaults every instance to the plugin key `suggestion`,
// and ProseMirror rejects two different plugins sharing one key. The editor
// runs this alongside the `@` mention suggestion, so both must be keyed.
const wikilinkSuggestionKey = new PluginKey("wikilinkSuggestion");

function matches(candidate: WikilinkCandidate, query: string, currentNoteId: string): boolean {
	if (candidate.id === currentNoteId) return false;
	if (query === "") return true;
	return displayTitle(candidate).toLowerCase().includes(query.toLowerCase());
}

function WikilinkMenu({
	items,
	selectedIndex,
	onSelect,
}: {
	items: WikilinkCandidate[];
	selectedIndex: number;
	onSelect: (item: WikilinkCandidate) => void;
}) {
	if (items.length === 0) {
		return (
			<div className="rounded-control border border-line bg-surface px-3 py-2 text-meta text-ink-4 elevation-overlay">
				No matching notes
			</div>
		);
	}

	return (
		<ul className="min-w-48 rounded-control border border-line bg-surface py-1 elevation-overlay">
			{items.map((item, index) => (
				<li key={item.id}>
					<button
						type="button"
						onMouseDown={(e) => {
							// Prevent the editor from losing focus/selection before the command runs.
							e.preventDefault();
							onSelect(item);
						}}
						className={`block w-full truncate px-3 py-1.5 text-left text-meta active:translate-y-px ${
							index === selectedIndex ? "bg-accent-bg text-accent-ink" : "text-ink-2"
						}`}
					>
						{displayTitle(item)}
					</button>
				</li>
			))}
		</ul>
	);
}

/** Builds the `[[` wikilink autocomplete extension for a given note's editor. */
export function createWikilinkSuggestionExtension(
	noteTitles: WikilinkCandidate[],
	currentNoteId: string,
) {
	return Extension.create({
		name: "wikilinkSuggestion",

		addProseMirrorPlugins() {
			let root: Root | null = null;
			let dropdown: HTMLDivElement | null = null;
			let selectedIndex = 0;
			let currentItems: WikilinkCandidate[] = [];
			let selectItem: (item: WikilinkCandidate) => void = () => {};

			function destroyDropdown() {
				root?.unmount();
				root = null;
				dropdown?.remove();
				dropdown = null;
			}

			function renderMenu() {
				if (!root) return;
				root.render(
					<WikilinkMenu items={currentItems} selectedIndex={selectedIndex} onSelect={selectItem} />,
				);
			}

			function positionDropdown(clientRect: (() => DOMRect | null) | null | undefined) {
				if (!dropdown) return;
				const rect = clientRect?.();
				if (!rect) return;
				dropdown.style.left = `${rect.left + window.scrollX}px`;
				dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
			}

			return [
				Suggestion({
					editor: this.editor,
					pluginKey: wikilinkSuggestionKey,
					char: "[[",
					allowSpaces: true,
					startOfLine: false,
					items: ({ query }: { query: string }) =>
						noteTitles.filter((c) => matches(c, query, currentNoteId)).slice(0, MAX_RESULTS),
					command: ({ editor, range, props }) => {
						const item = props as WikilinkCandidate;
						editor
							.chain()
							.focus()
							.insertContentAt(range, [
								{
									type: "wikilink",
									attrs: { id: item.id, label: sanitizeLabel(displayTitle(item)) },
								},
								{ type: "text", text: " " },
							])
							.run();
					},
					render: () => {
						return {
							onStart: (props: SuggestionProps<WikilinkCandidate>) => {
								currentItems = props.items;
								selectedIndex = 0;
								selectItem = props.command;

								dropdown = document.createElement("div");
								dropdown.style.position = "absolute";
								dropdown.style.zIndex = "50";
								document.body.appendChild(dropdown);
								root = createRoot(dropdown);

								positionDropdown(props.clientRect);
								renderMenu();
							},
							onUpdate: (props: SuggestionProps<WikilinkCandidate>) => {
								currentItems = props.items;
								selectedIndex = Math.min(selectedIndex, Math.max(currentItems.length - 1, 0));
								selectItem = props.command;
								positionDropdown(props.clientRect);
								renderMenu();
							},
							onKeyDown: (props: { event: KeyboardEvent }) => {
								if (currentItems.length === 0) return false;
								if (props.event.key === "ArrowDown") {
									selectedIndex = (selectedIndex + 1) % currentItems.length;
									renderMenu();
									return true;
								}
								if (props.event.key === "ArrowUp") {
									selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
									renderMenu();
									return true;
								}
								if (props.event.key === "Enter") {
									const item = currentItems[selectedIndex];
									if (item) selectItem(item);
									return true;
								}
								if (props.event.key === "Escape") {
									destroyDropdown();
									return true;
								}
								return false;
							},
							onExit: () => {
								destroyDropdown();
							},
						};
					},
				}),
			];
		},
	});
}
