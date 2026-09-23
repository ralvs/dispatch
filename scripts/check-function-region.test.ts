import { describe, expect, it } from "vitest";
import { checkFunctionRegions } from "./check-function-region";

function inspect(...outputs: { path: string; deployedTo?: string[] }[]) {
	return {
		builds: [
			{
				output: outputs.map(({ path, deployedTo }) =>
					deployedTo ? { path, lambda: { deployedTo } } : { path },
				),
			},
		],
	};
}

describe("checkFunctionRegions", () => {
	it("passes when every function is in gru1", () => {
		const report = checkFunctionRegions(
			inspect(
				{ path: "index", deployedTo: ["gru1"] },
				{ path: "api/capture", deployedTo: ["gru1"] },
			),
		);
		expect(report).toEqual({ checked: 2, offenders: [] });
	});

	it("names a function that moved to another region", () => {
		const report = checkFunctionRegions(
			inspect(
				{ path: "index", deployedTo: ["gru1"] },
				{ path: "api/capture", deployedTo: ["iad1"] },
			),
		);
		expect(report.offenders).toEqual([{ path: "api/capture", regions: ["iad1"] }]);
	});

	it("flags a function deployed to gru1 and somewhere else", () => {
		const report = checkFunctionRegions(inspect({ path: "index", deployedTo: ["gru1", "iad1"] }));
		expect(report.offenders).toEqual([{ path: "index", regions: ["gru1", "iad1"] }]);
	});

	it("lets the middleware run in every region", () => {
		const report = checkFunctionRegions(
			inspect(
				{ path: "_middleware", deployedTo: ["gru1", "iad1", "fra1"] },
				{ path: "index", deployedTo: ["gru1"] },
			),
		);
		expect(report).toEqual({ checked: 1, offenders: [] });
	});

	it("checks nothing when the output has no functions", () => {
		expect(checkFunctionRegions(inspect({ path: "favicon.ico" })).checked).toBe(0);
		expect(checkFunctionRegions({}).checked).toBe(0);
	});
});
