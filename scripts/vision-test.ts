/**
 * Prueba un modelo de visión con una captura, sin tocar la base de datos:
 *   pnpm vision-test captura.png [modelo]
 *   pnpm vision-test captura.png nvidia/nemotron-3.5-super-vl:free
 */
import { readFileSync } from "node:fs";

import { extractPriceFromImage } from "#/scraper/vision";

const [file, model] = process.argv.slice(2);
if (!file) {
	console.error("Uso: pnpm vision-test <captura.png> [modelo]");
	process.exit(1);
}

const started = performance.now();
try {
	const result = await extractPriceFromImage(readFileSync(file), model);
	console.log(`→ resultado (${Math.round(performance.now() - started)} ms):`, result);
} catch (error) {
	console.error(`✗ ${(error as Error).constructor.name}: ${(error as Error).message}`);
	process.exit(1);
}
