import { MockLanguageModelV4 } from "ai/test";

// A stand-in for the gateway's parser model (docs/adr/0076). It is the SDK's
// own mock model, so the real generateObject runs against it: schema
// validation, retries, the abort signal and the usage numbers all behave as
// they do in production. Tests only — app code never imports this.

type CallOptions = Parameters<MockLanguageModelV4["doGenerate"]>[0];

/** An object is sent back as JSON text; an Error is thrown; a function answers the call. */
export type FakeAnswer = object | Error | ((o: CallOptions) => Promise<object>);

/** Usage every fake answer reports: 600 tokens in (500 of them a cache read), 40 out. */
export const FAKE_USAGE = {
	inputTokens: { total: 600, noCache: 100, cacheRead: 500, cacheWrite: 0 },
	outputTokens: { total: 40, text: 40, reasoning: 0 },
};

/** Answers in order; the last one repeats. An Error is thrown; an object is sent back as JSON text. */
export function fakeParserModel(...answers: FakeAnswer[]): MockLanguageModelV4 {
	let calls = 0;
	return new MockLanguageModelV4({
		doGenerate: async (options) => {
			const answer = answers[Math.min(calls++, answers.length - 1)];
			if (answer instanceof Error) throw answer;
			const object = typeof answer === "function" ? await answer(options) : answer;
			return {
				content: [{ type: "text", text: JSON.stringify(object) }],
				finishReason: { unified: "stop", raw: "stop" },
				usage: FAKE_USAGE,
				warnings: [],
			};
		},
	});
}

/** The system message the model received on a call. */
export function sentSystem(
	m: MockLanguageModelV4,
	call = 0,
): { content: string; providerOptions: unknown } {
	const message = sentOptions(m, call).prompt[0];
	if (message.role !== "system") throw new Error(`call ${call} opened with ${message.role}`);
	return { content: message.content, providerOptions: message.providerOptions };
}

/** The user message's text on a call. */
export function sentUser(m: MockLanguageModelV4, call = 0): string {
	const message = sentOptions(m, call).prompt[1];
	if (message.role !== "user") throw new Error(`call ${call} has no user message`);
	const part = message.content[0];
	if (part.type !== "text") throw new Error(`call ${call} sent a ${part.type} part`);
	return part.text;
}

/** Everything the model received on a call. */
export function sentOptions(m: MockLanguageModelV4, call = 0): CallOptions {
	const options = m.doGenerateCalls[call];
	if (!options) throw new Error(`the model was called ${m.doGenerateCalls.length} times`);
	return options;
}
