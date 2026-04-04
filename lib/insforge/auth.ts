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
export async function createUser(params: {
  nombre: string;
  email: string;
  password: string;
  rol: "admin" | "empleado";
  tenant_id: string;
  tarifa_diaria?: number;
}) {
  // 1. Crear la cuenta de autenticación en InsForge
  const { data: authData, error: authError } = await insforge.auth.signUp({
    email: params.email,
    password: params.password,
    name: params.nombre,
  });

  if (authError || !authData?.user) {
    return { data: null, error: authError || "Error al crear el usuario" };
  }

  const userId = authData.user.id;

  // 2. Insertar el perfil en nuestra tabla users
  const { data: profileData, error: profileError } = await insforge.database
    .from("users")
    .insert({
      id: userId,
      tenant_id: params.tenant_id,
      nombre: params.nombre,
      email: params.email,
      rol: params.rol,
      activo: true,
    })
    .select()
    .single();

  if (profileError) {
    return { data: null, error: profileError.message };
  }

  // 3. Si es empleado y tiene tarifa, guardarla
  if (params.rol === "empleado" && params.tarifa_diaria) {
    await insforge.database.from("tarifas_empleado").insert({
      user_id: userId,
      tenant_id: params.tenant_id,
      tarifa_diaria: params.tarifa_diaria,
      fecha_desde: new Date().toISOString().split("T")[0],
    });
  }

  return { data: profileData as User, error: null };
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
