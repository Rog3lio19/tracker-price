/**
 * Worker: revisa los precios y atiende el bot de Telegram en segundo plano.
 * Es un proceso aparte de la web (comparte la base de datos con ella).
 *
 *   pnpm worker
 */
import { ensureDefaultRules } from "#/services/alerts";
import { runDueChecks } from "#/services/scheduler";
import { isTelegramConfigured } from "#/telegram/api";
import { startBot } from "#/telegram/bot";

/** Cada cuánto vemos si hay algo pendiente (el intervalo real es por producto) */
const TICK_MS = 60_000;

const log = (message: string) =>
	console.log(`[${new Date().toISOString()}] ${message}`);

let running = false;
let stopping = false;

async function tick() {
	// Si una vuelta tarda más de un minuto, no empezamos otra encima
	if (running || stopping) return;
	running = true;
	try {
		await runDueChecks(log);
	} catch (error) {
		console.error("Error inesperado en el worker:", error);
	} finally {
		running = false;
	}
}

await ensureDefaultRules();

const bot = isTelegramConfigured()
	? await startBot(log).catch((error) => {
			log(`El bot no pudo arrancar: ${(error as Error).message}`);
			return null;
		})
	: (log("Sin TELEGRAM_BOT_TOKEN: el worker corre sin alertas"), null);

log(`Worker iniciado (revisa pendientes cada ${TICK_MS / 1000} s)`);
await tick();
const timer = setInterval(tick, TICK_MS);

// Al detenerlo (SIGTERM) terminamos la revisión en curso
function shutdown() {
	stopping = true;
	clearInterval(timer);
	log("Deteniendo worker...");
	const wait = setInterval(() => {
		if (!running) process.exit(0);
	}, 500);
	wait.unref();
	void bot?.stop();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
