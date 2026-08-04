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
 * treatments.
 */
export function VariantSurface({ variant, day }: { variant: UiVariant; day: CompareDay }) {
	return (
		<div data-ui={variant} className="min-h-[720px] bg-bg text-ink">
			<div className="mx-auto max-w-3xl space-y-14 px-5 py-8">
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
					<div className="mt-4 space-y-4">
						{(["sm", "md", "lg"] as const).map((size) => (
							<div key={size} className="flex flex-wrap items-center gap-2">
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
						Dense form · person detail
					</h2>
					<p className="mt-1 text-meta text-ink-4">
						13 controls — where line fields win or lose on label→input binding.
					</p>
					<div className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
						<Field label="Name" className="sm:col-span-2">
							<Input variant="display" displaySize="xl" defaultValue="Marina Costa" />
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
							<Textarea defaultValue="Q3 roadmap owner. Prefers async over meetings." rows={3} />
						</Field>
						<Field label="Tags" className="sm:col-span-2">
							<Input placeholder="work, product…" />
						</Field>
						<div className="sm:col-span-2">
							<Checkbox defaultChecked>Follow up this week</Checkbox>
						</div>
						<div className="flex flex-wrap gap-2 sm:col-span-2">
							<Button type="submit" variant="primary">
								Save
							</Button>
							<Button type="button" variant="ghost">
								Cancel
							</Button>
							<Button type="button" variant="danger-soft">
								Delete
							</Button>
						</div>
					</div>
				</section>

				<section>
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
						Today slice
					</h2>
					<div className="mt-4 flex flex-wrap gap-2">
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

					<ul className="mt-6">
						{day.schedule.timeline.slice(0, 4).map((item) => (
							<li key={item.key} className="hairline flex items-center gap-3 py-3">
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
					<div className="mt-4 grid gap-4 sm:grid-cols-2">
						<Card>
							<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
								Default padding
							</p>
							<p className="mt-2 font-serif text-lg text-ink">Room to breathe.</p>
							<p className="mt-1 text-sm text-ink-3">rounded-card · elevation-card · p-4</p>
						</Card>
						<Card padding="compact">
							<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Compact</p>
							<p className="mt-2 font-serif text-lg text-ink">Same tokens, less air.</p>
							<p className="mt-1 text-sm text-ink-3">rounded-card · elevation-card · p-3</p>
						</Card>
					</div>
				</section>

				<section>
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
						Display field
					</h2>
					<div className="mt-4">
						<Input
							variant="display"
							displaySize="xl"
							placeholder="Note title — bare serif line in every variant"
							defaultValue=""
						/>
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
