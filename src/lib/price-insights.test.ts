import { describe, expect, it } from "vitest";

import {
	discountPercent,
	type HistoryPoint,
	judgeOffer,
} from "./price-insights";

const DAY = 86_400_000;
const T0 = new Date("2026-10-01T12:00:00Z").getTime();
const point = (
	days: number,
	price: number | null,
	isSuspicious = false,
): HistoryPoint => ({
	price,
	isSuspicious,
	checkedAt: new Date(T0 + days * DAY),
});

describe("discountPercent", () => {
	it("calcula el porcentaje redondeado", () => {
		expect(discountPercent(25_014, 33_900)).toBe(26);
	});

	it("sin precio de lista o sin descuento real devuelve null", () => {
		expect(discountPercent(25_014, null)).toBeNull();
		expect(discountPercent(30_000, 30_000)).toBeNull();
		expect(discountPercent(30_000, 20_000)).toBeNull();
		expect(discountPercent(null, 20_000)).toBeNull();
	});
});

describe("judgeOffer", () => {
	it("sin descuento no hay veredicto", () => {
		expect(judgeOffer(10_000, null, [])).toEqual({ kind: "none" });
	});

	it("con poco historial es muy pronto para opinar", () => {
		expect(judgeOffer(25_000, 34_000, [point(0, 25_000)])).toEqual({
			kind: "too_early",
		});
		// 3 puntos pero en un solo día
		const sameDay = [point(0, 25_000), point(0.1, 25_000), point(0.2, 25_000)];
		expect(judgeOffer(25_000, 34_000, sameDay)).toEqual({ kind: "too_early" });
	});

	it("confirma la oferta si hace poco costaba casi el precio de lista", () => {
		const history = [point(0, 33_000), point(5, 30_000), point(10, 25_000)];
		expect(judgeOffer(25_000, 34_000, history)).toEqual({
			kind: "confirmed",
			highestSeen: 33_000,
		});
	});

	it("no puede comprobar un descuento si nunca lo vimos cerca del 'antes'", () => {
		const history = [point(0, 25_000), point(5, 25_100), point(10, 25_000)];
		expect(judgeOffer(25_000, 34_000, history)).toEqual({
			kind: "unverified",
			highestSeen: 25_100,
			days: 10,
		});
	});

	it("ignora lecturas sospechosas y sin stock", () => {
		const history = [
			point(0, 25_000),
			point(4, 90_000, true), // lectura rara, no cuenta
			point(6, null), // sin stock
			point(10, 25_000),
		];
		expect(judgeOffer(25_000, 34_000, history).kind).toBe("too_early");
	});
});
