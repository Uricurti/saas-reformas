import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy server-side para refrescar el access token de InsForge.
 *
 * El navegador NO puede llamar al endpoint de InsForge directamente porque:
 * - La cookie httpOnly de refresh tiene SameSite restrictions (cross-origin bloqueado)
 * - InsForge exige X-CSRF-Token para llamadas desde el browser
 *
 * Desde el servidor (Node.js) no hay cookies ni CSRF → InsForge permite
 * pasar el refreshToken en el body directamente.
 */
export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();
    if (!refreshToken) {
      return NextResponse.json({ error: "refreshToken requerido" }, { status: 400 });
    }

    const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!;

    const res = await fetch(`${insforgeUrl}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Sin cookies, sin CSRF → InsForge lo trata como cliente servidor/móvil
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.message ?? "Error al refrescar sesión" }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 });
  }
}
