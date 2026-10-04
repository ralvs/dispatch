// The AI gateway is always faked in tests. With no key, the parser has no
// model unless a test injects test/fakes/parser-model.ts — a forgotten
// injection degrades to "unavailable" instead of making a paid call.
delete process.env.AI_GATEWAY_API_KEY;
