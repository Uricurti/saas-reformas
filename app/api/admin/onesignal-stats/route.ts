/**
 * GET /api/admin/onesignal-stats
 * Consulta OneSignal para obtener número de suscriptores push activos.
 */
import { NextResponse } from "next/server";

const APP_ID  = "a4ab2ceb-c143-4844-9408-6ff33c985786";
const API_KEY = process.env.ONESIGNAL_API_KEY!;

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ total: 0, activos: 0, error: "API key no configurada" });
  }

  try {
    const res = await fetch(
      `https://onesignal.com/api/v1/apps/${APP_ID}`,
      { headers: { Authorization: `Basic ${API_KEY}` } }
    );
    if (!res.ok) return NextResponse.json({ total: 0, activos: 0 });
    const data = await res.json();

    return NextResponse.json({
      total:   data.players            ?? 0,  // total suscriptores
      activos: data.messageable_players ?? 0,  // suscriptores con push activo
    });
  } catch {
    return NextResponse.json({ total: 0, activos: 0 });
  }
}
