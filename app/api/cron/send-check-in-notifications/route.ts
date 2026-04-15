/**
 * POST /api/cron/send-check-in-notifications
 * Cron diario a las 9am (Europa/Madrid).
 * Envía notificación push a empleados que tienen jornada HOY y aún no han fichado.
 * Autenticado con CRON_SECRET (Vercel lo pasa automáticamente).
 */
import { NextRequest, NextResponse } from "next/server";

const ONESIGNAL_APP_ID  = "a4ab2ceb-c143-4844-9408-6ff33c985786";
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY!;
const INSFORGE_URL      = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY       = process.env.INSFORGE_SERVICE_KEY!;

async function db(path: string): Promise<any[]> {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const d = await res.json();
  return Array.isArray(d) ? d : [];
}

export async function POST(req: NextRequest) {
  // Verificar que viene de Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Hora actual en Madrid (para saber la fecha de hoy correcta)
    const hoy = new Date()
      .toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }); // "2025-04-15"

    // 1️⃣ Empleados con jornada HOY que no han fichado aún
    const jornadas = await db(
      `/api/database/records/jornadas?fecha=eq.${hoy}&ha_fichado=eq.false&select=user_id`
    );

    if (jornadas.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Todos han fichado o no hay jornadas hoy",
        enviadas: 0,
      });
    }

    const userIds = Array.from(new Set(jornadas.map((j: any) => j.user_id as string)));

    // 2️⃣ Enviar notificación push vía OneSignal API
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        // Filtrar por tag user_id que asignamos al hacer login
        filters: userIds.flatMap((id: string, i: number) => [
          ...(i > 0 ? [{ operator: "OR" }] : []),
          { field: "tag", key: "user_id", relation: "=", value: id },
        ]),
        headings: { es: "Recuerda fichar tu asistencia" },
        contents: { es: "¿Ya estás en la obra? Abre la app para fichar." },
        url: "https://saas-reformas.vercel.app",
        chrome_web_icon: "https://saas-reformas.vercel.app/icons/icon-192.png",
        // Solo web (no mobile apps)
        isChrome: true,
        isFirefox: true,
        isSafari: true,
      }),
    });

    const result = await response.json();

    console.log("OneSignal response:", JSON.stringify(result));

    return NextResponse.json({
      success: true,
      empleados_sin_fichar: userIds.length,
      enviadas: result.recipients ?? 0,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Error en cron send-check-in-notifications:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: String(error) },
      { status: 500 }
    );
  }
}
