import type { Product } from "#/db/schema";

import { scrapeAmazon } from "./amazon";
import { scrapeMercadoLibre } from "./mercadolibre/api";
import type { ScrapeResult } from "./types";

export type ProductScrape = ScrapeResult & { itemId?: string };

/** Elige el extractor según la tienda */
export function scrapeProduct(product: Product): Promise<ProductScrape> {
	switch (product.marketplace) {
		case "amazon":
			return scrapeAmazon(product.canonicalUrl);
		case "mercadolibre":
			return scrapeMercadoLibre(product);
	}
}

export * from "./types";
