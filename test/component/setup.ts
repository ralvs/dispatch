import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * Shared setup for the component layer (docs/adr/0063).
 *
 * `next/navigation` has no router outside a Next render, so every hook the
 * client components here call is replaced with a spy. A test that cares about
 * navigation asserts on `router` from test/component/navigation.ts.
 *
 * Server actions are not mocked here: in a test, a `"use server"` module is
 * just a module of async functions. A test that renders a component calling
 * one mocks that module itself — `vi.mock("@/app/(authed)/tasks/actions")`.
 */
vi.mock("next/navigation", async () => {
	const navigation = await import("./navigation");
	return navigation.nextNavigationMock;
});

// Vitest runs without globals, so Testing Library's auto-cleanup never
// registers; unmount between tests by hand.
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
