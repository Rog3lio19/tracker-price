/**
 * OAuth de Mercado Libre (flujo "authorization code").
 *
 * 1. Te mandamos a auth.mercadolibre.com.mx para que autorices la app.
 * 2. ML te regresa a REDIRECT_URI con ?code=TG-...
 * 3. Cambiamos ese code por un access_token (dura 6 h) y un refresh_token.
 * 4. Cuando el access_token vence, usamos el refresh_token para pedir otro.
 *    OJO: cada refresh_token sirve UNA sola vez; hay que guardar el nuevo.
 *
 * Docs: https://developers.mercadolibre.com.mx/es_ar/autenticacion-y-autorizacion
 */
import { randomBytes } from "node:crypto";

import { deleteSetting, getSetting, setSetting } from "#/services/settings";

import { NotConfiguredError } from "../types";

const AUTH_URL = "https://auth.mercadolibre.com.mx/authorization";
const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const TOKENS_KEY = "mercadolibre.tokens";
const STATE_KEY = "mercadolibre.oauthState";
/** Renovamos un poco antes de que venza para no fallar a medio camino */
const REFRESH_MARGIN_MS = 10 * 60 * 1000;

type StoredTokens = {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	userId: number;
};

type TokenResponse = {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	user_id: number;
};

function getAppCredentials() {
	const clientId = process.env.ML_CLIENT_ID;
	const clientSecret = process.env.ML_CLIENT_SECRET;
	const redirectUri = process.env.ML_REDIRECT_URI;
	if (!clientId || !clientSecret || !redirectUri) return null;
	return { clientId, clientSecret, redirectUri };
}

export function getMercadoLibreStatus() {
	const app = getAppCredentials();
	const tokens = getSetting<StoredTokens>(TOKENS_KEY);
	return {
		appConfigured: app != null,
		connected: tokens != null,
		userId: tokens?.userId ?? null,
		redirectUri: app?.redirectUri ?? null,
	};
}

export function buildAuthorizeUrl() {
	const app = getAppCredentials();
	if (!app)
		throw new NotConfiguredError(
			"Faltan ML_CLIENT_ID / ML_CLIENT_SECRET / ML_REDIRECT_URI",
		);
	// `state` evita que alguien te haga conectar una cuenta que no es tuya
	const state = randomBytes(16).toString("hex");
	setSetting(STATE_KEY, state);
	const params = new URLSearchParams({
		response_type: "code",
		client_id: app.clientId,
		redirect_uri: app.redirectUri,
		state,
	});
	return `${AUTH_URL}?${params}`;
}

/**
 * Recibe lo que pegues después de autorizar: la URL completa a la que te
 * mandó ML (con ?code=...&state=...) o solo el code.
 */
export async function connectWithCode(input: string) {
	const app = getAppCredentials();
	if (!app)
		throw new NotConfiguredError(
			"Faltan las credenciales de la app de Mercado Libre",
		);

	let code = input.trim();
	if (code.includes("code=")) {
		const url = new URL(code, "https://placeholder.local");
		code = url.searchParams.get("code") ?? "";
		const state = url.searchParams.get("state");
		if (state && state !== getSetting<string>(STATE_KEY)) {
			throw new Error(
				"El parámetro state no coincide: vuelve a iniciar la conexión",
			);
		}
	}
	if (!code) throw new Error("No encontré el code en lo que pegaste");

	const tokens = await requestTokens({
		grant_type: "authorization_code",
		client_id: app.clientId,
		client_secret: app.clientSecret,
		code,
		redirect_uri: app.redirectUri,
	});
	deleteSetting(STATE_KEY);
	return tokens.userId;
}

export function disconnectMercadoLibre() {
	deleteSetting(TOKENS_KEY);
}

let refreshing: Promise<StoredTokens> | null = null;

/** Access token válido, renovándolo si hace falta */
export async function getAccessToken() {
	const tokens = getSetting<StoredTokens>(TOKENS_KEY);
	if (!tokens) {
		throw new NotConfiguredError(
			"Conecta tu cuenta de Mercado Libre en Configuración",
		);
	}
	if (tokens.expiresAt - REFRESH_MARGIN_MS > Date.now())
		return tokens.accessToken;

	const app = getAppCredentials();
	if (!app)
		throw new NotConfiguredError(
			"Faltan las credenciales de la app de Mercado Libre",
		);

	// Si dos revisiones piden token a la vez, solo una renueva: el refresh_token
	// es de un solo uso y la segunda petición lo encontraría ya gastado
	refreshing ??= requestTokens({
		grant_type: "refresh_token",
		client_id: app.clientId,
		client_secret: app.clientSecret,
		refresh_token: tokens.refreshToken,
	}).finally(() => {
		refreshing = null;
	});
	return (await refreshing).accessToken;
}

async function requestTokens(body: Record<string, string>) {
	const response = await fetch(TOKEN_URL, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams(body),
		signal: AbortSignal.timeout(15_000),
	});
	if (!response.ok) {
		const detail = await response.text();
		if (body.grant_type === "refresh_token" && response.status === 400) {
			// El refresh_token venció (6 meses) o se revocó: hay que reconectar
			disconnectMercadoLibre();
			throw new NotConfiguredError(
				"La conexión con Mercado Libre expiró, vuelve a conectarla en Configuración",
			);
		}
		throw new Error(
			`Mercado Libre rechazó el token (${response.status}): ${detail}`,
		);
	}
	const data = (await response.json()) as TokenResponse;
	const tokens: StoredTokens = {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresAt: Date.now() + data.expires_in * 1000,
		userId: data.user_id,
	};
	setSetting(TOKENS_KEY, tokens);
	return tokens;
}
