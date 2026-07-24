import { mergeAttributes, Node } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { sanitizeLabel, WIKILINK_RE } from "@/lib/wikilinks";

// Matches the same shape as WIKILINK_RE, anchored at the start of the string
// (used to test a slice of markdown-it's source starting at the cursor).
const WIKILINK_AT_START_RE = new RegExp(`^${WIKILINK_RE.source}`);

type MarkdownState = {
	write(text: string): void;
};

// Loosely typed: tiptap-markdown ships loose types for its parse.setup hook,
// and markdown-it isn't a direct dependency here — see ParagraphKeepBlank in
// note-editor.tsx for the same pattern.
type MarkdownItToken = {
	type: string;
	tag: string;
	attrSet(name: string, value: string): void;
	attrGet(name: string): string | null;
	content: string;
};

type MarkdownItInlineState = {
	src: string;
	pos: number;
	posMax: number;
	push(type: string, tag: string, nesting: number): MarkdownItToken;
};

type MarkdownItRenderer = {
	rules: Record<string, (tokens: MarkdownItToken[], idx: number) => string>;
};

type MarkdownIt = {
	inline: {
		ruler: {
			before(
				beforeName: string,
				name: string,
				rule: (state: MarkdownItInlineState, silent: boolean) => boolean,
			): void;
		};
	};
	renderer: MarkdownItRenderer;
	utils: { escapeHtml(str: string): string };
};

/** `[[uuid|label]]` inline node, inserted only via the `[[` autocomplete. */
export const Wikilink = Node.create({
	name: "wikilink",
	inline: true,
	group: "inline",
	atom: true,
	selectable: true,

	addAttributes() {
		return {
			id: { default: null },
			label: { default: "" },
		};
	},

	parseHTML() {
		return [
			{
				tag: "a[data-wikilink]",
				getAttrs: (el) => {
					if (!(el instanceof HTMLElement)) return false;
					return {
						id: el.getAttribute("data-id"),
						label: el.textContent ?? "",
					};
				},
			},
		];
	},

	renderHTML({ node }) {
		return [
			"a",
			mergeAttributes({
				"data-wikilink": "",
				"data-id": node.attrs.id,
				href: `/notes/${node.attrs.id}`,
			}),
			node.attrs.label,
		];
	},

	renderText({ node }) {
		return `[[${node.attrs.id}|${node.attrs.label}]]`;
	},

	addStorage() {
		return {
			markdown: {
				serialize(state: MarkdownState, node: PMNode) {
					const id = node.attrs.id as string;
					const label = sanitizeLabel(String(node.attrs.label ?? ""));
					state.write(`[[${id}|${label}]]`);
				},
				parse: {
					setup(md: MarkdownIt) {
						md.inline.ruler.before(
							"link",
							"wikilink",
							(state: MarkdownItInlineState, silent: boolean) => {
								const match = WIKILINK_AT_START_RE.exec(state.src.slice(state.pos, state.posMax));
								if (!match) return false;

								const [full, id, rawLabel] = match;
								if (!id || rawLabel === undefined) return false;

								if (!silent) {
									const token = state.push("wikilink", "a", 0);
									token.attrSet("id", id);
									token.content = sanitizeLabel(rawLabel);
								}

								state.pos += full.length;
								return true;
							},
						);

						md.renderer.rules.wikilink = (tokens, idx) => {
							const token = tokens[idx];
							if (!token) return "";
							const id = token.attrGet("id") ?? "";
							return `<a data-wikilink data-id="${md.utils.escapeHtml(id)}">${md.utils.escapeHtml(token.content)}</a>`;
						};
					},
				},
			},
		};
	},
});
