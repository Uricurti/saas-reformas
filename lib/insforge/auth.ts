import insforge from "./client";
import type { User } from "@/types";

// ─── Sign In ────────────────────────────────────────────────────────────────
export async function signIn(email: string, password: string) {
  const { data, error } = await insforge.auth.signInWithPassword({ email, password });
  return { data, error };
}

// ─── Sign Out ───────────────────────────────────────────────────────────────
export async function signOut() {
  const { error } = await insforge.auth.signOut();
  return { error };
}

// ─── Sesión actual ───────────────────────────────────────────────────────────
/**
 * Devuelve el usuario autenticado: primero prueba la sesión en memoria,
 * si no hay (tras recarga de página), usa la cookie httpOnly para refrescar.
 * Necesario usar getCurrentUser() en vez de getSession() que solo es in-memory.
 */
export async function getAuthUser(): Promise<{ id: string } | null> {
  const { data } = await insforge.auth.getCurrentUser();
  return data?.user ?? null;
}

// ─── Crear usuario (solo admin) ──────────────────────────────────────────────
// Usa una API Route server-side con service key para no afectar la sesión del admin
export async function createUser(params: {
  nombre: string;
  email: string;
  password: string;
  rol: "admin" | "empleado";
  tenant_id: string;
  tarifa_diaria?: number;
}) {
  try {
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

// ─── Obtener perfil completo desde nuestra tabla users ──────────────────────
export async function getUserProfile(userId: string): Promise<User | null> {
  const { data, error } = await insforge.database
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data as User;
}

// ─── Cambiar contraseña del usuario actual ──────────────────────────────────
export async function updatePassword(_newPassword: string) {
  // Funcionalidad no implementada en el MVP — se puede añadir en Fase 2
  return { error: "Cambio de contraseña no disponible en esta versión" };
}
