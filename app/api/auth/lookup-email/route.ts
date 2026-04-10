/**
 * Dado un email de display (el que el usuario ve y puede cambiar),
 * devuelve el email_auth (el email fijo de InsForge usado para autenticar).
 * Llamado server-side desde el login para resolver el email real de auth.
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ emailAuth: null });

    const res = await fetch(
      `${INSFORGE_URL}/api/database/records/users?email=eq.${encodeURIComponent(email.toLowerCase().trim())}&select=email_auth&limit=1`,
      { headers: { "x-api-key": SERVICE_KEY }, cache: "no-store" }
    );

    if (!res.ok) return NextResponse.json({ emailAuth: null });

    const rows = await res.json();
    const emailAuth = rows?.[0]?.email_auth ?? null;
    return NextResponse.json({ emailAuth });
  } catch {
    return NextResponse.json({ emailAuth: null });
  }
}
