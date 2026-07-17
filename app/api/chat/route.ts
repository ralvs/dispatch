import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildChatSystemPrompt } from "@/lib/ai/chat-context";
import { chatModel, isAiConfigured } from "@/lib/ai/gateway";
import { ownerRoute } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { getAppTimezone } from "@/lib/services/settings";

// ─────────────────────────────────────────────────────────────────────────
// The read-only chat surface (Phase 6). Streams a UI-message response over
// a system prompt grounded in a live snapshot of the dashboard — the model
// never receives tool access, so there's nothing here that can write.
// ─────────────────────────────────────────────────────────────────────────

const BodySchema = z.object({
	messages: z.array(z.unknown()).min(1),
});

export const POST = ownerRoute(async (request, { sb }) => {
	if (!isAiConfigured()) {
		return NextResponse.json({ error: "ai_not_configured" }, { status: 503 });
	}

	const json = await request.json().catch(() => null);
	const parsed = BodySchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "invalid_request" }, { status: 400 });
	}
	const messages = parsed.data.messages as UIMessage[];

	const tz = await getAppTimezone(sb);
	const todayIso = todayInTz(tz);
	const system = await buildChatSystemPrompt(sb, tz, todayIso);

	const result = streamText({
		model: chatModel(),
		system,
		messages: await convertToModelMessages(messages),
	});

	return result.toUIMessageStreamResponse();
});
