// Shared option lists + label lookups for the people forms and views.
// Kept in one place so the create form, the edit form, and the read-only
// detail/row views can't drift out of sync on what an enum value means.

export const RELATIONSHIP_TYPES = [
	{ value: "", label: "Unspecified" },
	{ value: "client", label: "Client" },
	{ value: "family", label: "Family" },
	{ value: "friend", label: "Friend" },
	{ value: "team", label: "Team" },
	{ value: "vendor", label: "Vendor" },
	{ value: "other", label: "Other" },
];

export const FACT_TYPES = [
	{ value: "anniversary", label: "Anniversary" },
	{ value: "birthday", label: "Birthday" },
	{ value: "kid_name", label: "Kid's name" },
	{ value: "shared", label: "Shared" },
	{ value: "follow_up", label: "Follow up" },
	{ value: "other", label: "Other" },
];

export const INTERACTION_TYPES = [
	{ value: "email", label: "Email" },
	{ value: "call", label: "Call" },
	{ value: "in_person", label: "In person" },
	{ value: "text", label: "Text" },
	{ value: "meeting", label: "Meeting" },
	{ value: "other", label: "Other" },
];

function labelFor(options: { value: string; label: string }[], value: string): string {
	return options.find((o) => o.value === value)?.label ?? value;
}

export function relationshipLabel(value: string): string {
	return labelFor(RELATIONSHIP_TYPES, value);
}

export function factTypeLabel(value: string): string {
	return labelFor(FACT_TYPES, value);
}

export function interactionTypeLabel(value: string): string {
	return labelFor(INTERACTION_TYPES, value);
}
