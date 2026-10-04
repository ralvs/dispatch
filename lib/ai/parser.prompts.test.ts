import { describe, expect, it } from "vitest";
import { captureSystemPrompt, captureUserMessage } from "@/lib/ai/parser";
import { taskCaptureSystemPrompt } from "@/lib/services/capture/quick-add";

// The exact text the parser sends, pinned byte for byte. A prompt change is a
// measured decision (docs/adr/0061, the parser eval), never a side effect of a
// refactor: a diff in __golden__/ is the change, made visible.
const UTTERANCE = "comprar pão amanhã";
const PLAIN = {
	tz: "America/Sao_Paulo",
	todayIso: "2026-07-15",
	nowUtc: "2026-07-15T12:00:00.123Z",
};
const ROUTED = { ...PLAIN, domains: ["Home"], projects: [{ name: "Reviews", domain: "Work" }] };

describe("parser prompt text", () => {
	it("sends the capture system prompt unchanged", async () => {
		await expect(captureSystemPrompt()).toMatchFileSnapshot("./__golden__/capture-system.txt");
	});

	it("sends the task system prompt unchanged", async () => {
		await expect(taskCaptureSystemPrompt()).toMatchFileSnapshot("./__golden__/task-system.txt");
	});

	it("sends the user message unchanged, without lists", async () => {
		await expect(captureUserMessage(UTTERANCE, PLAIN)).toMatchFileSnapshot(
			"./__golden__/user-plain.txt",
		);
	});

	it("sends the user message unchanged, with lists", async () => {
		await expect(captureUserMessage(UTTERANCE, ROUTED)).toMatchFileSnapshot(
			"./__golden__/user-routed.txt",
		);
	});
});
