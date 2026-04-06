import insforge from "./client";
import type { User } from "@/types";

// ─── Persistencia de sesión en localStorage ──────────────────────────────────
const SESSION_KEY = "insforge_session_v1";

interface StoredSession {
  accessToken:  string;
  refreshToken: string;
  userId:       string;
  savedAt:      number; // timestamp para detectar tokens muy viejos
}

export function saveSession(accessToken: string, refreshToken: string, userId: string) {
  try {
    const session: StoredSession = { accessToken, refreshToken, userId, savedAt: Date.now() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch { /* incognito / storage bloqueado */ }
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch { return null; }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignorar */ }
}

// ─── Aplicar token al cliente InsForge SDK ────────────────────────────────────
// Intentamos setSession con AMBOS tokens (como requieren los SDKs tipo Supabase)
async function applyTokenToClient(accessToken: string, refreshToken: string = "") {
  try {
    await (insforge.auth as any).setSession?.({
      access_token:  accessToken,
      refresh_token: refreshToken,
    });
  } catch { /* setSession no disponible en este SDK */ }
}

// ─── Validar token con raw fetch (bypass del SDK) ─────────────────────────────
// Si el SDK no gestiona la sesión correctamente, validamos directamente
// con el endpoint de InsForge usando el token como Authorization header.
async function validateTokenRaw(accessToken: string): Promise<{ id: string } | null> {
  try {
    const url = process.env.NEXT_PUBLIC_INSFORGE_URL!;
    // Intentamos los endpoints más comunes de auth en InsForge / Supabase
    const endpoints = ["/api/auth/user", "/api/auth/me", "/api/auth/session"];
    for (const ep of endpoints) {
      try {
        const res = await fetch(`${url}${ep}`, {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "apikey": process.env.NEXT_PUBLIC_INSFORGE_KEY ?? "",
          },
        });
        if (res.ok) {
          const data = await res.json();
          const userId = data?.id ?? data?.user?.id ?? data?.data?.user?.id ?? "";
          if (userId) return { id: userId };
        }
      } catch { /* probar siguiente endpoint */ }
    }
    return null;
  } catch { return null; }
}

// ─── Refrescar tokens ────────────────────────────────────────────────────────
// Usamos nuestra API route /api/auth/refresh como proxy servidor:
// InsForge acepta el refreshToken en el body para clientes no-browser (sin CSRF).
// Desde el navegador el endpoint directo está bloqueado por SameSite cookies.
async function refreshTokens(refreshToken: string): Promise<StoredSession | null> {
  if (!refreshToken || refreshToken === "sdk-session") return null;
  try {
    const res = await fetch("/api/auth/refresh", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newAccess  = data?.accessToken  ?? data?.access_token  ?? "";
    const newRefresh = data?.refreshToken ?? data?.refresh_token ?? refreshToken;
    const userId     = data?.user?.id ?? data?.userId ?? "";
    if (!newAccess) return null;
    return { accessToken: newAccess, refreshToken: newRefresh, userId, savedAt: Date.now() };
  } catch { return null; }
}

// ─── Sign In ─────────────────────────────────────────────────────────────────
export async function signIn(email: string, password: string) {
  try {
    const url = process.env.NEXT_PUBLIC_INSFORGE_URL!;

    // Primero intentamos client_type=desktop → refresh token en el body
    const res = await fetch(`${url}/api/auth/sessions?client_type=desktop`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (res.ok && !data.error && data.user) {
      const accessToken  = data.accessToken  ?? data.access_token  ?? "";
      const refreshToken = data.refreshToken ?? data.refresh_token ?? "";
      const userId       = data.user?.id ?? "";

      if (accessToken) {
        // Guardar tokens en localStorage
        saveSession(accessToken, refreshToken || accessToken, userId);
        // Aplicar al SDK (con ambos tokens)
        await applyTokenToClient(accessToken, refreshToken);
      }
      return { data: { user: data.user, session: data }, error: null };
    }
  } catch { /* continuar con SDK */ }

  // Fallback: SDK estándar
  const fallback = await insforge.auth.signInWithPassword({ email, password });

  if (fallback.data?.user) {
    // Intentar extraer los tokens que el SDK recibió internamente
    try {
      const sessResult = await (insforge.auth as any).getSession?.();
      const sess = sessResult?.data?.session ?? sessResult?.session;
      const at = sess?.access_token  ?? "";
      const rt = sess?.refresh_token ?? "";
      if (at) {
        saveSession(at, rt || at, fallback.data.user.id);
        await applyTokenToClient(at, rt);
      } else {
        // SDK no expone la sesión — guardar el userId al menos para
        // poder revalidar más tarde si el SDK mantiene la sesión internamente
        saveSession("sdk-session", "sdk-session", fallback.data.user.id);
      }
    } catch {
      saveSession("sdk-session", "sdk-session", fallback.data.user.id);
    }
  }

  return fallback;
}

// ─── Sign Out ────────────────────────────────────────────────────────────────
export async function signOut() {
  clearSession();
  try {
    await insforge.auth.signOut();
  } catch { /* ignorar errores de red */ }
  return { error: null };
}

// ─── Restaurar sesión (llamar al inicio de la app) ───────────────────────────
export async function restoreSession(): Promise<{ id: string } | null> {
  const stored = loadSession();
  if (!stored) return null;

  // Tokens especiales "sdk-session" → el SDK gestiona la sesión internamente
  // (fallback de signInWithPassword sin tokens explícitos)
  if (stored.accessToken === "sdk-session") {
    try {
      // Intentar con el SDK directamente (puede tener la sesión en memoria/cookie de corta vida)
      const { data } = await insforge.auth.getCurrentUser();
      if (data?.user?.id) return data.user;
    } catch { /* sesión expirada */ }
    // La sesión del SDK ya no está → forzar nuevo login
    clearSession();
    return null;
  }

  // Tokens reales: aplicar al SDK primero
  await applyTokenToClient(stored.accessToken, stored.refreshToken);

  // 1. Intentar con el SDK tras setSession
  try {
    const { data } = await insforge.auth.getCurrentUser();
    if (data?.user?.id) return data.user;
  } catch { /* SDK no reconoce el token */ }

  // 2. Validar directamente con raw fetch (bypass del SDK)
  const userFromRaw = await validateTokenRaw(stored.accessToken);
  if (userFromRaw?.id) return userFromRaw;

  // 3. Token expirado → intentar refresh
  const renewed = await refreshTokens(stored.refreshToken);
  if (!renewed) {
    clearSession();
    return null;
  }

  // Guardar nuevos tokens y aplicar
  saveSession(renewed.accessToken, renewed.refreshToken, renewed.userId);
  await applyTokenToClient(renewed.accessToken, renewed.refreshToken);

  // 4. Revalidar con nuevo token
  try {
    const { data } = await insforge.auth.getCurrentUser();
    if (data?.user?.id) return data.user;
  } catch { /* ignorar */ }

  const userFromRaw2 = await validateTokenRaw(renewed.accessToken);
  if (userFromRaw2?.id) return userFromRaw2;

  // Último recurso: devolver el userId guardado si es reciente (< 7 días)
  const ageMs = Date.now() - (renewed.savedAt ?? 0);
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (renewed.userId && ageMs < sevenDays) {
    return { id: renewed.userId };
  }

  clearSession();
  return null;
}

// ─── Sesión actual ────────────────────────────────────────────────────────────
export async function getAuthUser(): Promise<{ id: string } | null> {
  try {
    const { data } = await insforge.auth.getCurrentUser();
    if (data?.user?.id) return data.user;
  } catch { /* token expirado */ }
  return restoreSession();
}

// ─── Obtener access token para llamadas server-side ─────────────────────────
export async function getAccessToken(): Promise<string> {
  const stored = loadSession();
  if (stored?.accessToken && stored.accessToken !== "sdk-session") return stored.accessToken;

  try {
    const sessResult = await (insforge.auth as any).getSession?.();
    const token = sessResult?.data?.session?.access_token ?? sessResult?.session?.access_token;
    if (token) return token;
  } catch { /* ignorar */ }

  return "";
}

// ─── Crear usuario (solo admin) ──────────────────────────────────────────────
export async function createUser(params: {
  nombre: string;
  email: string;
  password: string;
  rol: "admin" | "empleado";
  tenant_id: string;
  tarifa_diaria?: number;
}) {
  try {
    const accessToken = await getAccessToken();

    const res = await fetch("/api/admin/create-user", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken && accessToken !== "sdk-session"
          ? { "Authorization": `Bearer ${accessToken}` }
          : {}),
      },
      body: JSON.stringify(params),
    });

    const json = await res.json();
    if (!res.ok || json.error) {
      return { data: null, error: json.error ?? "Error al crear usuario" };
    }
    return { data: json.data as User, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message ?? "Error de red al crear usuario" };
  }
}

// ─── Obtener perfil completo ─────────────────────────────────────────────────
// Intenta primero via SDK. Si falla (anonKey sin sesión, RLS bloqueado),
// usa la ruta server-side con x-api-key que bypassa RLS.
export async function getUserProfile(userId: string): Promise<User | null> {
  // 1. Intentar con el SDK (funciona si el token está correctamente aplicado)
  try {
    const { data, error } = await insforge.database
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    if (!error && data) return data as User;
  } catch { /* SDK sin sesión de usuario → intentar fallback */ }

  // 2. Fallback: API route server-side con x-api-key (bypassa RLS, siempre funciona)
  try {
    const res = await fetch(`/api/auth/profile?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const json = await res.json();
      return json?.data ?? null;
    }
  } catch { /* error de red */ }

  return null;
}

// ─── Cambiar contraseña ──────────────────────────────────────────────────────
export async function updatePassword(_newPassword: string) {
  return { error: "Cambio de contraseña no disponible en esta versión" };
}
