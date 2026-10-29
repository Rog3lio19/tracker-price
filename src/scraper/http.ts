/**
 * Peticiones "como navegador". No intentamos engañar a nadie: solo mandamos los
 * headers que manda cualquier navegador, para recibir la misma página que tú ves.
 */
const BROWSER_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
	Accept:
		"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
	"Accept-Language": "es-MX,es;q=0.9,en;q=0.5",
};

export async function fetchPage(url: string, init: RequestInit = {}) {
	return fetch(url, {
		...init,
		headers: { ...BROWSER_HEADERS, ...init.headers },
		signal: init.signal ?? AbortSignal.timeout(20_000),
	});
}
