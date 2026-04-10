/**
 * El usuario actualiza su nombre y/o email de display.
 * - email_auth (el email fijo de InsForge) NUNCA cambia.
 * - email (display) puede cambiarse libremente; el login lo resuelve vía /api/auth/lookup-email.
 * - Contraseña: gestionada aparte mediante el flujo de reset de InsForge.
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, nombre, email } = body;

    if (!userId || !nombre || !email) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Comprobar que el nuevo email no lo usa ya otro usuario
    const checkRes = await fetch(
      `${INSFORGE_URL}/api/database/records/users?email=eq.${encodeURIComponent(email.toLowerCase().trim())}&select=id&limit=1`,
      { headers: { "x-api-key": SERVICE_KEY }, cache: "no-store" }
    );
    if (checkRes.ok) {
      const rows = await checkRes.json();
      if (rows?.length > 0 && rows[0].id !== userId) {
        return NextResponse.json({ error: "Ese email ya está en uso por otro usuario." }, { status: 400 });
      }
    }

    // Actualizar nombre + email de display (email_auth no se toca)
    const res = await fetch(
      `${INSFORGE_URL}/api/database/records/users?id=eq.${userId}`,
      {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
        body:    JSON.stringify({ nombre: nombre.trim(), email: email.toLowerCase().trim() }),
        cache:   "no-store",
      }
    );

    if (!res.ok) {
      let d: any = null;
      try { d = await res.json(); } catch { }
      return NextResponse.json(
        { error: "Error al guardar: " + (d?.message ?? d?.error ?? `HTTP ${res.status}`) },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 });
  }
}
