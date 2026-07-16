"use client";

import { useRef, useState, useTransition } from "react";
import { LabResultFlagSchema } from "@/lib/schemas/health";
import type { LabPanelWithResults } from "@/lib/services/health";
import { addLabResultAction, deleteLabPanelAction } from "./actions";

const FLAGS = LabResultFlagSchema.options;

function flagClass(flag: string | null): string {
	if (flag === "critical_low" || flag === "critical_high") return "text-accent-slip font-semibold";
	if (flag === "low" || flag === "high" || flag === "abnormal") return "text-accent-ink";
	return "text-ink-4";
}

export function LabPanelRowItem({
	panel,
	tz,
	formatDay,
}: {
	panel: LabPanelWithResults;
	tz: string;
	formatDay: (date: string, tz: string) => string;
}) {
	const [pending, startTransition] = useTransition();
	const [addingResult, setAddingResult] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);

	function submitResult(formData: FormData) {
		startTransition(async () => {
			await addLabResultAction(panel.id, formData);
			formRef.current?.reset();
			setAddingResult(false);
		});
	}

	return (
		<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`}>
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="font-serif text-base text-ink">{panel.panel_name}</p>
					<p className="mt-0.5 font-mono text-meta text-ink-4">
						{formatDay(panel.drawn_date, tz)}
						{panel.ordering_provider ? ` · ${panel.ordering_provider}` : ""}
						{panel.lab_facility ? ` · ${panel.lab_facility}` : ""}
					</p>
				</div>
				<div className="flex shrink-0 gap-2">
					<button
						type="button"
						aria-expanded={addingResult}
						onClick={() => setAddingResult((a) => !a)}
						className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
					>
						{addingResult ? "Cancel" : "Add result"}
					</button>
					<button
						type="button"
						aria-label={`Delete panel ${panel.panel_name}`}
						disabled={pending}
						onClick={() => startTransition(() => deleteLabPanelAction(panel.id))}
						className="border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
					>
						Delete
					</button>
				</div>
			</div>

			{panel.results.length > 0 && (
				<ul className="mt-2 space-y-1" aria-label={`Results for ${panel.panel_name}`}>
					{panel.results.map((r) => (
						<li key={r.id} className="flex items-baseline gap-2 font-mono text-sm">
							<span className="text-ink">{r.analyte}</span>
							<span className={flagClass(r.flag)}>
								{r.value ?? r.value_text ?? "—"}
								{r.unit ? ` ${r.unit}` : ""}
								{r.flag ? ` (${r.flag})` : ""}
							</span>
						</li>
					))}
				</ul>
			)}

			{addingResult && (
				<form
					ref={formRef}
					action={submitResult}
					className="mt-3 space-y-2 border border-line-strong bg-surface p-3"
				>
					<div className="grid grid-cols-2 gap-3">
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Analyte</span>
							<input
								name="analyte"
								required
								aria-label="Analyte"
								className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
							/>
						</label>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Value</span>
							<input
								type="number"
								step="any"
								name="value"
								aria-label="Value"
								className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
							/>
						</label>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Unit</span>
							<input
								name="unit"
								placeholder="mg/dL"
								className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
							/>
						</label>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Flag</span>
							<select
								name="flag"
								defaultValue=""
								className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
							>
								<option value="">Normal</option>
								{FLAGS.map((f) => (
									<option key={f} value={f}>
										{f}
									</option>
								))}
							</select>
						</label>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Ref. low</span>
							<input
								type="number"
								step="any"
								name="reference_range_low"
								aria-label="Reference range low"
								className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
							/>
						</label>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Ref. high</span>
							<input
								type="number"
								step="any"
								name="reference_range_high"
								aria-label="Reference range high"
								className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
							/>
						</label>
					</div>
					<button
						type="submit"
						disabled={pending}
						className="bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
					>
						{pending ? "Saving…" : "Add result"}
					</button>
				</form>
			)}
		</li>
	);
}
