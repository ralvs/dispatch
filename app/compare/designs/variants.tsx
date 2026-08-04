"use client";

import { Bell, Calendar, Check, FileText, MessageSquare, Star, X } from "lucide-react";
import {
	Badge,
	Button,
	Card,
	Checkbox,
	Field,
	Icon,
	Input,
	NOTE_CHIP_CLASS,
	Select,
	Textarea,
} from "@/components/ui";
import type { CompareDay } from "../mock";

export type UiVariant = "line" | "box" | "depth";

/**
 * Shared bake-off tree. Visual differences come only from the data-ui token
 * swap on the wrapper — same components, same markup, three field/elevation
 * treatments. Form is framed as a dialog (where person edit is heading).
 */
export function VariantSurface({ variant, day }: { variant: UiVariant; day: CompareDay }) {
	return (
		<div data-ui={variant} className="min-h-[720px] bg-bg text-ink">
			<div className="mx-auto max-w-3xl space-y-16 px-5 py-10">
				<header className="hairline-strong pb-4">
					<div className="flex items-center justify-between">
						<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
							{day.dateline}
						</p>
						<div className="flex items-center gap-4 font-mono text-meta text-ink-3">
							<span className="flex items-center gap-1.5">
								<Icon icon={Bell} size="sm" />
								{day.unreadNotifications}
							</span>
							<span className="flex items-center gap-1.5 text-accent-ink">
								<Icon icon={MessageSquare} size="sm" />
								Ask
							</span>
						</div>
					</div>
					<p className="display-tight gradient-text-mesh mt-1 w-fit font-serif text-4xl">
						Dispatch
					</p>
					<p className="mt-2 font-mono text-meta text-ink-4">
						UI variant · <span className="text-ink-2">{variant}</span>
					</p>
				</header>

				<section>
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Buttons</h2>
					<div className="mt-6 space-y-5">
						{(["sm", "md", "lg"] as const).map((size) => (
							<div key={size} className="flex flex-wrap items-center gap-3">
								<span className="w-8 font-mono text-meta text-ink-4">{size}</span>
								<Button size={size} variant="primary">
									Primary
								</Button>
								<Button size={size} variant="secondary">
									Secondary
								</Button>
								<Button size={size} variant="tertiary">
									Tertiary
								</Button>
								<Button size={size} variant="ghost">
									Ghost
								</Button>
								<Button size={size} variant="danger">
									Danger
								</Button>
								<Button size={size} variant="danger-soft">
									Soft
								</Button>
								<Button size={size} variant="secondary" isIconOnly aria-label="Close">
									<Icon icon={X} size={size === "lg" ? "md" : "sm"} />
								</Button>
								<Button size={size} variant="primary" disabled>
									Disabled
								</Button>
							</div>
						))}
					</div>
				</section>

				<section>
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
						Person dialog
					</h2>
					<p className="mt-2 max-w-prose text-meta text-ink-4">
						Same field shell throughout — no title-vs-meta chrome split. Spaced for a dialog, not a
						dense detail page.
					</p>

					{/* Dialog shell: elevated-panel so depth lifts the whole sheet, not just cards. */}
					<div className="elevated-panel mt-8 rounded-card border border-line-strong p-6 sm:p-8">
						<div className="mb-8 flex items-start justify-between gap-4">
							<div>
								<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
									Edit person
								</p>
								<p className="mt-1 font-serif text-xl text-ink">Marina Costa</p>
							</div>
							<Button variant="ghost" size="sm" isIconOnly aria-label="Close dialog">
								<Icon icon={X} size="sm" />
							</Button>
						</div>

						<div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
							<Field label="Name" className="sm:col-span-2">
								<Input defaultValue="Marina Costa" size="lg" />
							</Field>
							<Field label="Role">
								<Input defaultValue="Head of Product" />
							</Field>
							<Field label="Company">
								<Input defaultValue="Casa Verde" />
							</Field>
							<Field label="Email">
								<Input type="email" defaultValue="marina@casaverde.dev" />
							</Field>
							<Field label="Phone">
								<Input type="tel" placeholder="+55 11 …" />
							</Field>
							<Field label="Birthday">
								<Input type="date" defaultValue="1988-04-12" />
							</Field>
							<Field label="Met">
								<Input type="date" />
							</Field>
							<Field label="Relationship">
								<Select defaultValue="colleague">
									<option value="colleague">Colleague</option>
									<option value="friend">Friend</option>
									<option value="family">Family</option>
								</Select>
							</Field>
							<Field label="Timezone">
								<Select defaultValue="sp">
									<option value="sp">America/Sao_Paulo</option>
									<option value="ny">America/New_York</option>
								</Select>
							</Field>
							<Field label="Notes" className="sm:col-span-2">
								<Textarea defaultValue="Q3 roadmap owner. Prefers async over meetings." rows={4} />
							</Field>
							<Field label="Tags" className="sm:col-span-2">
								<Input placeholder="work, product…" />
							</Field>
							<div className="sm:col-span-2 pt-1">
								<Checkbox defaultChecked>Follow up this week</Checkbox>
							</div>
							<div className="flex flex-wrap items-center gap-3 border-t border-line pt-6 sm:col-span-2">
								<Button type="submit" variant="primary">
									Save
								</Button>
								<Button type="button" variant="ghost">
									Cancel
								</Button>
								<span className="flex-1" />
								<Button type="button" variant="danger-soft">
									Delete
								</Button>
							</div>
						</div>
					</div>
				</section>

				<section>
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
						Today slice
					</h2>
					<div className="mt-6 flex flex-wrap gap-2.5">
						{day.alerts.map((a) => (
							<a key={a.key} href={a.href} className="no-underline">
								<Badge tone={a.key === "review" ? "warning" : "accent"}>
									{a.count} {a.label}
								</Badge>
							</a>
						))}
						<Badge tone="error">P1</Badge>
						<Badge tone="warning">P2</Badge>
						<Badge tone="accent">P3</Badge>
						<Badge tone="muted">P4</Badge>
					</div>

					<ul className="mt-8">
						{day.schedule.timeline.slice(0, 4).map((item) => (
							<li key={item.key} className="hairline flex items-center gap-3 py-3.5">
								{item.time && (
									<span className="w-12 shrink-0 font-mono text-meta tabular-nums text-ink-3">
										{item.time}
									</span>
								)}
								{item.kind === "event" ? (
									<Icon icon={Calendar} size="sm" className="shrink-0 text-ink-3" />
								) : (
									<span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-mark border border-line-strong">
										{item.done && <Icon icon={Check} size="sm" className="text-success" />}
									</span>
								)}
								<div className="min-w-0 flex-1">
									<p
										className={`truncate text-sm ${item.done ? "text-ink-4 line-through" : "text-ink"}`}
									>
										{item.title}
										{item.top3 && !item.done && (
											<span className="ml-1 inline-flex text-warning">
												<Icon icon={Star} size="sm" fill="currentColor" />
											</span>
										)}
									</p>
									{item.meta && (
										<p className="mt-0.5 truncate font-mono text-meta text-ink-4">{item.meta}</p>
									)}
								</div>
								{item.kind === "task" && item.top3 && <Badge tone="accent">top</Badge>}
								<span className={NOTE_CHIP_CLASS} aria-hidden>
									<Icon icon={FileText} size="sm" />
								</span>
							</li>
						))}
					</ul>
				</section>

				<section>
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Cards</h2>
					<div className="mt-6 grid gap-5 sm:grid-cols-2">
						<Card padding="comfortable">
							<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Default</p>
							<p className="mt-3 font-serif text-lg text-ink">Room to breathe.</p>
							<p className="mt-2 text-sm text-ink-3">rounded-card · elevation-card · elevated-bg</p>
						</Card>
						<Card padding="compact">
							<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Compact</p>
							<p className="mt-3 font-serif text-lg text-ink">Same tokens, less air.</p>
							<p className="mt-2 text-sm text-ink-3">p-4</p>
						</Card>
					</div>
				</section>

				<section>
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
						Overlay (popover / menu)
					</h2>
					<p className="mt-2 text-meta text-ink-4">
						Uses elevation-overlay — the same token as the dock and dialogs under depth.
					</p>
					<div className="relative mt-8 h-36 rounded-card border border-line bg-surface-2/40 p-5">
						<p className="text-sm text-ink-3">Page surface behind the popover…</p>
						<div className="elevation-overlay absolute left-8 top-12 w-56 rounded-control border border-line-strong bg-[var(--elevated-bg)] py-1.5">
							<button
								type="button"
								className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
							>
								Open note
							</button>
							<button
								type="button"
								className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
							>
								Mark done
							</button>
							<button
								type="button"
								className="block w-full px-3 py-2 text-left text-sm text-error hover:bg-surface-2"
							>
								Delete
							</button>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}

export function LineDesign({ day }: { day: CompareDay }) {
	return <VariantSurface variant="line" day={day} />;
}

export function BoxDesign({ day }: { day: CompareDay }) {
	return <VariantSurface variant="box" day={day} />;
}

export function DepthDesign({ day }: { day: CompareDay }) {
	return <VariantSurface variant="depth" day={day} />;
}
