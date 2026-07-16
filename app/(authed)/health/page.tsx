import { requireOwnerPage } from "@/lib/auth";
import { formatDay, formatInstant } from "@/lib/dates";
import { listMedications, listMetrics, listVisits } from "@/lib/services/health";
import { getAppTimezone } from "@/lib/services/settings";
import {
	deleteMedicationAction,
	deleteMetricAction,
	deleteVisitAction,
	setMedicationActiveAction,
} from "./actions";
import { MedicationForm } from "./medication-form";
import { MetricForm } from "./metric-form";
import { VisitForm } from "./visit-form";

export default async function HealthPage() {
	const { sb } = await requireOwnerPage();
	const tz = await getAppTimezone(sb);
	const [metrics, medications, visits] = await Promise.all([
		listMetrics(sb, { limit: 50 }),
		listMedications(sb, { includeInactive: true }),
		listVisits(sb),
	]);

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Health</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Body of record</h1>
			</header>

			<section className="mt-6">
				<h2 className="font-serif text-xl text-ink">Metrics</h2>
				<div className="mt-3">
					<MetricForm />
				</div>
				{metrics.length === 0 ? (
					<p className="py-6 text-center font-serif italic text-ink-3">No readings logged yet.</p>
				) : (
					<ul className="mt-2" aria-label="Health metrics">
						{metrics.map((m) => (
							<li key={m.id} className="hairline flex items-center justify-between py-3">
								<div>
									<p className="font-serif text-base text-ink">
										{m.metric}: {m.value ?? "—"}
										{m.value_secondary != null ? `/${m.value_secondary}` : ""}
										{m.unit ? ` ${m.unit}` : ""}
									</p>
									<p className="mt-0.5 font-mono text-meta text-ink-4">
										{formatInstant(m.measured_at, tz)}
									</p>
								</div>
								<form action={deleteMetricAction.bind(null, m.id)}>
									<button
										type="submit"
										aria-label={`Delete ${m.metric} reading`}
										className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
									>
										Delete
									</button>
								</form>
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="mt-8">
				<h2 className="font-serif text-xl text-ink">Medications</h2>
				<div className="mt-3">
					<MedicationForm />
				</div>
				{medications.length === 0 ? (
					<p className="py-6 text-center font-serif italic text-ink-3">No medications on file.</p>
				) : (
					<ul className="mt-2" aria-label="Medications">
						{medications.map((med) => (
							<li key={med.id} className="hairline flex items-center justify-between py-3">
								<div>
									<p className="font-serif text-base text-ink">
										{med.name}
										{med.dosage ? ` · ${med.dosage}` : ""}
									</p>
									<p className="mt-0.5 font-mono text-meta text-ink-4">
										{med.kind}
										{med.frequency ? ` · ${med.frequency}` : ""}
										{med.active ? "" : " · inactive"}
									</p>
								</div>
								<div className="flex gap-2">
									<form action={setMedicationActiveAction.bind(null, med.id, !med.active)}>
										<button
											type="submit"
											aria-pressed={med.active}
											aria-label={
												med.active ? `Mark ${med.name} inactive` : `Mark ${med.name} active`
											}
											className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
										>
											{med.active ? "Active" : "Inactive"}
										</button>
									</form>
									<form action={deleteMedicationAction.bind(null, med.id)}>
										<button
											type="submit"
											aria-label={`Delete ${med.name}`}
											className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
										>
											Delete
										</button>
									</form>
								</div>
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="mt-8">
				<h2 className="font-serif text-xl text-ink">Visits</h2>
				<div className="mt-3">
					<VisitForm />
				</div>
				{visits.length === 0 ? (
					<p className="py-6 text-center font-serif italic text-ink-3">No visits recorded yet.</p>
				) : (
					<ul className="mt-2" aria-label="Health visits">
						{visits.map((v) => (
							<li key={v.id} className="hairline flex items-center justify-between py-3">
								<div>
									<p className="font-serif text-base text-ink">
										{formatDay(v.visit_date, tz, "d LLLL yyyy")}
										{v.provider_name ? ` · ${v.provider_name}` : ""}
									</p>
									<p className="mt-0.5 font-mono text-meta text-ink-4">
										{v.visit_type ?? "—"}
										{v.reason ? ` · ${v.reason}` : ""}
									</p>
								</div>
								<form action={deleteVisitAction.bind(null, v.id)}>
									<button
										type="submit"
										aria-label={`Delete visit on ${v.visit_date}`}
										className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
									>
										Delete
									</button>
								</form>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
