import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { navigation } from "@/test/component/navigation";
import { usePagePathname } from "./use-page-pathname";

afterEach(() => {
	navigation.pathname = "/today";
	navigation.page = null;
});

function at(pathname: string, page: string | null) {
	navigation.pathname = pathname;
	navigation.page = page;
	return renderHook(() => usePagePathname()).result.current;
}

// The nav lights the page on screen, not a task open over it (docs/adr/0079).
describe("usePagePathname", () => {
	it("is the pathname when the page is the address", () => {
		expect(at("/today", "today")).toBe("/today");
		expect(at("/projects/p1", "projects")).toBe("/projects/p1");
	});

	it("is the page underneath while a task is open over it", () => {
		expect(at("/tasks/t1", "today")).toBe("/today");
		expect(at("/tasks/t1", "projects")).toBe("/projects");
	});

	it("is the task's own address when the task is the page", () => {
		expect(at("/tasks/t1", "tasks")).toBe("/tasks/t1");
	});

	it("is the pathname when no segment is known", () => {
		expect(at("/", null)).toBe("/");
	});
});
