import { describe, expect, it } from "vitest";
import { ServiceError, unwrap } from "@/lib/services/errors";

describe("unwrap", () => {
	it("passes through data on success", () => {
		expect(unwrap({ data: [1, 2, 3], error: null })).toEqual([1, 2, 3]);
	});

	it("passes through null data on success (e.g. maybeSingle with no row)", () => {
		expect(unwrap({ data: null, error: null })).toBeNull();
	});

	it("throws a ServiceError preserving the Postgres error code", () => {
		expect(() =>
			unwrap({
				data: null,
				error: { message: "duplicate key value", code: "23505", details: "Key already exists." },
			}),
		).toThrow(ServiceError);

		try {
			unwrap({
				data: null,
				error: { message: "duplicate key value", code: "23505", details: "Key already exists." },
			});
			throw new Error("unwrap should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(ServiceError);
			const serviceError = err as ServiceError;
			expect(serviceError.message).toBe("duplicate key value");
			expect(serviceError.code).toBe("23505");
			expect(serviceError.details).toBe("Key already exists.");
		}
	});
});
