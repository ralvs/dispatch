import { describe, expect, it } from "vitest";
import { z } from "zod";
import { registerTextTool, ToolError } from "./contract";

type Callback = (args: unknown) => Promise<unknown>;

/** A stand-in server that keeps the callback the wrapper registers. */
function capture(run: () => Promise<unknown>): Callback {
	let cb: Callback | undefined;
	const server = {
		registerTool: (_name: string, _config: unknown, callback: Callback) => {
			cb = callback;
		},
	};
	registerTextTool(
		server as never,
		"t",
		{ title: "T", description: "d", inputSchema: z.object({}) },
		run,
	);
	if (!cb) throw new Error("not registered");
	return cb;
}

describe("registerTextTool", () => {
	it("prints the value as indented JSON text", async () => {
		const cb = capture(async () => ({ a: 1 }));
		expect(await cb({})).toEqual({ content: [{ type: "text", text: '{\n  "a": 1\n}' }] });
	});

	it("passes a ToolError's message through verbatim", async () => {
		const cb = capture(async () => {
			throw new ToolError("No saved link with that id.");
		});
		expect(await cb({})).toEqual({
			content: [{ type: "text", text: "No saved link with that id." }],
			isError: true,
		});
	});

	it("prefixes any other failure", async () => {
		const cb = capture(async () => {
			throw new Error("boom");
		});
		expect(await cb({})).toEqual({
			content: [{ type: "text", text: "Error: boom" }],
			isError: true,
		});
	});
});
