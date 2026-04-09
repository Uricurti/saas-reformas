/**
 * GET /api/cron/daily-notifications
 * Vercel Cron: se ejecuta a las 18:00 UTC (~19:00-20:00 hora España).
 * Combina dos tareas en un único cron para respetar el límite del plan Hobby (2 crons):
 *   1. Recordatorio de fichaje → empleados con obra hoy que no han fichado
 *   2. Obra de mañana → empleados con asignación para mañana
 */
import { NextRequest, NextResponse } from "next/server";
import { sendEmailFichajeReminder, sendEmailObraManana } from "@/lib/resend";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;
const CRON_SECRET  = process.env.CRON_SECRET;

function isoHoy(): string {
  return new Date().toISOString().split("T")[0];
}
function isoManana(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
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
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hoy    = isoHoy();
  const manana = isoManana();
  const stats  = { fichaje: { enviados: 0, errores: 0 }, manana: { enviados: 0, errores: 0 } };

  // ── Tenants con alguna notificación activa ────────────────────────────────
  const configs = await dbQuery(
    `/api/database/records/notificacion_config?select=tenant_id,notif_fichaje,notif_obra_manana`
  );

  for (const config of configs) {
    const { tenant_id: tenantId, notif_fichaje, notif_obra_manana } = config;

    // ── 1. Recordatorio de fichaje ──────────────────────────────────────────
    if (notif_fichaje) {
      const asignacionesHoy = await dbQuery(
        `/api/database/records/asignaciones?tenant_id=eq.${tenantId}&fecha_inicio=lte.${hoy}&select=user_id,obra_id`
        + `&or=(fecha_fin.is.null,fecha_fin.gte.${hoy})`
      );

      for (const asig of asignacionesHoy) {
        const jornadas = await dbQuery(
          `/api/database/records/jornadas?user_id=eq.${asig.user_id}&fecha=eq.${hoy}&ha_fichado=eq.true&select=id`
        );
        if (jornadas.length > 0) continue;

        const usuarios = await dbQuery(
          `/api/database/records/users?id=eq.${asig.user_id}&activo=eq.true&select=nombre,email`
        );
        const empleado = usuarios[0];
        if (!empleado?.email) continue;

        let obraNombre: string | undefined;
        if (asig.obra_id) {
          const obras = await dbQuery(`/api/database/records/obras?id=eq.${asig.obra_id}&select=nombre`);
          obraNombre = obras[0]?.nombre;
        }

        try {
          await sendEmailFichajeReminder({ to: empleado.email, nombre: empleado.nombre, obraNombre });
          stats.fichaje.enviados++;
        } catch { stats.fichaje.errores++; }
      }
    }

    // ── 2. Obra de mañana ───────────────────────────────────────────────────
    if (notif_obra_manana) {
      const asignacionesManana = await dbQuery(
        `/api/database/records/asignaciones?tenant_id=eq.${tenantId}&fecha_inicio=lte.${manana}&es_libre=eq.false&select=user_id,obra_id,hora_inicio`
        + `&or=(fecha_fin.is.null,fecha_fin.gte.${manana})`
      );

      for (const asig of asignacionesManana) {
        if (!asig.obra_id) continue;

        const usuarios = await dbQuery(
          `/api/database/records/users?id=eq.${asig.user_id}&activo=eq.true&select=nombre,email`
        );
        const empleado = usuarios[0];
        if (!empleado?.email) continue;

        const obras = await dbQuery(`/api/database/records/obras?id=eq.${asig.obra_id}&select=nombre,direccion`);
        const obra  = obras[0];
        if (!obra?.nombre) continue;

        try {
          await sendEmailObraManana({
            to: empleado.email, nombre: empleado.nombre,
            obraNombre: obra.nombre, obraDireccion: obra.direccion ?? "",
            horaInicio: asig.hora_inicio ?? undefined,
          });
          stats.manana.enviados++;
        } catch { stats.manana.errores++; }
      }
    }
  }

  return NextResponse.json({ ok: true, hoy, manana, stats });
}
