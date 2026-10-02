import { Suspense } from "react";
import {
	Bone,
	MoreBackLink,
	PageHeader,
	PillBone,
	SectionHead,
	SkeletonStatus,
	TextBone,
} from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedAppTimezone, getCachedReminderSettings } from "@/lib/cache/settings";
import { PushToggle } from "./push-toggle";
import { ReminderForm } from "./reminder-form";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";
import { TimezoneForm } from "./timezone-form";

async function AppSettings() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [tz, reminderSettings] = await Promise.all([
		getCachedAppTimezone(),
		getCachedReminderSettings(),
	]);

	return (
		<>
			<TimezoneForm current={tz} />
			<ReminderForm
				offsetMinutes={reminderSettings.offsetMinutes}
				anchorTime={reminderSettings.anchorTime}
			/>
		</>
	);
}

/* Two SettingsForm blocks: a labelled field with Save, and the note under it. */
// SettingsForm's frame: label over control for each field, the SAVE pill on
// the same line, the explanatory note beneath. Timezone has one field; the
// reminder form has two and a two-line note.
function SettingsFormBone({ fields, note }: { fields: string[]; note: string[] }) {
	return (
		<div className="mt-2 flex flex-wrap items-end gap-3" aria-hidden="true">
			{fields.map((w) => (
				<div key={w} className={`min-w-0 ${w}`}>
					<TextBone className="text-meta" width="w-16" />
					<Bone className="mt-1.5 h-8 w-full rounded-sm" />
				</div>
			))}
			<PillBone width="w-14" />
			<div className="w-full">
				{note.map((w) => (
					<TextBone key={w} className="font-mono text-meta" width={w} />
				))}
			</div>
		</div>
	);
}

function AppSettingsFallback() {
	return (
		<>
			<SkeletonStatus />
			<SettingsFormBone fields={["w-full sm:w-56"]} note={["w-96 max-w-full"]} />
			<SettingsFormBone fields={["w-28", "w-24"]} note={["w-full", "w-72"]} />
		</>
	);
}

async function AccountEmail() {
	const { claims } = await requireOwnerPage();
	return (
		<p className="truncate text-meta text-ink-4" title={claims.email ?? ""}>
			{claims.email}
		</p>
	);
}

/**
 * Configuration only — knobs that tend to grow, plus account chrome that left
 * the More menu (Pass 4 / C4). Domains are a Library page now.
 *
 * The page itself is static: the toggles and sign-out read nothing on the
 * server, so they come out of the prerendered shell. Only the two stored
 * settings and the signed-in email stream in.
 */
export default function SettingsPage() {
	return (
		<div>
			<MoreBackLink />
			<PageHeader title="Settings" />

			<section aria-label="Notifications">
				<SectionHead title="Notifications" />
				<div className="hairline pb-4 pt-1">
					<PushToggle />
				</div>
			</section>

			<section className="mt-9" aria-label="App">
				<SectionHead title="App" />
				<Suspense fallback={<AppSettingsFallback />}>
					<AppSettings />
				</Suspense>
			</section>

			<section className="mt-9" aria-label="Account">
				<SectionHead title="Account" />
				<div className="space-y-3 pt-1">
					<ThemeToggle />
					<Suspense fallback={<TextBone className="text-meta" width="w-40" />}>
						<AccountEmail />
					</Suspense>
					<SignOutButton />
				</div>
			</section>
		</div>
	);
}
