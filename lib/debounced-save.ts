// Pure scheduling primitive for autosaving editors (docs/adr/0009). Fires
// `save` 2000ms after the last `schedule()` call, resets the timer on every
// new call, and lets a blur handler force an immediate flush. No timer is
// armed while the content is clean, so blur/unmount never fires a save for
// content that hasn't changed.

export type DebouncedSave = {
	/** Mark content dirty and (re)start the delay before `save` fires. */
	schedule: (value: string) => void;
	/** If a save is pending, run it immediately and clear the timer. */
	flush: () => void;
	/** Cancel a pending save without running it. */
	cancel: () => void;
};

export function createDebouncedSave(save: (value: string) => void, delayMs = 2000): DebouncedSave {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let pendingValue: string | undefined;

	function clear() {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	}

	return {
		schedule(value: string) {
			pendingValue = value;
			clear();
			timer = setTimeout(() => {
				timer = undefined;
				const value2 = pendingValue;
				pendingValue = undefined;
				if (value2 !== undefined) save(value2);
			}, delayMs);
		},
		flush() {
			if (timer === undefined) return;
			clear();
			const value = pendingValue;
			pendingValue = undefined;
			if (value !== undefined) save(value);
		},
		cancel() {
			clear();
			pendingValue = undefined;
		},
	};
}
