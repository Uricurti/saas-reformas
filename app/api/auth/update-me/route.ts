/**
 * API Route: el propio usuario actualiza su nombre, email y/o contraseña.
 * Usa PATCH /api/auth/profiles/current con el token del propio usuario.
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, nombre, email, password, emailActual, accessToken } = body;

    if (!userId || !nombre || !email) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const cambioCredenciales = password || (emailActual && email.toLowerCase() !== emailActual.toLowerCase());

    // ── 1. Actualizar credenciales auth (solo si cambia email o contraseña) ──
    // InsForge: PATCH /api/auth/profiles/current con el token del propio usuario
    let authWarning: string | null = null;
    if (cambioCredenciales && accessToken) {
      const authPayload: Record<string, string> = {};
      if (email !== emailActual) authPayload.email = email;
      if (password) authPayload.password = password;

      const authRes = await fetch(`${INSFORGE_URL}/api/auth/profiles/current`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(authPayload),
        cache: "no-store",
      });

      if (!authRes.ok) {
        let d: any = null;
        try { d = await authRes.json(); } catch { }
        authWarning = d?.message ?? d?.error ?? `HTTP ${authRes.status}`;
      }
    }

    // ── 2. Actualizar nombre + email en tabla users (siempre) ──────────────
    const profileRes = await fetch(
      `${INSFORGE_URL}/api/database/records/users?id=eq.${userId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
        body: JSON.stringify({ nombre, email }),
        cache: "no-store",
      }
    );

    if (!profileRes.ok) {
      let d: any = null;
      try { d = await profileRes.json(); } catch { }
      return NextResponse.json(
        { error: "Error al guardar el perfil: " + (d?.message ?? d?.error ?? `HTTP ${profileRes.status}`) },
        { status: 400 }
      );
    }

    if (authWarning) {
      return NextResponse.json({
        error: null,
        warning: `Nombre actualizado. No se pudo cambiar el acceso: ${authWarning}`,
      });
    }

    return NextResponse.json({ error: null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 });
  }
}
