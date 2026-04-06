import { NextRequest, NextResponse } from "next/server";

/**
 * Obtiene el perfil de usuario desde el servidor usando x-api-key.
 *
 * Necesario porque justo después del login el SDK todavía puede tener el
 * anonKey, lo que haría fallar la query por RLS. Con x-api-key el servidor
 * lee directamente sin restricciones de RLS.
 */

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    }

    const res = await fetch(
      `${INSFORGE_URL}/api/database/records/users?id=eq.${userId}&limit=1`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SERVICE_KEY,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: "Error al obtener perfil" }, { status: res.status });
    }

    // InsForge puede devolver array o { data: [...] }
    const records = Array.isArray(data) ? data : (data?.data ?? []);
    const user = records[0] ?? null;

    return NextResponse.json({ data: user });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 });
  }
}
