import { createClient } from "@insforge/sdk";

/**
 * Cliente de InsForge.
 *
 * Las credenciales se cargan desde variables de entorno (.env.local).
 * El admin debe crear el proyecto en insforge.dev y pegar aquí:
 *  - NEXT_PUBLIC_INSFORGE_URL   → tu-proyecto.insforge.app
 *  - NEXT_PUBLIC_INSFORGE_KEY   → tu anon/public key
 *
 * Si hay una sesión guardada en localStorage (insforge_session_v1),
 * el cliente se inicializa directamente con ese accessToken.
 * Esto garantiza que al reabrir el navegador la sesión esté activa
 * sin necesidad de volver a hacer login.
 */
const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const insforgeKey = process.env.NEXT_PUBLIC_INSFORGE_KEY!;

if (!insforgeUrl || !insforgeKey) {
  if (typeof window !== "undefined") {
    console.warn(
      "[InsForge] Faltan variables de entorno NEXT_PUBLIC_INSFORGE_URL y NEXT_PUBLIC_INSFORGE_KEY. " +
      "Copia .env.example a .env.local y añade tus credenciales."
    );
  }
}

/**
 * Lee el accessToken guardado en localStorage (si existe) para inicializar
 * el cliente con el token del usuario en lugar del anon key.
 * Esto hace que todas las llamadas al SDK estén autenticadas desde el
 * primer render, sin necesidad de esperar a restoreSession().
 */
function getInitialToken(): string {
  if (typeof window === "undefined") return insforgeKey || "";
  try {
    const raw = localStorage.getItem("insforge_session_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.accessToken) return parsed.accessToken;
    }
  } catch { /* incognito / JSON inválido */ }
  return insforgeKey || "";
}

export const insforge = createClient({
  baseUrl: insforgeUrl || "",
  anonKey: getInitialToken(),
});

export default insforge;
