import { describe, expect, it, vi } from "vitest";
import type { IntentCtx } from "@/lib/store/types";
import { createPersonAction } from "./actions";
import { personListWrites } from "./writes";

vi.mock("./actions", () => ({ createPersonAction: vi.fn() }));

const ctx: IntentCtx = {
	todayIso: "2026-07-15",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

describe("personListWrites.create", () => {
	it("the new person shows what the form says; the form goes to the server as is", async () => {
		const fd = new FormData();
		fd.set("name", " Ana ");
		fd.set("relationship_type", "not-a-type");
		const w = personListWrites.create(fd);
		expect(w.intent).toMatchObject({
			type: "create",
			row: { name: "Ana", relationship_type: null, email: null },
		});
		await w.call(ctx);
		expect(createPersonAction).toHaveBeenCalledWith(fd);
	});
});
