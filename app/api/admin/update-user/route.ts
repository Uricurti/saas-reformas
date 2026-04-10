/**
 * API Route: editar usuario (admin only)
 *
 * InsForge NO tiene endpoint admin para cambiar email/contraseña de otro usuario.
 * Solo existe PATCH /api/auth/profiles/current (el propio usuario).
 *
 * Lo que SÍ podemos hacer como admin:
 *   - Actualizar nombre + email en la tabla `users` → se propaga en toda la app
 *
 * Para cambiar el email o contraseña de acceso, el empleado debe hacerlo
 * desde su propio perfil (o el admin lo resetea desde el panel de InsForge).
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, nombre, email, password, emailActual } = body;

    if (!userId || !nombre || !email) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }
    if (!SERVICE_KEY) {
      return NextResponse.json({ error: "INSFORGE_SERVICE_KEY no configurado" }, { status: 500 });
    }

    // ── Actualizar nombre + email en la tabla users ────────────────────────
    // Esto se propaga en calendarios, fichajes, jornales y toda la app.
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
      const msg = d?.message ?? d?.error ?? `HTTP ${profileRes.status}`;
      return NextResponse.json({ error: "Error al guardar el perfil: " + msg }, { status: 400 });
    }

    // Si intentó cambiar email o contraseña, avisar que eso requiere acción del empleado
    const cambioEmail    = emailActual && email.toLowerCase() !== emailActual.toLowerCase();
    const cambioPassword = !!password;

    if (cambioEmail || cambioPassword) {
      return NextResponse.json({
        error: null,
        warning: "Nombre actualizado correctamente. Para cambiar el email o contraseña de acceso, el empleado debe actualizarlo desde su propio perfil.",
      });
    }

    return NextResponse.json({ error: null });

  } catch (err: any) {
    console.error("[update-user] error:", err);
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 });
  }
}
