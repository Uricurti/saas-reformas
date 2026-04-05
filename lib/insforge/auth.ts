import insforge from "./client";
import type { User } from "@/types";

// ─── Persistencia de sesión en localStorage ──────────────────────────────────
// InsForge web usa cookies httpOnly de sesión → desaparecen al cerrar el navegador.
// Con client_type=desktop el refreshToken llega en el body → lo guardamos en
// localStorage y así la sesión sobrevive indefinidamente.
const SESSION_KEY = "insforge_session_v1";

interface StoredSession {
  accessToken:  string;
  refreshToken: string;
  userId:       string;
}

export function saveSession(accessToken: string, refreshToken: string, userId: string) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken, refreshToken, userId }));
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

/** Restaura el accessToken en el cliente de InsForge SDK */
async function applyTokenToClient(accessToken: string) {
  try {
    // InsForge SDK — intentar setSession si existe
    await (insforge.auth as any).setSession?.({ access_token: accessToken });
  } catch { /* método no disponible, el SDK lo gestionará solo */ }
}

/** Refresca el accessToken usando el refreshToken guardado → devuelve nuevo accessToken */
async function refreshTokens(refreshToken: string): Promise<StoredSession | null> {
  try {
    const url = process.env.NEXT_PUBLIC_INSFORGE_URL!;
    const res  = await fetch(`${url}/api/auth/refresh`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newAccess  = data?.accessToken  ?? data?.access_token  ?? "";
    const newRefresh = data?.refreshToken ?? data?.refresh_token ?? refreshToken;
    const userId     = data?.user?.id ?? "";
    if (!newAccess) return null;
    return { accessToken: newAccess, refreshToken: newRefresh, userId };
  } catch { return null; }
}

// ─── Sign In ─────────────────────────────────────────────────────────────────
// Usamos client_type=desktop → refreshToken en el body (no en cookie httpOnly)
// → podemos guardarlo en localStorage para sesiones persistentes.
export async function signIn(email: string, password: string) {
  try {
    const url = process.env.NEXT_PUBLIC_INSFORGE_URL!;
    const res  = await fetch(`${url}/api/auth/sessions?client_type=desktop`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok || data.error || !data.user) {
      // Fallback al SDK estándar si la llamada directa falla
      const fallback = await insforge.auth.signInWithPassword({ email, password });
      return fallback;
    }

    const accessToken  = data.accessToken  ?? data.access_token  ?? "";
    const refreshToken = data.refreshToken ?? data.refresh_token ?? "";
    const userId       = data.user?.id ?? "";

    // Guardar tokens en localStorage
    if (accessToken && refreshToken) {
      saveSession(accessToken, refreshToken, userId);
    }

    // Aplicar token al cliente SDK
    if (accessToken) await applyTokenToClient(accessToken);

    return { data: { user: data.user, session: data }, error: null };
  } catch (e: any) {
    // Fallback al SDK
    const fallback = await insforge.auth.signInWithPassword({ email, password });
    return fallback;
  }
}

// ─── Sign Out ────────────────────────────────────────────────────────────────
export async function signOut() {
  clearSession();
  const { error } = await insforge.auth.signOut();
  return { error };
}

// ─── Restaurar sesión desde localStorage (llamar al inicio de la app) ────────
export async function restoreSession(): Promise<{ id: string } | null> {
  const stored = loadSession();
  if (!stored) return null;

  // Aplicar accessToken al SDK primero (puede que aún sea válido)
  await applyTokenToClient(stored.accessToken);

  // Intentar obtener usuario con el token actual
  try {
    const { data } = await insforge.auth.getCurrentUser();
    if (data?.user?.id) return data.user;
  } catch { /* token expirado, intentar refresh */ }

  // Token expirado → refrescar con el refreshToken guardado
  const renewed = await refreshTokens(stored.refreshToken);
  if (!renewed) {
    clearSession(); // refresh también falló → eliminar sesión guardada
    return null;
  }

  // Guardar nuevos tokens y aplicar
  saveSession(renewed.accessToken, renewed.refreshToken, renewed.userId);
  await applyTokenToClient(renewed.accessToken);

  // Obtener usuario con nuevo token
  try {
    const { data } = await insforge.auth.getCurrentUser();
    if (data?.user?.id) return data.user;
  } catch { /* ignorar */ }

  return renewed.userId ? { id: renewed.userId } : null;
}

// ─── Sesión actual ────────────────────────────────────────────────────────────
export async function getAuthUser(): Promise<{ id: string } | null> {
  // Primero intentar con el SDK (token en memoria)
  try {
    const { data } = await insforge.auth.getCurrentUser();
    if (data?.user?.id) return data.user;
  } catch { /* token expirado */ }

  // Si falla, intentar restaurar desde localStorage
  return restoreSession();
}

// ─── Obtener access token para llamadas server-side ─────────────────────────
export async function getAccessToken(): Promise<string> {
  // Desde localStorage
  const stored = loadSession();
  if (stored?.accessToken) return stored.accessToken;

  // Desde el SDK (sesión en memoria)
  try {
    const sessionResult = await (insforge.auth as any).getSession?.();
    const token = sessionResult?.data?.session?.access_token;
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
        ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
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
export async function getUserProfile(userId: string): Promise<User | null> {
  const { data, error } = await insforge.database
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as User;
}

// ─── Cambiar contraseña ──────────────────────────────────────────────────────
export async function updatePassword(_newPassword: string) {
  return { error: "Cambio de contraseña no disponible en esta versión" };
}
