/**
 * GET /api/cron/fichaje-reminder
 * Vercel Cron: se ejecuta a las 19:00 UTC (~20:00-21:00 hora España).
 * Envía recordatorio a los empleados que tienen obra hoy y no han fichado.
 */
import { NextRequest, NextResponse } from "next/server";
import { sendEmailFichajeReminder } from "@/lib/resend";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;
const CRON_SECRET  = process.env.CRON_SECRET;

function isoHoy(): string {
  return new Date().toISOString().split("T")[0];
}

async function dbQuery(path: string): Promise<any[]> {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function GET(req: NextRequest) {
  // Seguridad: solo Vercel cron o token válido
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hoy = isoHoy();
  let enviados = 0;
  let errores  = 0;

  try {
    // Tenants con notif_fichaje activa
    const configs = await dbQuery(
      `/api/database/records/notificacion_config?notif_fichaje=eq.true&select=tenant_id`
    );

    for (const config of configs) {
      const tenantId = config.tenant_id;

      // Empleados con asignación activa hoy
      const asignaciones = await dbQuery(
        `/api/database/records/asignaciones?tenant_id=eq.${tenantId}&fecha_inicio=lte.${hoy}&select=user_id,obra_id,hora_inicio`
        + `&or=(fecha_fin.is.null,fecha_fin.gte.${hoy})`
      );

      for (const asig of asignaciones) {
        // Comprobar si ya fichó hoy
        const jornadas = await dbQuery(
          `/api/database/records/jornadas?user_id=eq.${asig.user_id}&fecha=eq.${hoy}&ha_fichado=eq.true&select=id`
        );
        if (jornadas.length > 0) continue; // Ya fichó

        // Obtener email y nombre del empleado
        const usuarios = await dbQuery(
          `/api/database/records/users?id=eq.${asig.user_id}&activo=eq.true&select=nombre,email`
        );
        const empleado = usuarios[0];
        if (!empleado?.email) continue;

        // Obtener nombre de la obra
        let obraNombre: string | undefined;
        if (asig.obra_id) {
          const obras = await dbQuery(
            `/api/database/records/obras?id=eq.${asig.obra_id}&select=nombre`
          );
          obraNombre = obras[0]?.nombre;
        }

        try {
          await sendEmailFichajeReminder({
            to:         empleado.email,
            nombre:     empleado.nombre,
            obraNombre,
          });
          enviados++;
        } catch (e) {
          console.error("[cron/fichaje-reminder] Error enviando a", empleado.email, e);
          errores++;
        }
      }
    }

    return NextResponse.json({ ok: true, enviados, errores, fecha: hoy });
  } catch (err: any) {
    console.error("[cron/fichaje-reminder]", err);
    return NextResponse.json({ error: err?.message ?? "Error" }, { status: 500 });
  }
}
