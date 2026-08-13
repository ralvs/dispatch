/** 24h wall-clock slots for the time picker list. Not timezone math — just labels. */
export function wallClockSlots(stepMinutes = 15): string[] {
	if (stepMinutes <= 0 || (24 * 60) % stepMinutes !== 0) {
		throw new Error(`stepMinutes must divide 1440, got ${stepMinutes}`);
	}
	const out: string[] = [];
	for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
		const hour = Math.floor(minutes / 60);
		const minute = minutes % 60;
		out.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
	}
	return out;
}
