// Empty stub for the "server-only" package under Vitest. Source files keep
// importing "server-only" for real (it still throws in a real client
// bundle) — this alias only swaps the import target inside the test runner,
// which is neither server nor client.
export {};
