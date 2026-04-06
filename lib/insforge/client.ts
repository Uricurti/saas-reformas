import { createClient } from "@insforge/sdk";

const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const insforgeKey = process.env.NEXT_PUBLIC_INSFORGE_KEY!;

if (!insforgeUrl || !insforgeKey) {
  if (typeof window !== "undefined") {
    console.warn("[InsForge] Faltan NEXT_PUBLIC_INSFORGE_URL y NEXT_PUBLIC_INSFORGE_KEY");
  }
}

/**
 * Lee el token más reciente de localStorage en cada llamada.
 * Así, si el token se renueva (refresh), la siguiente query usa el nuevo token
 * sin necesidad de recargar la página ni recrear el cliente.
 */
function getCurrentToken(): string {
  if (typeof window === "undefined") return insforgeKey || "";
  try {
    const raw = localStorage.getItem("insforge_session_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.accessToken && parsed.accessToken !== "sdk-session") {
        return parsed.accessToken;
      }
    }
  } catch { /* incognito / JSON inválido */ }
  return insforgeKey || "";
}

/**
 * Cache del cliente InsForge.
 * Se recrea automáticamente cuando el token cambia (refresh, nuevo login).
 * Esto garantiza que todas las queries usan siempre el token vigente,
 * incluso si el token fue renovado en background mientras la pestaña estaba inactiva.
 */
let _cachedClient: ReturnType<typeof createClient> | null = null;
let _cachedToken = "";

function getLiveClient(): ReturnType<typeof createClient> {
  const token = getCurrentToken();
  if (!_cachedClient || token !== _cachedToken) {
    _cachedClient = createClient({ baseUrl: insforgeUrl || "", anonKey: token });
    _cachedToken = token;
  }
  return _cachedClient;
}

/**
 * Proxy que delega siempre al cliente con el token más fresco.
 * Compatible con todos los imports existentes: insforge.database, insforge.auth, etc.
 */
export const insforge = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop: string) {
    return (getLiveClient() as any)[prop];
  },
});

export default insforge;
