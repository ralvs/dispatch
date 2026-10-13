// The domain kind's writes (docs/adr/0077): each builder makes the intent and
// its server call from the same arguments. Beside this route's actions.ts
// (docs/adr/0070). Client-safe — server-action references only.

import { nowUtc } from "@/lib/dates";
import type { DomainItem } from "@/lib/schemas/domain";
import { type Write, write } from "@/lib/store/write";
import {
	archiveDomainAction,
	createDomainAction,
	markDomainShippedAction,
	reactivateDomainAction,
	updateDomainAction,
} from "./actions";

const UPDATE_ERROR = "Couldn't update domain.";
const SAVE_ERROR = "Couldn't save domain.";

/**
 * The domain the list shows while the server writes it. It has no touch yet;
 * the server's item, with its touch, replaces it (#30).
 */
function optimisticDomain(formData: FormData): DomainItem {
	const text = (key: string) => {
		const value = String(formData.get(key) ?? "").trim();
		return value === "" ? null : value;
	};
	const at = nowUtc();
	return {
		id: crypto.randomUUID(),
		name: text("name") ?? "",
		description: text("description"),
		fruit_definition: text("fruit_definition"),
		failure_patterns: [],
		expected_cadence: text("expected_cadence"),
		active: true,
		last_shipped_at: null,
		color: text("color"),
		created_at: at,
		updated_at: at,
		cadenceDays: null,
		touch: null,
	};
}

/** What an edit asks for, so the row shows it while the server writes it. */
function domainPatch(formData: FormData): Partial<DomainItem> {
	const text = (key: string) => {
		const value = String(formData.get(key) ?? "").trim();
		return value === "" ? null : value;
	};
	const name = text("name");
	const raw = String(formData.get("cadence_days") ?? "").trim();
	const days = Number(raw);
	// Only what the server will keep: blank clears the rule, 1–365 sets it.
	const cadence = !formData.has("cadence_days")
		? {}
		: raw === ""
			? { cadenceDays: null }
			: Number.isInteger(days) && days > 0 && days <= 365
				? { cadenceDays: days }
				: {};
	return {
		...(name ? { name } : {}),
		description: text("description"),
		fruit_definition: text("fruit_definition"),
		expected_cadence: text("expected_cadence"),
		...(formData.has("color") ? { color: text("color") } : {}),
		...cadence,
	};
}

export const domainWrites = {
	create: (form: FormData): Write<"domain"> =>
		write("domain", { type: "create", row: optimisticDomain(form) }, () =>
			createDomainAction(form),
		),
	update: (id: string, form: FormData): Write<"domain"> =>
		write(
			"domain",
			{ type: "patch", id, patch: domainPatch(form) },
			() => updateDomainAction(id, form),
			SAVE_ERROR,
		),
	markShipped: (id: string): Write<"domain"> =>
		write(
			"domain",
			{ type: "patch", id, patch: { last_shipped_at: nowUtc() } },
			() => markDomainShippedAction(id),
			UPDATE_ERROR,
		),
	archive: (id: string): Write<"domain"> =>
		write(
			"domain",
			{ type: "patch", id, patch: { active: false, touch: null } },
			() => archiveDomainAction(id),
			UPDATE_ERROR,
		),
	reactivate: (id: string): Write<"domain"> =>
		write(
			"domain",
			{ type: "patch", id, patch: { active: true } },
			() => reactivateDomainAction(id),
			UPDATE_ERROR,
		),
};
