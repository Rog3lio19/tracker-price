import { describe, expect, it } from "vitest";

import { isDue } from "./scheduler";

const NOW = new Date("2026-10-29T12:00:00Z");
const minutesAgo = (minutes: number) =>
	new Date(NOW.getTime() - minutes * 60_000);

describe("isDue", () => {
	it("un producto nunca revisado siempre toca", () => {
		expect(isDue({ lastCheckedAt: null, checkIntervalMinutes: 360 }, NOW)).toBe(
			true,
		);
	});

	it("no toca antes de cumplir el intervalo", () => {
		expect(
			isDue({ lastCheckedAt: minutesAgo(359), checkIntervalMinutes: 360 }, NOW),
		).toBe(false);
	});

	it("toca justo al cumplir el intervalo y después", () => {
		expect(
			isDue({ lastCheckedAt: minutesAgo(360), checkIntervalMinutes: 360 }, NOW),
		).toBe(true);
		expect(
			isDue(
				{ lastCheckedAt: minutesAgo(1000), checkIntervalMinutes: 360 },
				NOW,
			),
		).toBe(true);
	});
});
