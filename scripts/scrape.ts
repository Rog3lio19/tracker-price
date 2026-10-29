/**
 * Prueba la extracción de un link SIN guardar nada:
 *   pnpm scrape "https://www.amazon.com.mx/dp/B0G5834M45"
 */
import { parseProductUrl } from '#/lib/product-url'
import { scrapeProduct } from '#/scraper'
import { isShortLink, resolveShortLink } from '#/scraper/short-links'
import type { Product } from '#/db/schema'

const input = process.argv[2]
if (!input) {
  console.error('Uso: pnpm scrape <url>')
  process.exit(1)
}

const url = isShortLink(input) ? await resolveShortLink(input) : input
if (url !== input) console.log('→ link real:', url)

const parsed = parseProductUrl(url)
console.log('→ parseado:', parsed)

const started = performance.now()
try {
  const result = await scrapeProduct({ ...parsed, url } as Product)
  console.log(`→ resultado (${Math.round(performance.now() - started)} ms):`, result)
} catch (error) {
  console.error(`✗ ${(error as Error).constructor.name}: ${(error as Error).message}`)
  process.exit(1)
}
