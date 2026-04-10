import insforge from "./client";
import type { User } from "@/types";

// ─── Persistencia de sesión en localStorage ──────────────────────────────────
// InsForge access token dura 15 min. El refresh token dura 7 días.
// Guardamos ambos en localStorage para restaurar la sesión al abrir el navegador.
const SESSION_KEY = "insforge_session_v1";

interface StoredSession {
  accessToken:  string;
  refreshToken: string;
  userId:       string;
  savedAt:      number;
}

export function saveSession(accessToken: string, refreshToken: string, userId: string) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken, refreshToken, userId, savedAt: Date.now() }));
  } catch { /* incognito / storage bloqueado */ }
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch { return null; }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { }
}

// ─── Refrescar access token via proxy servidor ───────────────────────────────
// El endpoint de InsForge requiere cookie httpOnly + CSRF desde el browser.
// Nuestra API route lo llama server-side, sin esas restricciones.
async function refreshTokens(refreshToken: string): Promise<StoredSession | null> {
  if (!refreshToken) return null;
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
    const userId     = data?.user?.id     ?? data?.userId        ?? "";
    if (!newAccess) return null;
    return { accessToken: newAccess, refreshToken: newRefresh, userId, savedAt: Date.now() };
  } catch { return null; }
}

// ─── Sign In ─────────────────────────────────────────────────────────────────
export async function signIn(email: string, password: string) {
  const url = process.env.NEXT_PUBLIC_INSFORGE_URL!;

  // Resolver email_auth: el usuario puede escribir su email real (display),
  // pero InsForge autentica siempre con el email_auth fijo.
  let authEmail = email.toLowerCase().trim();
  try {
    const lookup = await fetch("/api/auth/lookup-email", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email: authEmail }),
    });
    if (lookup.ok) {
      const { emailAuth } = await lookup.json();
      if (emailAuth) authEmail = emailAuth;
    }
  } catch { /* fallback: usar el email introducido */ }

  // Intentar login directo → devuelve accessToken + refreshToken en el body
  try {
    const res  = await fetch(`${url}/api/auth/sessions`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email: authEmail, password }),
    });
    const data = await res.json();

    if (res.ok && !data.error && data.user) {
      const accessToken  = data.accessToken  ?? data.access_token  ?? "";
      const refreshToken = data.refreshToken ?? data.refresh_token ?? "";
      const userId       = data.user?.id ?? "";
      if (accessToken) saveSession(accessToken, refreshToken, userId);
      return { data: { user: data.user, session: data }, error: null };
    }
  } catch { /* continuar con SDK */ }

  // Fallback: SDK estándar (guarda sesión en cookie httpOnly)
  const fallback = await insforge.auth.signInWithPassword({ email: authEmail, password });
  if (fallback.data?.user) {
    // Intentar extraer tokens del SDK por si los expone
    try {
      const sess = (await (insforge.auth as any).getSession?.())?.data?.session;
      const at   = sess?.access_token  ?? "";
      const rt   = sess?.refresh_token ?? "";
      if (at) saveSession(at, rt, fallback.data.user.id);
    } catch { }
  }
  return fallback;
}

// ─── Sign Out ────────────────────────────────────────────────────────────────
export async function signOut() {
  clearSession();
  try { await insforge.auth.signOut(); } catch { }
  return { error: null };
}

// ─── Restaurar sesión al abrir la app ────────────────────────────────────────
export async function restoreSession(): Promise<{ id: string } | null> {
  const stored = loadSession();
  if (!stored?.accessToken || !stored?.userId) return null;

  // Comprobar si el access token ha expirado leyendo el campo exp del JWT
  try {
    const payload = JSON.parse(atob(stored.accessToken.split(".")[1]));
    const expired = payload.exp && payload.exp < Math.floor(Date.now() / 1000);

    if (!expired) {
      // Token válido → devolver userId directamente (sin llamada de red)
      return { id: stored.userId };
    }
  } catch { /* JWT malformado → intentar refresh */ }

  // Token expirado → refrescar via proxy servidor
  const renewed = await refreshTokens(stored.refreshToken);
  if (!renewed) {
    clearSession();
    return null;
  }

  saveSession(renewed.accessToken, renewed.refreshToken, renewed.userId);
  return { id: renewed.userId };
}

// ─── Obtener access token (para llamadas autenticadas) ───────────────────────
export async function getAccessToken(): Promise<string> {
  const stored = loadSession();
  return stored?.accessToken ?? "";
}

// ─── Obtener perfil completo ─────────────────────────────────────────────────
// RLS desactivado → el SDK puede leer sin restricciones
export async function getUserProfile(userId: string): Promise<User | null> {
  try {
    const { data, error } = await insforge.database
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    if (!error && data) return data as User;
  } catch { }

  // Fallback server-side por si el SDK falla por razones de red o token
  try {
    const res = await fetch(`/api/auth/profile?userId=${encodeURIComponent(userId)}`);
    if (res.ok) return (await res.json())?.data ?? null;
  } catch { }

  return null;
}

// ─── Crear usuario (solo admin) ──────────────────────────────────────────────
export async function createUser(params: {
  nombre:        string;
  email:         string;
  password:      string;
  rol:           "admin" | "empleado";
  tenant_id:     string;
  tarifa_diaria?: number;
}) {
  try {
    const res = await fetch("/api/admin/create-user", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(params),
    });
    const json = await res.json();
    if (!res.ok || json.error) return { data: null, error: json.error ?? "Error al crear usuario" };
    return { data: json.data as User, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message ?? "Error de red" };
  }
}

// ─── Cambiar contraseña ──────────────────────────────────────────────────────
export async function updatePassword(_newPassword: string) {
  return { error: "Cambio de contraseña no disponible en esta versión" };
}

// ─── getAuthUser (compatibilidad) ────────────────────────────────────────────
export async function getAuthUser(): Promise<{ id: string } | null> {
  return restoreSession();
}
