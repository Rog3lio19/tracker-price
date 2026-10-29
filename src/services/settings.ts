import { eq } from "drizzle-orm";

import { db } from "#/db";
import { appSettings } from "#/db/schema";

/** Configuración clave/valor guardada como JSON en la tabla app_settings */
export function getSetting<T>(key: string): T | null {
	const row = db
		.select({ value: appSettings.value })
		.from(appSettings)
		.where(eq(appSettings.key, key))
		.get();
	return row ? (JSON.parse(row.value) as T) : null;
}

export function setSetting(key: string, value: unknown) {
	const json = JSON.stringify(value);
	db.insert(appSettings)
		.values({ key, value: json })
		.onConflictDoUpdate({
			target: appSettings.key,
			set: { value: json, updatedAt: new Date() },
		})
		.run();
}

export function deleteSetting(key: string) {
	db.delete(appSettings).where(eq(appSettings.key, key)).run();
}
