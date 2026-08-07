/**
 * Route-level skeleton. It draws the dateline and the tape's track and nothing
 * else — those two are the page's fixed furniture, so the frame that arrives
 * is the frame that stays. Everything below is a list whose length nobody can
 * predict, and eight grey bars pretending otherwise is a worse guess than
 * empty space.
 */
export default function Loading() {
	return (
		<div>
			<span role="status" className="sr-only">
				Loading
			</span>
			<div aria-hidden="true">
				<div className="h-7 w-56 rounded-pill bg-surface-2" />
				<div className="mt-4 h-14 w-2/3 rounded bg-surface-2 lg:h-[58px]" />
				<div className="mt-10 h-[46px] rounded-[12px] bg-surface-2" />
			</div>
		</div>
	);
}
