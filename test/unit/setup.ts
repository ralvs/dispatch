// The AI gateway is always faked in tests. With no key, the parser has no
// model unless a test injects test/fakes/parser-model.ts — a forgotten
// injection degrades to "unavailable" instead of making a paid call.
delete process.env.AI_GATEWAY_API_KEY;

// Storage is always faked too (docs/adr/0088). With no R2 credentials, a test
// that forgets to inject test/fakes/storage.ts throws "R2 is not configured"
// instead of reaching the bucket.
delete process.env.R2_ACCOUNT_ID;
delete process.env.R2_ACCESS_KEY_ID;
delete process.env.R2_SECRET_ACCESS_KEY;
delete process.env.R2_BUCKET;
