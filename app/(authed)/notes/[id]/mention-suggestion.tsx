import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { createRoot, type Root } from "react-dom/client";
import { suggestionEmpty, suggestionOption, suggestionPanel } from "@/components/ui";
import { type MentionCandidate, normalizeName } from "@/lib/mentions";

// Cloned from wikilink-suggestion.tsx (the template), swapped to `@` and the
// people candidate list (docs/adr/0030). Matching uses the same
// normalizeName the task-side autocomplete and the save-time resolver use,
// so "what the dropdown offers" and "what a plain @Name would resolve to"
// never disagree.

const MAX_RESULTS = 8;

// Distinct from the wikilink suggestion's key — see the note there; the
// shared `suggestion` default would make ProseMirror throw at editor mount.
const mentionSuggestionKey = new PluginKey("mentionSuggestion");

function matches(candidate: MentionCandidate, query: string): boolean {
	if (query === "") return true;
	return normalizeName(candidate.name).includes(normalizeName(query));
}

function MentionMenu({
	items,
	selectedIndex,
	onSelect,
}: {
	items: MentionCandidate[];
	selectedIndex: number;
	onSelect: (item: MentionCandidate) => void;
}) {
	if (items.length === 0) {
		return <div className={suggestionEmpty}>No matching people</div>;
	}

	return (
		<ul className={`min-w-48 ${suggestionPanel}`}>
			{items.map((item, index) => (
				<li key={item.id}>
					<button
						type="button"
						onMouseDown={(e) => {
							// Prevent the editor from losing focus/selection before the command runs.
							e.preventDefault();
							onSelect(item);
						}}
						className={suggestionOption(index === selectedIndex)}
					>
						{item.name}
					</button>
				</li>
			))}
		</ul>
	);
}

/** Builds the `@` mention autocomplete extension for a given note's editor. */
export function createMentionSuggestionExtension(people: MentionCandidate[]) {
	return Extension.create({
		name: "mentionSuggestion",

		addProseMirrorPlugins() {
			let root: Root | null = null;
			let dropdown: HTMLDivElement | null = null;
			let selectedIndex = 0;
			let currentItems: MentionCandidate[] = [];
			let selectItem: (item: MentionCandidate) => void = () => {};

			function destroyDropdown() {
				root?.unmount();
				root = null;
				dropdown?.remove();
				dropdown = null;
			}

			function renderMenu() {
				if (!root) return;
				root.render(
					<MentionMenu items={currentItems} selectedIndex={selectedIndex} onSelect={selectItem} />,
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
					pluginKey: mentionSuggestionKey,
					char: "@",
					allowSpaces: true,
					startOfLine: false,
					items: ({ query }: { query: string }) =>
						people.filter((c) => matches(c, query)).slice(0, MAX_RESULTS),
					command: ({ editor, range, props }) => {
						const item = props as MentionCandidate;
						editor
							.chain()
							.focus()
							.insertContentAt(range, [
								{
									type: "mention",
									attrs: { id: item.id, name: item.name },
								},
								{ type: "text", text: " " },
							])
							.run();
					},
					render: () => {
						return {
							onStart: (props: SuggestionProps<MentionCandidate>) => {
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
							onUpdate: (props: SuggestionProps<MentionCandidate>) => {
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
