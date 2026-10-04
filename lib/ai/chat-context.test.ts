import { describe, expect, it } from "vitest";
import { chatSystemPrompt, renderChatContext } from "@/lib/ai/chat-context";
import type { JournalEntryRow } from "@/lib/services/journal";

function entry(i: number): JournalEntryRow {
	return {
		id: `entry-${i}`,
		book_id: null,
		entry_date: `2026-07-${String(i + 1).padStart(2, "0")}`,
		image_path: null,
		transcription_text: `Entry number ${i}`,
		source: "typed",
		tags: [],
		extracted_facts: {},
		attachments: [],
		resurface_weight: 0,
		created_at: "2026-01-01T00:00:00.000Z",
	} as JournalEntryRow;
}

describe("renderChatContext", () => {
	it("includes a section header for each provided source", () => {
		const context = renderChatContext({
			tasks: [],
			projects: [],
			people: [],
			entries: [],
			notes: [],
			quotes: [],
			domains: [],
		});

		expect(context).toContain("## Open tasks");
		expect(context).toContain("## Projects");
		expect(context).toContain("## People");
		expect(context).toContain("## Journal entries");
		expect(context).toContain("## Notes");
		expect(context).toContain("## Quotes");
		expect(context).toContain("## Domains");
	});

	it("omits sections that were dropped by a failed fetch", () => {
		const context = renderChatContext({ tasks: [] });

		expect(context).toContain("## Open tasks");
		expect(context).not.toContain("## Projects");
	});

	it("caps journal entries at 15 even when fed 20", () => {
		const entries = Array.from({ length: 20 }, (_, i) => entry(i));

		const context = renderChatContext({ entries });

		expect(context).toContain("## Journal entries (15)");
		expect(context).not.toContain("Entry number 15");
		expect(context).toContain("Entry number 14");
	});
});

describe("chatSystemPrompt", () => {
	// Iron rule #1: the timezone comes from app_settings, never a literal.
	it("names the timezone it is given", () => {
		const prompt = chatSystemPrompt("Europe/Lisbon", "2026-10-04", "");
		expect(prompt).toContain("Timezone is Europe/Lisbon;");
		expect(prompt).not.toContain("America/Sao_Paulo");
		expect(prompt).toContain("CONTEXT (snapshot for 2026-10-04):");
	});
});
