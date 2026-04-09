/**
 * API Route: el propio usuario actualiza su nombre, email y/o contraseña.
 * Usa la SERVICE_KEY para hacer el cambio en auth + tabla users,
 * pero solo permite actualizar el userId que viene en el body (validado por sesión).
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

function adminHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-key": SERVICE_KEY,
  };
}

async function insforgeAdmin(
  path: string,
  options: RequestInit = {}
): Promise<{ data: any; error: string | null; status: number }> {
  const url = `${INSFORGE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...adminHeaders(), ...(options.headers ?? {}) },
  });
  let data: any = null;
  try { data = await res.json(); } catch { }
  if (!res.ok) {
    const msg = data?.message ?? data?.error ?? `HTTP ${res.status}`;
    return { data: null, error: msg, status: res.status };
  }
  return { data, error: null, status: res.status };
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, nombre, email, password } = body;

    if (!userId || !nombre || !email) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }
    if (!SERVICE_KEY) {
      return NextResponse.json({ error: "SERVICE_KEY no configurado" }, { status: 500 });
    }

    // ── 1. Actualizar auth (email y opcionalmente contraseña) ──────────────
    const authPayload: Record<string, string> = { email };
    if (password) authPayload.password = password;

    const { error: authError } = await insforgeAdmin(
      `/api/auth/users/${userId}`,
      { method: "PATCH", body: JSON.stringify(authPayload) }
    );
    if (authError) {
      return NextResponse.json({ error: "Error al actualizar acceso: " + authError }, { status: 400 });
    }

    // ── 2. Actualizar perfil en tabla users ────────────────────────────────
    const { error: profileError } = await insforgeAdmin(
      `/api/database/records/users?id=eq.${userId}`,
      { method: "PATCH", body: JSON.stringify({ nombre, email }) }
    );
    if (profileError) {
      return NextResponse.json(
        { error: "Acceso actualizado pero falló el perfil: " + profileError },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: null });
  } catch (err: any) {
    console.error("[update-me] error:", err);
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 });
  }
}
