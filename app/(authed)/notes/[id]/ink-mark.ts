import { Mark, mergeAttributes } from "@tiptap/core";
import { isInkSlug } from "@/lib/ink";

type MarkdownState = {
	write(text: string): void;
	renderInline(mark: unknown): void;
};

export const Ink = Mark.create({
	name: "ink",
	excludes: "ink",

	addAttributes() {
		return {
			slug: { default: null },
		};
	},

	parseHTML() {
		return [
			{
				tag: "span[data-ink]",
				getAttrs: (el) => {
					if (!(el instanceof HTMLElement)) return false;
					const slug = el.getAttribute("data-ink");
					if (!isInkSlug(slug)) return false;
					return { slug };
				},
			},
		];
	},

	renderHTML({ HTMLAttributes }) {
		const { slug, ...rest } = HTMLAttributes as { slug?: string };
		if (!isInkSlug(slug)) return ["span", 0];
		return ["span", mergeAttributes(rest, { "data-ink": slug }), 0];
	},

	addStorage() {
		return {
			markdown: {
				serialize: {
					open(_state: MarkdownState, mark: { attrs: { slug: string } }) {
						const slug = mark.attrs.slug;
						if (!isInkSlug(slug)) return "";
						return `<span data-ink="${slug}">`;
					},
					close() {
						return "</span>";
					},
				},
				parse: {},
			},
		};
	},
});
