/**
 * Cliente mínimo de la Bot API de Telegram (solo usamos fetch, sin librerías).
 * Docs: https://core.telegram.org/bots/api
 */
import { getSetting, setSetting } from "#/services/settings";

const OWNER_KEY = "telegram.ownerChatId";

function token() {
	const value = process.env.TELEGRAM_BOT_TOKEN;
	if (!value) throw new Error("Falta TELEGRAM_BOT_TOKEN");
	return value;
}

export function isTelegramConfigured() {
	return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export async function telegramCall<T>(
	method: string,
	body: Record<string, unknown> = {},
	timeoutMs = 15_000,
): Promise<T> {
	const response = await fetch(
		`https://api.telegram.org/bot${token()}/${method}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(timeoutMs),
		},
	);
	const data = (await response.json()) as {
		ok: boolean;
		result: T;
		description?: string;
	};
	// OJO: nunca imprimimos la URL del error: lleva el token del bot
	if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
	return data.result;
}

/** Telegram con parse_mode HTML solo exige escapar estos tres caracteres */
export function escapeHtml(text: string) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export function getOwnerChatId() {
	return getSetting<number>(OWNER_KEY);
}

export function setOwnerChatId(chatId: number) {
	setSetting(OWNER_KEY, chatId);
}

export function sendMessage(chatId: number, text: string) {
	return telegramCall<{ message_id: number }>("sendMessage", {
		chat_id: chatId,
		text,
		parse_mode: "HTML",
		link_preview_options: { is_disabled: true },
	});
}

/**
 * Manda un mensaje al dueño vinculado. Devuelve el id del mensaje, o null si
 * Telegram no está configurado o todavía no hay chat vinculado.
 */
export async function sendToOwner(text: string) {
	if (!isTelegramConfigured()) return null;
	const chatId = getOwnerChatId();
	if (chatId == null) return null;
	return (await sendMessage(chatId, text)).message_id;
}
