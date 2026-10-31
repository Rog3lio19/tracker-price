/**
 * El bot: recibe mensajes por "long polling". En vez de que Telegram llame a
 * nuestro servidor (webhook, requiere HTTPS público), nosotros le preguntamos
 * "¿hay algo nuevo?" y Telegram deja la petición abierta hasta ~30 s o hasta
 * que llegue un mensaje. Funciona detrás de cualquier router sin abrir puertos.
 */
import { randomInt } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import { db } from "#/db";
import { alertRules, products } from "#/db/schema";
import { formatPrice } from "#/lib/format";
import { marketplaceLabel } from "#/lib/product-labels";
import { checkAndNotify } from "#/services/alerts";
import { addProductFromUrl } from "#/services/products";

import {
	escapeHtml,
	getOwnerChatId,
	sendMessage,
	setOwnerChatId,
	telegramCall,
} from "./api";

type Update = {
	update_id: number;
	message?: { chat: { id: number; type: string }; text?: string };
};

const HELP = [
	"<b>Tracker Price</b>",
	"Mándame el link de un producto de Amazon MX o Mercado Libre y lo empiezo a seguir.",
	"",
	"/lista — tus productos y su precio",
	"/objetivo <code>id precio</code> — avisarme al llegar a ese precio (ej. <code>/objetivo 8 600</code>)",
	"/ayuda — este mensaje",
	"",
	"Cada producto nuevo avisa solo cuando: llega a mínimo histórico, baja 10% o más, o vuelve a tener stock.",
].join("\n");

/** Código de un solo uso para vincular el chat; se muestra en la consola del worker */
let pairingCode: string | null = null;

export async function startBot(log: (message: string) => void = console.log) {
	const me = await telegramCall<{ username: string }>("getMe");
	// Si hubiera un webhook activo, Telegram rechaza getUpdates
	await telegramCall("deleteWebhook");

	if ((await getOwnerChatId()) == null) {
		pairingCode = String(randomInt(100_000, 1_000_000));
		log(
			`Bot @${me.username} sin vincular. Mándale /start ${pairingCode} desde tu Telegram.`,
		);
	} else {
		log(`Bot @${me.username} listo`);
	}

	let offset = 0;
	let stopped = false;
	const loop = (async () => {
		while (!stopped) {
			try {
				const updates = await telegramCall<Update[]>(
					"getUpdates",
					{ offset, timeout: 30, allowed_updates: ["message"] },
					45_000,
				);
				for (const update of updates) {
					offset = update.update_id + 1;
					await handleUpdate(update).catch((error) =>
						log(`Error atendiendo mensaje: ${(error as Error).message}`),
					);
				}
			} catch (error) {
				log(
					`Telegram no responde (${(error as Error).message}), reintento en 10 s`,
				);
				await new Promise((resolve) => setTimeout(resolve, 10_000));
			}
		}
	})();

	return {
		stop() {
			stopped = true;
			return loop;
		},
	};
}

async function handleUpdate(update: Update) {
	const message = update.message;
	if (!message?.text || message.chat.type !== "private") return;
	const chatId = message.chat.id;
	const text = message.text.trim();

	// --- Vinculación -----------------------------------------------------------
	const owner = await getOwnerChatId();
	if (owner == null) {
		const [command, code] = text.split(/\s+/);
		if (command === "/start" && pairingCode && code === pairingCode) {
			await setOwnerChatId(chatId);
			pairingCode = null;
			await sendMessage(
				chatId,
				`✅ Vinculado. Ya puedo avisarte aquí.\n\n${HELP}`,
			);
		} else {
			await sendMessage(
				chatId,
				"Este bot todavía no está vinculado. Usa /start con el código que muestra el worker.",
			);
		}
		return;
	}
	// Cualquier otra persona que encuentre el bot es ignorada
	if (chatId !== owner) return;

	// --- Comandos --------------------------------------------------------------
	const [command = "", ...args] = text.split(/\s+/);
	switch (command.split("@")[0]) {
		case "/start":
		case "/ayuda":
		case "/help":
			return void (await sendMessage(chatId, HELP));
		case "/lista":
			return void (await sendMessage(chatId, await buildList()));
		case "/objetivo":
			return void (await sendMessage(chatId, await setTarget(args)));
	}

	// --- Un link = alta de producto -------------------------------------------
	const url = text.match(/https?:\/\/\S+/)?.[0];
	if (url) return void (await sendMessage(chatId, await addFromLink(url)));

	await sendMessage(chatId, "No entendí. Mándame un link o usa /ayuda.");
}

async function addFromLink(url: string) {
	const result = await addProductFromUrl(url);
	if (result.status === "invalid") return `❌ ${escapeHtml(result.error)}`;

	if (result.status === "created") {
		await checkAndNotify(result.id);
	}
	const [product] = await db
		.select()
		.from(products)
		.where(eq(products.id, result.id));
	if (!product) return "No pude guardar el producto.";

	const head =
		result.status === "exists"
			? "Ya estaba en tu lista:"
			: "✅ Listo, lo estoy siguiendo:";
	const price =
		product.lastPrice != null
			? `<b>${formatPrice(product.lastPrice)}</b>`
			: "Todavía no pude leer el precio (lo intentaré de nuevo solo).";
	return [
		head,
		`<b>${escapeHtml(product.title ?? product.externalId ?? "Producto")}</b>`,
		`${marketplaceLabel[product.marketplace]} · id ${product.id}`,
		price,
		product.sellerName ? `Vendedor: ${escapeHtml(product.sellerName)}` : "",
	]
		.filter(Boolean)
		.join("\n");
}

async function buildList() {
	const all = await db
		.select()
		.from(products)
		.orderBy(desc(products.createdAt));
	if (all.length === 0)
		return "Todavía no sigues ningún producto. Mándame un link.";
	return all
		.map((product) => {
			const title = escapeHtml(
				product.title ?? product.externalId ?? "Sin nombre",
			);
			const paused = product.status === "paused" ? " ⏸" : "";
			return `<b>${product.id}</b>. ${title}${paused}\n${formatPrice(product.lastPrice)} · mín. ${formatPrice(product.lowestPrice)}`;
		})
		.join("\n\n");
}

async function setTarget(args: string[]) {
	const [idText, priceText] = args;
	const id = Number(idText);
	const pesos = Number((priceText ?? "").replace(/[$,]/g, ""));
	if (!Number.isInteger(id) || !Number.isFinite(pesos) || pesos <= 0) {
		return "Uso: <code>/objetivo id precio</code>, por ejemplo <code>/objetivo 8 600</code>. Los ids salen en /lista.";
	}
	const [product] = await db.select().from(products).where(eq(products.id, id));
	if (!product) return `No existe el producto ${id}.`;

	return setTargetRule(id, Math.round(pesos * 100), product.title);
}

/** Una sola regla de precio objetivo por producto: si ya hay, se actualiza */
async function setTargetRule(
	productId: number,
	threshold: number,
	title: string | null,
) {
	const rules = await db
		.select()
		.from(alertRules)
		.where(eq(alertRules.productId, productId));
	const existing = rules.find((rule) => rule.type === "target_price");
	if (existing) {
		await db
			.update(alertRules)
			.set({ threshold, lastTriggeredAt: null })
			.where(eq(alertRules.id, existing.id));
	} else {
		await db
			.insert(alertRules)
			.values({ productId, type: "target_price", threshold });
	}
	return `🎯 Te aviso cuando <b>${escapeHtml(title ?? `#${productId}`)}</b> llegue a ${formatPrice(threshold)} o menos.`;
}
