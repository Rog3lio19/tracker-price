import { eq } from "drizzle-orm";

import { db } from "#/db";
import { appSettings } from "#/db/schema";

/** Configuración clave/valor guardada como JSON en la tabla app_settings */
export async function getSetting<T>(key: string): Promise<T | null> {
	const [row] = await db
		.select({ value: appSettings.value })
		.from(appSettings)
		.where(eq(appSettings.key, key));
	return row ? (JSON.parse(row.value) as T) : null;
}

export async function setSetting(key: string, value: unknown) {
	const json = JSON.stringify(value);
	await db
		.insert(appSettings)
		.values({ key, value: json })
		.onConflictDoUpdate({
			target: appSettings.key,
			set: { value: json, updatedAt: new Date() },
		});
}

export async function deleteSetting(key: string) {
	await db.delete(appSettings).where(eq(appSettings.key, key));
}
