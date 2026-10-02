import type { ReactNode } from "react";
import { PageHeader } from "./page-header";

/*
 * What a route shows while its data is in flight.
 *
 * The rule: a skeleton is the page's own silhouette, drawn in bones. Each
 * route composes its fallback from these parts so the frame that arrives is
 * the frame that stays — the same header, the same stat band, the same
 * section heads, rows of the same height with their checkbox, dot or pill
 * where the real row has one. Generic grey bars under every header told the
 * eye one shape and then swapped in another.
 *
 * Text bones are one line box tall (`1lh`) at the size of the text they stand
 * in for, with the bar itself at the cap height in the middle. So a bone row
 * takes exactly the vertical room the real row will, and nothing jumps when
 * the data lands.
 *
 * Bones are `surface-2`, not `surface`. `surface` is white on a #fafafa
 * ground, which is why the old rows read as nothing at all.
 */

/** A plain block: a checkbox, a dot, a pill, a figure. Size it with classes. */
export function Bone({ className = "" }: { className?: string }) {
	return (
		<span aria-hidden="true" className={`block shrink-0 animate-pulse bg-surface-2 ${className}`} />
	);
}

/**
 * One line of text that has not arrived. Give it the type class of the text it
 * stands in for (`text-base`, `font-mono text-meta`, `type-section`…) and a
 * width; it takes that text's line height.
 */
export function TextBone({ className = "", width }: { className?: string; width: string }) {
	return (
		<span aria-hidden="true" className={`flex h-[1lh] min-w-0 items-center ${className}`}>
			<span
				className={`block h-[0.62em] max-w-full animate-pulse rounded-sm bg-surface-2 ${width}`}
			/>
		</span>
	);
}

/**
 * The announcement every skeleton carries once. The e2e skeleton smoke waits
 * for every `role="status"` reading "Loading…" to leave the page.
 */
export function SkeletonStatus() {
	return (
		<span role="status" className="sr-only">
			Loading
		</span>
	);
}

/** A mono outline pill — EDIT, DELETE, MARK READ — at its real height. */
export function PillBone({ width = "w-16" }: { width?: string }) {
	return <Bone className={`h-7 rounded-pill ${width}`} />;
}

/**
 * A collapsed "+ New …" trigger (journal, person facts): the outlined
 * full-width box with its mono label, not a filled slab.
 */
export function TriggerBone({ labelWidth = "w-24" }: { labelWidth?: string }) {
	return (
		<span
			aria-hidden="true"
			className="flex h-9 w-full items-center rounded-control border border-line px-4"
		>
			<TextBone className="font-mono text-eyebrow" width={labelWidth} />
		</span>
	);
}

/** A row's checkbox, at the size and radius of the real one. */
export function CheckboxBone() {
	return <Bone className="size-[19px] rounded-mark" />;
}

/** A domain dot's slot: 9px, round, where the real row puts its colour. */
export function DotBone() {
	return <Bone className="size-[9px] rounded-full" />;
}

/** The header's measure (`12 active  3 paused`), as bones on the title line. */
export function MeasureBone({ widths = ["w-16"] }: { widths?: string[] }) {
	return widths.map((w, i) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: fixed, caller-ordered list.
		<TextBone key={i} className="text-sm" width={w} />
	));
}

/**
 * StatBand's geometry with the figures and labels as bones. Same gaps, same
 * 30/44px figure line, same eyebrow beneath — so the band does not grow in.
 */
export function StatBandBone({ count = 3 }: { count?: number }) {
	return (
		<div aria-hidden="true" className="mb-8 flex flex-wrap items-end gap-x-10 gap-y-5">
			{Array.from({ length: count }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, never reordered.
				<div key={i} className="min-w-0">
					<TextBone className="text-t30 lg:text-t44" width={i === 0 ? "w-12" : "w-16"} />
					<TextBone className="mt-1 font-mono text-eyebrow" width="w-24" />
				</div>
			))}
		</div>
	);
}

/**
 * ListSection's frame: the quiet section head, then its rows. The rows are
 * passed in, because a row is the surface's own shape.
 */
export function SectionBone({
	titleWidth = "w-24",
	children,
}: {
	titleWidth?: string;
	children: ReactNode;
}) {
	return (
		<section aria-hidden="true" className="mt-9 first:mt-0">
			<div className="mb-1.5 flex items-baseline gap-2">
				<TextBone className="type-section" width={titleWidth} />
			</div>
			<ul>{children}</ul>
		</section>
	);
}

/**
 * Bone widths for repeated rows. Real titles are ragged; a column of equal
 * bars reads as a table, not as a list of things.
 */
const RAGGED = ["w-56", "w-40", "w-64", "w-48", "w-36", "w-52", "w-44", "w-60"];
const RAGGED_META = ["w-32", "w-20", "w-28", "w-24", "w-36", "w-20", "w-28", "w-16"];

/** The `i`th ragged title width, wrapping, so any index is safe. */
export function ragged(i: number): string {
	return RAGGED[i % RAGGED.length];
}

/** `n` copies of a row, each handed its index so it can pick a ragged width. */
export function repeat(n: number, row: (i: number) => ReactNode) {
	return Array.from({ length: n }, (_, i) => row(i));
}

/** A two-line title + meta body, the most common row body in the app. */
export function TitleMetaBone({ i, meta = true }: { i: number; meta?: boolean }) {
	return (
		<>
			<TextBone className="text-base leading-[1.35]" width={ragged(i)} />
			{meta && (
				<TextBone
					className="mt-0.5 font-mono text-meta"
					width={RAGGED_META[i % RAGGED_META.length]}
				/>
			)}
		</>
	);
}

/**
 * The route frame: the real header, then the route's own body bones.
 *
 * `title` is optional for a detail route, whose name *is* data; the bone then
 * sits inside the real h1 so the header keeps its height.
 *
 * `action` is a standing control, not data, so it renders for real — disabled
 * — and holds its slot (DESIGN.md, "The Invisible Slot Rule"). `measure`
 * passes MeasureBone widths when the real header carries a count.
 */
export function PageSkeleton({
	title,
	subtitle,
	action,
	measure,
	children,
}: {
	title?: string;
	subtitle?: ReactNode;
	action?: ReactNode;
	measure?: string[];
	children?: ReactNode;
}) {
	return (
		<div>
			<SkeletonStatus />
			<PageHeader
				title={title ?? <TextBone className="inline-flex align-top" width="w-[min(60vw,18rem)]" />}
				subtitle={subtitle}
				action={
					measure || action ? (
						<>
							{measure && (
								<span className="flex items-center gap-4">
									<MeasureBone widths={measure} />
								</span>
							)}
							{action}
						</>
					) : undefined
				}
			/>
			{children}
		</div>
	);
}
