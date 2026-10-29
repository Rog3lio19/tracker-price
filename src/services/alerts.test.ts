import { describe, expect, it, vi } from "vitest";

import type { AlertRule } from "#/db/schema";

import { evaluateRules } from "./alerts";

// alerts.ts importa la base de datos; para estas pruebas puras no la necesitamos
vi.mock("#/db", () => ({ db: {} }));

const NOW = new Date("2026-10-29T12:00:00Z");

function rule(overrides: Partial<AlertRule>): AlertRule {
	return {
		id: 1,
		productId: 1,
		type: "all_time_low",
		threshold: null,
		isActive: true,
		cooldownHours: 24,
		lastTriggeredAt: null,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

function outcome(
	overrides: {
		price?: number | null;
		inStock?: boolean;
		suspicious?: boolean;
		previous?: Partial<{
			price: number | null;
			lowestPrice: number | null;
			wasInStock: boolean;
		}>;
	} = {},
) {
	return {
		kind: "ok" as const,
		price: 50_000 as number | null,
		listPrice: null,
		inStock: true,
		suspicious: false,
		...overrides,
		previous: {
			price: 60_000,
			lowestPrice: 55_000,
			wasInStock: true,
			...overrides.previous,
		},
	};
}

const types = (rules: AlertRule[]) => rules.map((r) => r.type);

describe("evaluateRules", () => {
	it("all_time_low avisa solo si el precio baja del mínimo anterior", () => {
		const rules = [rule({ type: "all_time_low" })];
		expect(evaluateRules(rules, outcome({ price: 54_999 }), NOW)).toHaveLength(
			1,
		);
		expect(evaluateRules(rules, outcome({ price: 55_000 }), NOW)).toHaveLength(
			0,
		);
		expect(evaluateRules(rules, outcome({ price: 56_000 }), NOW)).toHaveLength(
			0,
		);
	});

	it("la primera revisión (sin mínimo previo) no avisa", () => {
		const first = outcome({ previous: { price: null, lowestPrice: null } });
		const rules = [
			rule({ type: "all_time_low" }),
			rule({ type: "percent_drop", threshold: 10 }),
		];
		expect(evaluateRules(rules, first, NOW)).toHaveLength(0);
	});

	it("percent_drop compara contra la última revisión", () => {
		const rules = [rule({ type: "percent_drop", threshold: 10 })];
		// 60,000 -> 54,000 = justo 10%
		expect(evaluateRules(rules, outcome({ price: 54_000 }), NOW)).toHaveLength(
			1,
		);
		expect(evaluateRules(rules, outcome({ price: 54_001 }), NOW)).toHaveLength(
			0,
		);
	});

	it("target_price avisa al cruzar el objetivo, no mientras sigue debajo", () => {
		const rules = [rule({ type: "target_price", threshold: 52_000 })];
		const crossing = outcome({ price: 51_000, previous: { price: 53_000 } });
		const stillBelow = outcome({ price: 50_000, previous: { price: 51_000 } });
		expect(evaluateRules(rules, crossing, NOW)).toHaveLength(1);
		expect(evaluateRules(rules, stillBelow, NOW)).toHaveLength(0);
	});

	it("back_in_stock avisa al volver el stock", () => {
		const rules = [rule({ type: "back_in_stock" })];
		const back = outcome({ previous: { wasInStock: false } });
		expect(evaluateRules(rules, back, NOW)).toHaveLength(1);
		expect(evaluateRules(rules, outcome(), NOW)).toHaveLength(0);
	});

	it("un cambio sospechoso nunca avisa", () => {
		const rules = [
			rule({ type: "all_time_low" }),
			rule({ type: "percent_drop", threshold: 10 }),
		];
		expect(
			evaluateRules(rules, outcome({ price: 10_000, suspicious: true }), NOW),
		).toHaveLength(0);
	});

	it("sin stock o sin precio no avisa", () => {
		const rules = [rule({ type: "all_time_low" })];
		expect(evaluateRules(rules, outcome({ inStock: false }), NOW)).toHaveLength(
			0,
		);
		expect(evaluateRules(rules, outcome({ price: null }), NOW)).toHaveLength(0);
	});

	it("respeta el cooldown, salvo all_time_low", () => {
		const recently = new Date(NOW.getTime() - 3_600_000);
		const rules = [
			rule({
				id: 1,
				type: "percent_drop",
				threshold: 10,
				lastTriggeredAt: recently,
			}),
			rule({ id: 2, type: "all_time_low", lastTriggeredAt: recently }),
		];
		expect(
			types(evaluateRules(rules, outcome({ price: 40_000 }), NOW)),
		).toEqual(["all_time_low"]);
	});

	it("pasado el cooldown vuelve a avisar", () => {
		const longAgo = new Date(NOW.getTime() - 25 * 3_600_000);
		const rules = [
			rule({ type: "percent_drop", threshold: 10, lastTriggeredAt: longAgo }),
		];
		expect(evaluateRules(rules, outcome({ price: 40_000 }), NOW)).toHaveLength(
			1,
		);
	});

	it("ignora reglas inactivas", () => {
		const rules = [rule({ type: "all_time_low", isActive: false })];
		expect(evaluateRules(rules, outcome({ price: 40_000 }), NOW)).toHaveLength(
			0,
		);
	});
});
