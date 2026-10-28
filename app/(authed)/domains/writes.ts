// The domain kind's writes (docs/adr/0077): each builder makes the intent and
// its server call from the same arguments. Beside this route's actions.ts
// (docs/adr/0070). Client-safe — server-action references only.

import { nowUtc } from "@/lib/dates";
import {
	type CreateDomainFormInput,
	createDomainForm,
	type DomainItem,
	type UpdateDomainFormInput,
	updateDomainForm,
} from "@/lib/schemas/domain";
import { unshown } from "@/lib/store/kinds/record";
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
function optimisticDomain(input: CreateDomainFormInput): DomainItem {
	const at = nowUtc();
	return {
		id: crypto.randomUUID(),
		name: input.name,
		description: input.description ?? null,
		fruit_definition: input.fruit_definition ?? null,
		failure_patterns: [],
		expected_cadence: input.expected_cadence ?? null,
		active: true,
		last_shipped_at: null,
		color: input.color ?? null,
		created_at: at,
		updated_at: at,
		cadenceDays: null,
		touch: null,
	};
}

/** What an edit asks for, so the row shows it while the server writes it. */
function domainPatch(input: UpdateDomainFormInput): Partial<DomainItem> {
	const { cadence_days, ...patch } = input;
	return { ...patch, ...(cadence_days !== undefined ? { cadenceDays: cadence_days } : {}) };
}

export const domainWrites = {
	/** A form the decoder refuses shows nothing; the server's field errors do (docs/adr/0087). */
	create: (form: FormData): Write<"domain"> => {
		const input = createDomainForm.read(form);
		return write(
			"domain",
			input ? { type: "create", row: optimisticDomain(input) } : unshown(),
			() => createDomainAction(form),
		);
	},
	update: (id: string, form: FormData): Write<"domain"> => {
		const input = updateDomainForm.read(form);
		return write(
			"domain",
			input ? { type: "patch", id, patch: domainPatch(input) } : unshown(id),
			() => updateDomainAction(id, form),
			SAVE_ERROR,
		);
	},
	markShipped: (id: string): Write<"domain"> =>
		write(
			"domain",
			{ type: "patch", id, patch: { last_shipped_at: nowUtc() } },
			() => markDomainShippedAction(id),
			UPDATE_ERROR,
			"Marked shipped",
		),
	archive: (id: string): Write<"domain"> =>
		write(
			"domain",
			{ type: "patch", id, patch: { active: false, touch: null } },
			() => archiveDomainAction(id),
			UPDATE_ERROR,
			"Domain archived",
		),
	reactivate: (id: string): Write<"domain"> =>
		write(
			"domain",
			{ type: "patch", id, patch: { active: true } },
			() => reactivateDomainAction(id),
			UPDATE_ERROR,
			"Domain reactivated",
		),
};
