import { z } from "zod";

export const CaptureSourceSchema = z.enum([
	"zapier",
	"cowork",
	"n8n",
	"manual",
	"webhook",
	"smart_glasses",
	"watch",
	"other",
]);

export const DisplayHintSchema = z.enum(["card", "log", "hidden"]);

export const ProcessedStatusSchema = z.enum(["raw", "parsed", "displayed", "archived"]);

// Payload accepted at POST /api/capture. Loose by design — anything with
// a `type` and `payload` is recorded; the consumer decides how to display.
export const CaptureIngressSchema = z.object({
	source: CaptureSourceSchema.default("webhook"),
	type: z.string().min(1),
	payload: z.record(z.string(), z.unknown()),
	tags: z.array(z.string()).optional(),
	display_hint: DisplayHintSchema.optional(),
	source_ref: z.string().optional(),
});
