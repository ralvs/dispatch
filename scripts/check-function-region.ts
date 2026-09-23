// Fails when a deployed function runs anywhere but gru1 (docs/adr/0062).
//
//   vercel inspect dispatch.alves.id --json | bun scripts/check-function-region.ts
//
// The built output is the source of truth, not vercel.json: the dashboard's
// Function Region setting overrides the file without a trace in the repo.
// .github/workflows/function-region.yml runs this after every Vercel deploy,
// on the same JSON from the REST API (GET /v11/deployments/:id/builds).

import { text } from "node:stream/consumers";

// The region follows the database (Supabase sa-east-1). Change both together.
export const EXPECTED_REGION = "gru1";

// proxy.ts runs in every region by design — it only refreshes the session.
const MIDDLEWARE_PATH = "_middleware";

type Output = {
	path?: string;
	lambda?: { deployedTo?: string[] };
};

type Inspect = {
	builds?: { output?: Output[] }[];
};

export type Offender = { path: string; regions: string[] };

export type RegionReport = { checked: number; offenders: Offender[] };

export function checkFunctionRegions(inspect: Inspect): RegionReport {
	const offenders: Offender[] = [];
	let checked = 0;
	for (const build of inspect.builds ?? []) {
		for (const output of build.output ?? []) {
			if (!output.lambda) continue;
			const path = output.path ?? "(no path)";
			if (path === MIDDLEWARE_PATH) continue;
			checked++;
			const regions = output.lambda.deployedTo ?? [];
			if (regions.length !== 1 || regions[0] !== EXPECTED_REGION) {
				offenders.push({ path, regions });
			}
		}
	}
	return { checked, offenders };
}

async function main(): Promise<number> {
	const raw = await text(process.stdin);
	let inspect: Inspect;
	try {
		inspect = JSON.parse(raw) as Inspect;
	} catch (error) {
		console.error("Input is not JSON. Pipe in `vercel inspect <url> --json`.", error);
		return 1;
	}

	const { checked, offenders } = checkFunctionRegions(inspect);
	// Zero functions means the JSON shape moved, not that all is well.
	if (checked === 0) {
		console.error("No functions found in the inspect output. Has its JSON shape changed?");
		return 1;
	}
	if (offenders.length > 0) {
		console.error(`${offenders.length} of ${checked} functions are not in ${EXPECTED_REGION}:`);
		for (const { path, regions } of offenders) {
			console.error(`  ${path} → [${regions.join(", ")}]`);
		}
		return 1;
	}
	console.log(`All ${checked} functions run in ${EXPECTED_REGION}.`);
	return 0;
}

if (import.meta.main) {
	process.exit(await main());
}
