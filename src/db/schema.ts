import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgTable,
	real,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

/*
 * Convenciones:
 * - Los precios se guardan en CENTAVOS como enteros (149900 = $1,499.00 MXN).
 *   Nunca uses float para dinero: 0.1 + 0.2 !== 0.3.
 * - Las fechas son `timestamptz` y Drizzle las entrega como Date.
 */

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

const timestamps = {
	createdAt: timestamptz("created_at").notNull().defaultNow(),
	updatedAt: timestamptz("updated_at")
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
};

export const marketplaces = ["amazon", "mercadolibre"] as const;
export type Marketplace = (typeof marketplaces)[number];

export const productStatuses = [
	"active", // se revisa normalmente
	"paused", // pausado manualmente
	"out_of_stock", // el vendedor elegido no tiene stock
	"seller_changed", // el link ahora apunta a otro vendedor (ver sellerLock)
	"error", // falló la extracción varias veces seguidas
] as const;
export type ProductStatus = (typeof productStatuses)[number];

export const extractionSources = [
	"api",
	"jsonld",
	"selector",
	"vision",
] as const;
export type ExtractionSource = (typeof extractionSources)[number];

export const products = pgTable(
	"products",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		marketplace: text({ enum: marketplaces }).notNull(),
		/** URL tal como la mandó el usuario */
		url: text().notNull(),
		/** URL normalizada (sin parámetros de tracking), sirve para no duplicar */
		canonicalUrl: text("canonical_url").notNull().unique(),
		/** ASIN en Amazon, ID de la publicación (MLM123456789) en Mercado Libre */
		externalId: text("external_id"),
		/** Mercado Libre: ID del producto de catálogo (/p/MLM...), compartido por varios vendedores */
		catalogProductId: text("catalog_product_id"),

		title: text(),
		imageUrl: text("image_url"),
		currency: text().notNull().default("MXN"),

		/** Vendedor que el usuario eligió al agregar el producto */
		sellerId: text("seller_id"),
		sellerName: text("seller_name"),
		/**
		 * Si es true, solo se aceptan precios de `sellerId`. Si el link empieza
		 * a mostrar otro vendedor, se marca como `seller_changed` en vez de
		 * registrar (y alertar) un precio de un vendedor en el que no confías.
		 */
		sellerLock: boolean("seller_lock").notNull().default(true),

		status: text({ enum: productStatuses }).notNull().default("active"),
		checkIntervalMinutes: integer("check_interval_minutes")
			.notNull()
			.default(360),
		/** Selector CSS aprendido para extraer el precio sin IA */
		priceSelector: text("price_selector"),

		/** Desnormalizado para listar rápido sin consultar el historial */
		lastPrice: integer("last_price"),
		lowestPrice: integer("lowest_price"),
		lastCheckedAt: timestamptz("last_checked_at"),
		consecutiveFailures: integer("consecutive_failures").notNull().default(0),

		...timestamps,
	},
	(t) => [index("products_status_idx").on(t.status)],
);

export const priceSnapshots = pgTable(
	"price_snapshots",
	{
		id: integer().primaryKey().generatedAlwaysAsIdentity(),
		productId: integer("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),
		/** null cuando no hay stock */
		price: integer(),
		/** Precio "antes" que muestra la tienda (el tachado) */
		listPrice: integer("list_price"),
		inStock: boolean("in_stock").notNull(),
		/** Vendedor que tenía la publicación en el momento de la revisión */
		sellerId: text("seller_id"),
		source: text({ enum: extractionSources }).notNull(),
		/** 0..1, sobre todo relevante cuando source = 'vision' */
		confidence: real(),
		screenshotPath: text("screenshot_path"),
		/** Cambio brusco o baja confianza: no dispara alertas hasta confirmarse */
		isSuspicious: boolean("is_suspicious").notNull().default(false),
		checkedAt: timestamptz("checked_at").notNull().defaultNow(),
	},
	(t) => [index("snapshots_product_date_idx").on(t.productId, t.checkedAt)],
);

export const alertTypes = [
	"target_price", // threshold = precio objetivo en centavos
	"percent_drop", // threshold = porcentaje de bajada vs. último precio
	"all_time_low", // threshold no se usa
	"back_in_stock", // threshold no se usa
] as const;
export type AlertType = (typeof alertTypes)[number];

export const alertRules = pgTable("alert_rules", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	productId: integer("product_id")
		.notNull()
		.references(() => products.id, { onDelete: "cascade" }),
	type: text({ enum: alertTypes }).notNull(),
	threshold: integer(),
	isActive: boolean("is_active").notNull().default(true),
	/** Evita mandarte la misma alerta cada revisión */
	cooldownHours: integer("cooldown_hours").notNull().default(24),
	lastTriggeredAt: timestamptz("last_triggered_at"),
	...timestamps,
});

export const notifications = pgTable("notifications", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	productId: integer("product_id")
		.notNull()
		.references(() => products.id, { onDelete: "cascade" }),
	alertRuleId: integer("alert_rule_id").references(() => alertRules.id, {
		onDelete: "set null",
	}),
	message: text().notNull(),
	telegramMessageId: integer("telegram_message_id"),
	sentAt: timestamptz("sent_at").notNull().defaultNow(),
});

export const scrapeErrors = pgTable("scrape_errors", {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	productId: integer("product_id")
		.notNull()
		.references(() => products.id, { onDelete: "cascade" }),
	message: text().notNull(),
	occurredAt: timestamptz("occurred_at").notNull().defaultNow(),
});

/** Clave/valor para configuración (ej. el chat_id autorizado de Telegram) */
export const appSettings = pgTable("app_settings", {
	key: text().primaryKey(),
	value: text().notNull(),
	...timestamps,
});

export const productsRelations = relations(products, ({ many }) => ({
	snapshots: many(priceSnapshots),
	alertRules: many(alertRules),
	notifications: many(notifications),
	errors: many(scrapeErrors),
}));

export const priceSnapshotsRelations = relations(priceSnapshots, ({ one }) => ({
	product: one(products, {
		fields: [priceSnapshots.productId],
		references: [products.id],
	}),
}));

export const alertRulesRelations = relations(alertRules, ({ one }) => ({
	product: one(products, {
		fields: [alertRules.productId],
		references: [products.id],
	}),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
	product: one(products, {
		fields: [notifications.productId],
		references: [products.id],
	}),
	alertRule: one(alertRules, {
		fields: [notifications.alertRuleId],
		references: [alertRules.id],
	}),
}));

export const scrapeErrorsRelations = relations(scrapeErrors, ({ one }) => ({
	product: one(products, {
		fields: [scrapeErrors.productId],
		references: [products.id],
	}),
}));

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type PriceSnapshot = typeof priceSnapshots.$inferSelect;
export type AlertRule = typeof alertRules.$inferSelect;
