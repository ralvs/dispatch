import { mergeAttributes, Node } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { MENTION_CHIP_CLASS } from "@/components/mention-chip";
import { MENTION_TOKEN_RE, serializeMention } from "@/lib/mentions";

// Cloned from wikilink-extension.ts (the template) — same markdown-it inline
// rule + ProseMirror atom node shape, swapped to the `@[uuid|Name]` mention
// token (docs/adr/0030 Decision 2) instead of `[[uuid|label]]`.

// Matches the same shape as MENTION_TOKEN_RE, anchored at the start of the
// string (used to test a slice of markdown-it's source starting at the
// cursor).
const MENTION_AT_START_RE = new RegExp(`^${MENTION_TOKEN_RE.source}`);

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

/** `@[uuid|Name]` inline node, inserted only via the `@` autocomplete. */
export const Mention = Node.create({
	name: "mention",
	inline: true,
	group: "inline",
	atom: true,
	selectable: true,

	addAttributes() {
		return {
			id: { default: null },
			name: { default: "" },
		};
	},

	parseHTML() {
		return [
			{
				tag: "a[data-mention]",
				getAttrs: (el) => {
					if (!(el instanceof HTMLElement)) return false;
					return {
						id: el.getAttribute("data-id"),
						name: el.textContent?.replace(/^@/, "") ?? "",
					};
				},
			},
		];
	},

	renderHTML({ node }) {
		return [
			"a",
			mergeAttributes({
				"data-mention": "",
				"data-id": node.attrs.id,
				href: `/people/${node.attrs.id}`,
				class: MENTION_CHIP_CLASS,
			}),
			`@${node.attrs.name}`,
		];
	},

	renderText({ node }) {
		return serializeMention(String(node.attrs.id), String(node.attrs.name));
	},

	addStorage() {
		return {
			markdown: {
				serialize(state: MarkdownState, node: PMNode) {
					const id = node.attrs.id as string;
					const name = String(node.attrs.name ?? "");
					state.write(serializeMention(id, name));
				},
				parse: {
					setup(md: MarkdownIt) {
						md.inline.ruler.before(
							"link",
							"mention",
							(state: MarkdownItInlineState, silent: boolean) => {
								const match = MENTION_AT_START_RE.exec(state.src.slice(state.pos, state.posMax));
								if (!match) return false;

								const [full, id, rawName] = match;
								if (!id || rawName === undefined) return false;

								// Silent mode is a lookahead check — it must still report the
								// match and advance state.pos, but must not push tokens,
								// mirroring the wikilink rule and markdown-it's own autolink rule.
								if (!silent) {
									const token = state.push("mention", "a", 0);
									token.attrSet("id", id);
									token.content = rawName;
								}

								state.pos += full.length;
								return true;
							},
						);

						md.renderer.rules.mention = (tokens, idx) => {
							const token = tokens[idx];
							if (!token) return "";
							const id = token.attrGet("id") ?? "";
							return `<a data-mention data-id="${md.utils.escapeHtml(id)}" class="${MENTION_CHIP_CLASS}">@${md.utils.escapeHtml(token.content)}</a>`;
						};
					},
				},
			},
		};
	},
});
