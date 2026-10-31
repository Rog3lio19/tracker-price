/**
 * Arranque para un solo contenedor: aplica migraciones y levanta la web y el
 * worker juntos. Si uno de los dos se cae, se detiene todo para que la
 * plataforma reinicie el contenedor en vez de dejarlo a medias.
 *
 *   node scripts/start.mjs
 */
import { spawn } from "node:child_process";

const run = (args) =>
	spawn(process.execPath, args, { stdio: "inherit", env: process.env });

const migrate = run(["--import", "tsx", "src/db/migrate.ts"]);
const migrateCode = await new Promise((resolve) => migrate.on("exit", resolve));
if (migrateCode !== 0) process.exit(migrateCode ?? 1);

const children = [
	run([".output/server/index.mjs"]),
	run(["--import", "tsx", "scripts/worker.ts"]),
];

let stopping = false;
function stop(signal) {
	stopping = true;
	for (const child of children) child.kill(signal);
}

// Docker manda SIGTERM al detener el contenedor: se lo pasamos a los dos
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

for (const child of children) {
	child.on("exit", (code, signal) => {
		if (!stopping) {
			console.error(`Un proceso terminó (${signal ?? code}); deteniendo todo`);
			process.exitCode = code || 1;
			stop("SIGTERM");
		}
	});
}
