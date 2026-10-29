import { describe, expect, it } from "vitest";

import { isSuspiciousChange } from "./suspicious";

describe("isSuspiciousChange", () => {
	it("cambios normales no son sospechosos", () => {
		expect(isSuspiciousChange(90_000, 100_000, null)).toBe(false);
		expect(isSuspiciousChange(50_000, 100_000, null)).toBe(false); // justo 50%
	});

	it("la primera lectura nunca es sospechosa", () => {
		expect(isSuspiciousChange(50_000, null, null)).toBe(false);
	});

	it("una bajada de más de 50% es sospechosa la primera vez", () => {
		expect(isSuspiciousChange(40_000, 100_000, null)).toBe(true);
	});

	it("se confirma si la lectura anterior ya vio casi el mismo precio", () => {
		expect(isSuspiciousChange(40_000, 100_000, 40_500)).toBe(false);
	});

	it("no se confirma si la lectura sospechosa anterior era otro precio", () => {
		expect(isSuspiciousChange(40_000, 100_000, 70_000)).toBe(true);
	});
});
