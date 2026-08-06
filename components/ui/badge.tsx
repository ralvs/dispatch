import { tv, type VariantProps } from "./tv";

/**
 * One pill badge. Tone variants collapse PriorityBadge, MentionChip,
 * project/person row badges, and Today alert chips.
 *
 * Tinted fills rather than outlines (docs/adr/0042): on the paper ground a
 * bordered chip reads as a tiny empty box, while a soft fill reads as a label.
 */
export const badge = tv({
	base: [
		"inline-flex shrink-0 items-center gap-1",
		"rounded-pill px-2 py-0.5",
		"text-[11px] font-semibold leading-none",
	],
	variants: {
		tone: {
			neutral: "bg-surface-2 text-ink-2 border border-line",
			accent: "bg-accent-bg text-accent-ink",
			error: "bg-error/10 text-error",
			warning: "bg-warning/10 text-warning",
			success: "bg-success/10 text-success",
			muted: "bg-surface-2 text-ink-4",
		},
	},
	defaultVariants: {
		tone: "neutral",
	},
});

export type BadgeVariants = VariantProps<typeof badge>;

type BadgeProps = BadgeVariants & {
	children: React.ReactNode;
	className?: string;
	title?: string;
};

export function Badge({ tone, children, className, title }: BadgeProps) {
	return (
		<span title={title} className={badge({ tone, className })}>
			{children}
		</span>
	);
}

/**
 * Raw class string for TipTap mention HTML (mention-extension.ts).
 * Derives from the same tv() object so chip chrome stays in lockstep.
 * before: pseudo expands hit area without growing the visible pill.
 */
export const MENTION_CHIP_CLASS = [
	badge({ tone: "neutral" }),
	"relative gap-1 px-1.5",
	"before:absolute before:-inset-x-2 before:-inset-y-4 before:content-['']",
	"transition-colors hover:border-line-strong hover:bg-bg hover:text-ink active:translate-y-px",
].join(" ");

/**
 * Shared shell for icon-only note affordances on schedule/task rows.
 * hit-area via --hit-* so two chips a gap-2 apart don't overlap targets.
 */
export const NOTE_CHIP_CLASS = [
	"hit-area relative inline-flex shrink-0 items-center justify-center",
	"rounded-pill border border-line bg-surface-2 p-1.5 leading-none text-ink-3",
	"transition-colors hover:border-line-strong hover:text-ink active:translate-y-px",
	"[--hit-x:4px] [--hit-y:14px]",
].join(" ");
