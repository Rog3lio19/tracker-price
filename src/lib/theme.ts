export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "tracker-price-theme";

/**
 * Script que se inyecta en el <head> y corre ANTES de que React hidrate.
 * Pone la clase `dark` en <html> según la preferencia guardada, para evitar
 * el "flash" de tema claro al recargar la página.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export function getStoredTheme(): Theme {
	const value = localStorage.getItem(THEME_STORAGE_KEY);
	return value === "light" || value === "dark" ? value : "system";
}

export function applyTheme(theme: Theme) {
	localStorage.setItem(THEME_STORAGE_KEY, theme);
	const isDark =
		theme === "dark" ||
		(theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
	document.documentElement.classList.toggle("dark", isDark);
}
