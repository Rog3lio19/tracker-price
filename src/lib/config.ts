/**
 * Zona horaria con la que se muestran fechas (web y Telegram).
 * Es fija a propósito: si el servidor (Docker suele estar en UTC) y el navegador
 * formatearan con zonas distintas, React marcaría un "hydration mismatch".
 */
export const APP_TIMEZONE = "America/Tijuana";
