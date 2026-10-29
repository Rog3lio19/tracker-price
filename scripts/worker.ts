/**
 * Worker: revisa los precios en segundo plano. Es un proceso aparte de la web
 * (en Docker será un segundo servicio que comparte el volumen de la base de datos).
 *
 *   pnpm worker
 */
import { runDueChecks } from "#/services/scheduler";

/** Cada cuánto vemos si hay algo pendiente (el intervalo real es por producto) */
const TICK_MS = 60_000;

let running = false;
let stopping = false;

async function tick() {
	// Si una vuelta tarda más de un minuto, no empezamos otra encima
	if (running || stopping) return;
	running = true;
	try {
		await runDueChecks((message) =>
			console.log(`[${new Date().toISOString()}] ${message}`),
		);
	} catch (error) {
		console.error("Error inesperado en el worker:", error);
	} finally {
		running = false;
	}
}

console.log(`Worker iniciado (revisa pendientes cada ${TICK_MS / 1000} s)`);
await tick();
const timer = setInterval(tick, TICK_MS);

// Docker manda SIGTERM al detener el contenedor: terminamos la revisión en curso
function shutdown() {
	stopping = true;
	clearInterval(timer);
	console.log("Deteniendo worker...");
	const wait = setInterval(() => {
		if (!running) process.exit(0);
	}, 500);
	wait.unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
