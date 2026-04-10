/**
 * Reset de contraseña en tres pasos:
 *   POST { step:"send",    email }                         → envía código al Gmail
 *   POST { step:"verify",  email, code }                   → devuelve token
 *   POST { step:"confirm", email, token, newPassword }     → aplica nueva contraseña
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

/** Resuelve el email_auth a partir del email de display */
async function resolveAuthEmail(displayEmail: string): Promise<string | null> {
  const res = await fetch(
    `${INSFORGE_URL}/api/database/records/users?email=eq.${encodeURIComponent(displayEmail.toLowerCase().trim())}&select=email_auth&limit=1`,
    { headers: { "x-api-key": SERVICE_KEY }, cache: "no-store" }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.email_auth ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { step, email, code, token, newPassword } = body;

    if (!step || !email) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    // Resolver email_auth (ahora = Gmail real tras la migración)
    const emailAuth = await resolveAuthEmail(email);
    if (!emailAuth) {
      return NextResponse.json({ error: "No existe ninguna cuenta con ese email." }, { status: 404 });
    }

    // ── PASO 1: Enviar código ───────────────────────────────────────────────
    if (step === "send") {
      const res = await fetch(`${INSFORGE_URL}/api/auth/email/send-reset-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
        body:    JSON.stringify({ email: emailAuth }),
        cache:   "no-store",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return NextResponse.json({ error: d?.message ?? "Error al enviar el código." }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    // ── PASO 2: Verificar código → obtener token ───────────────────────────
    if (step === "verify") {
      if (!code) return NextResponse.json({ error: "Introduce el código." }, { status: 400 });
      const res = await fetch(`${INSFORGE_URL}/api/auth/email/exchange-reset-password-token`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
        body:    JSON.stringify({ email: emailAuth, code }),
        cache:   "no-store",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json({ error: d?.message ?? "Código incorrecto o expirado." }, { status: 400 });
      }
      const resetToken = d?.token ?? d?.otp ?? null;
      if (!resetToken) return NextResponse.json({ error: "No se obtuvo el token de reset." }, { status: 400 });
      return NextResponse.json({ ok: true, token: resetToken });
    }

    // ── PASO 3: Aplicar nueva contraseña ───────────────────────────────────
    if (step === "confirm") {
      if (!token || !newPassword) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
      if (newPassword.length < 6)  return NextResponse.json({ error: "Mínimo 6 caracteres." }, { status: 400 });
      const res = await fetch(`${INSFORGE_URL}/api/auth/email/reset-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
        body:    JSON.stringify({ newPassword, otp: token }),
        cache:   "no-store",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return NextResponse.json({ error: d?.message ?? "No se pudo cambiar la contraseña." }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Paso desconocido." }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 });
  }
}
