import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { createRoot, type Root } from "react-dom/client";
import { suggestionEmpty, suggestionOption, suggestionPanel } from "@/components/ui";

/**
 * The `[[` and `@` autocompletes, which were the same 170-line file twice.
 *
 * One was cloned from the other and said so; by the time Pass 5 shared their
 * class strings, 62 of 344 lines differed and every one of those was a
 * configuration value. What was duplicated is the part nobody wants to debug
 * twice: the detached React root's lifecycle, the ProseMirror plugin key, the
 * dropdown's absolute positioning, and the arrow/enter/escape handling.
 *
 * The plugin key is derived from `name` here. @tiptap/suggestion defaults
 * every instance to the key `suggestion` and ProseMirror rejects two plugins
 * sharing one key, so the two extensions previously kept each other distinct
 * via a comment in each file pointing at the other. Two distinct `name`s now
 * do it structurally.
 */

const MAX_RESULTS = 8;

export type SuggestionConfig<T> = {
	/** Extension name, and the seed for the ProseMirror plugin key. Must be unique per editor. */
	name: string;
	/** The trigger, e.g. `"@"` or `"[["`. */
	char: string;
	/** The full candidate pool; filtered per keystroke by `matches`. */
	items: T[];
	/** Whether a candidate survives the current query. Empty query should generally pass. */
	matches: (item: T, query: string) => boolean;
	/** What the row reads as. */
	label: (item: T) => string;
	/** Shown in place of the panel when nothing matches. */
	emptyLabel: string;
	/** The node to insert on pick. A trailing space is appended for you. */
	toNode: (item: T) => { type: string; attrs: Record<string, unknown> };
};

function SuggestionMenu<T extends { id: string }>({
	items,
	selectedIndex,
	onSelect,
	label,
	emptyLabel,
}: {
	items: T[];
	selectedIndex: number;
	onSelect: (item: T) => void;
	label: (item: T) => string;
	emptyLabel: string;
}) {
	if (items.length === 0) {
		return <div className={suggestionEmpty}>{emptyLabel}</div>;
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
						{label(item)}
					</button>
				</li>
			))}
		</ul>
	);
}

/** Builds a `char`-triggered autocomplete extension for a note's editor. */
export function createSuggestionExtension<T extends { id: string }>(config: SuggestionConfig<T>) {
	const pluginKey = new PluginKey(config.name);

	return Extension.create({
		name: config.name,

		addProseMirrorPlugins() {
			let root: Root | null = null;
			let dropdown: HTMLDivElement | null = null;
			let selectedIndex = 0;
			let currentItems: T[] = [];
			let selectItem: (item: T) => void = () => {};

			function destroyDropdown() {
				root?.unmount();
				root = null;
				dropdown?.remove();
				dropdown = null;
			}

			function renderMenu() {
				if (!root) return;
				root.render(
					<SuggestionMenu
						items={currentItems}
						selectedIndex={selectedIndex}
						onSelect={selectItem}
						label={config.label}
						emptyLabel={config.emptyLabel}
					/>,
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
					pluginKey,
					char: config.char,
					allowSpaces: true,
					startOfLine: false,
					items: ({ query }: { query: string }) =>
						config.items.filter((c) => config.matches(c, query)).slice(0, MAX_RESULTS),
					command: ({ editor, range, props }) => {
						const item = props as T;
						editor
							.chain()
							.focus()
							.insertContentAt(range, [config.toNode(item), { type: "text", text: " " }])
							.run();
					},
					render: () => {
						return {
							onStart: (props: SuggestionProps<T>) => {
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
							onUpdate: (props: SuggestionProps<T>) => {
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
