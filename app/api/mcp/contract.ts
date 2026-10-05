import type { McpServer } from "@modelcontextprotocol/server";
import type { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────
// The one shape every MCP tool answers in (docs/adr/0079). A tool returns a
// plain value; the wrapper prints it as indented JSON text, which every MCP
// client shows and every model reads. A failure is a tool result with
// `isError`, never a thrown JSON-RPC error: the model sees the message and
// can correct itself, where a protocol error only ends the turn.
// ─────────────────────────────────────────────────────────────────────────

/** A failure the model should read as written ("No saved link with that id."). */
export class ToolError extends Error {
	override name = "ToolError";
}

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

type ToolConfig<S extends z.ZodObject> = {
	title: string;
	description: string;
	inputSchema: S;
	annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
};

function text(value: string, isError?: boolean): ToolResult {
	return { content: [{ type: "text", text: value }], ...(isError ? { isError } : {}) };
}

/** Register a tool whose `run` returns a value, not a CallToolResult. */
export function registerTextTool<S extends z.ZodObject>(
	server: Pick<McpServer, "registerTool">,
	name: string,
	config: ToolConfig<S>,
	run: (args: z.infer<S>) => Promise<unknown>,
): void {
	const callback = async (args: z.infer<S>): Promise<ToolResult> => {
		try {
			return text(JSON.stringify(await run(args), null, 2));
		} catch (err) {
			if (err instanceof ToolError) return text(err.message, true);
			return text(`Error: ${err instanceof Error ? err.message : String(err)}`, true);
		}
	};
	// The SDK's overloads infer the callback's args from the schema through
	// its own StandardSchema types, which do not line up with zod 4's generic
	// ZodObject. The one cast lives here so no tool file needs one.
	(server.registerTool as (n: string, c: unknown, cb: unknown) => void)(name, config, callback);
}
