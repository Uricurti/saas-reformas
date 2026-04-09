/**
 * GET /api/cron/obra-manana
 * Vercel Cron: se ejecuta a las 17:00 UTC (~18:00-19:00 hora España).
 * Envía a cada empleado los detalles de su obra para mañana.
 */
import { NextRequest, NextResponse } from "next/server";
import { sendEmailObraManana } from "@/lib/resend";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;
const CRON_SECRET  = process.env.CRON_SECRET;

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

  const manana = isoManana();
  let enviados = 0;
  let errores  = 0;

  try {
    // Tenants con notif_obra_manana activa
    const configs = await dbQuery(
      `/api/database/records/notificacion_config?notif_obra_manana=eq.true&select=tenant_id`
    );

    for (const config of configs) {
      const tenantId = config.tenant_id;

      // Asignaciones activas para mañana (con obra_id, no días libres)
      const asignaciones = await dbQuery(
        `/api/database/records/asignaciones?tenant_id=eq.${tenantId}&fecha_inicio=lte.${manana}&es_libre=eq.false&select=user_id,obra_id,hora_inicio`
        + `&or=(fecha_fin.is.null,fecha_fin.gte.${manana})`
      );

      for (const asig of asignaciones) {
        if (!asig.obra_id) continue;

        // Empleado
        const usuarios = await dbQuery(
          `/api/database/records/users?id=eq.${asig.user_id}&activo=eq.true&select=nombre,email`
        );
        const empleado = usuarios[0];
        if (!empleado?.email) continue;

        // Obra
        const obras = await dbQuery(
          `/api/database/records/obras?id=eq.${asig.obra_id}&select=nombre,direccion`
        );
        const obra = obras[0];
        if (!obra?.nombre) continue;

        try {
          await sendEmailObraManana({
            to:            empleado.email,
            nombre:        empleado.nombre,
            obraNombre:    obra.nombre,
            obraDireccion: obra.direccion ?? "",
            horaInicio:    asig.hora_inicio ?? undefined,
          });
          enviados++;
        } catch (e) {
          console.error("[cron/obra-manana] Error enviando a", empleado.email, e);
          errores++;
        }
      }
    }

    return NextResponse.json({ ok: true, enviados, errores, fecha: manana });
  } catch (err: any) {
    console.error("[cron/obra-manana]", err);
    return NextResponse.json({ error: err?.message ?? "Error" }, { status: 500 });
  }
}
