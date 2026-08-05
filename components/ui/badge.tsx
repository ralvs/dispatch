import { tv, type VariantProps } from "./tv";

/**
 * One rounded-control badge. Tone variants collapse PriorityBadge, MentionChip,
 * project/person row badges, and Today alert chips.
 */
export const badge = tv({
	base: [
		"inline-flex shrink-0 items-center gap-1",
		"rounded-control border px-1.5 py-px",
		"font-mono text-[10px] leading-none tracking-wide",
	],
	variants: {
		tone: {
			neutral: "border-line text-ink-3",
			accent: "border-accent/40 text-accent-ink",
			error: "border-error/40 text-error",
			warning: "border-warning/40 text-warning",
			success: "border-success/40 text-success",
			muted: "border-line text-ink-4",
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
	"relative gap-1 px-1 text-ink-3",
	"before:absolute before:-inset-x-2 before:-inset-y-4 before:content-['']",
	"hover:border-line-strong hover:text-ink active:opacity-70",
].join(" ");

/**
 * Shared shell for icon-only note affordances on schedule/task rows.
 * hit-area via --hit-* so two chips a gap-2 apart don't overlap targets.
 */
export const NOTE_CHIP_CLASS = [
	"hit-area relative inline-flex shrink-0 items-center justify-center",
	"rounded-control border border-line p-1 leading-none text-ink-3",
	"hover:border-line-strong hover:text-ink active:opacity-70",
	"[--hit-x:4px] [--hit-y:14px]",
].join(" ");
