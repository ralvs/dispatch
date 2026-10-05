import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTheme } from "./theme-actions";
import { ThemePicker } from "./theme-picker";

vi.mock("./theme-actions", () => ({ setTheme: vi.fn(async () => {}) }));

function osPrefersDark(dark: boolean) {
	vi.stubGlobal(
		"matchMedia",
		vi.fn((query: string) => ({ matches: dark, media: query })),
	);
}

describe("ThemePicker", () => {
	beforeEach(() => {
		const root = document.documentElement;
		root.dataset.themePref = "system";
		root.dataset.theme = "light";
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("presses the pick on <html>", () => {
		document.documentElement.dataset.themePref = "dark";
		render(<ThemePicker />);
		expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "false");
	});

	it("forces Dark even when the OS is light, and saves it", async () => {
		osPrefersDark(false);
		const user = userEvent.setup();
		render(<ThemePicker />);
		await user.click(screen.getByRole("button", { name: "Dark" }));

		const root = document.documentElement;
		expect(root.dataset.themePref).toBe("dark");
		expect(root.dataset.theme).toBe("dark");
		await waitFor(() => expect(setTheme).toHaveBeenCalledWith("dark"));
		expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
	});

	it("resolves System from the OS", async () => {
		document.documentElement.dataset.themePref = "light";
		osPrefersDark(true);
		const user = userEvent.setup();
		render(<ThemePicker />);
		await user.click(screen.getByRole("button", { name: "System" }));

		const root = document.documentElement;
		expect(root.dataset.themePref).toBe("system");
		expect(root.dataset.theme).toBe("dark");
		await waitFor(() => expect(setTheme).toHaveBeenCalledWith("system"));
	});

	it("puts the old pick back when the save fails", async () => {
		document.documentElement.dataset.themePref = "dark";
		document.documentElement.dataset.theme = "dark";
		osPrefersDark(false);
		vi.mocked(setTheme).mockRejectedValueOnce(new Error("offline"));
		const user = userEvent.setup();
		render(<ThemePicker />);
		await user.click(screen.getByRole("button", { name: "System" }));

		const root = document.documentElement;
		await waitFor(() => expect(root.dataset.themePref).toBe("dark"));
		expect(root.dataset.theme).toBe("dark");
		expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
	});
});
