import { NextResponse } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

function headers() {
  return { "Content-Type": "application/json", "x-api-key": SERVICE_KEY };
}

async function dbGet(path: string) {
  const res = await fetch(`${INSFORGE_URL}/api/database/records${path}`, { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function dbUpsert(body: object) {
  const res = await fetch(`${INSFORGE_URL}/api/database/records/jornadas?on_conflict=user_id,fecha`, {
    method: "POST",
    headers: { ...headers(), "Prefer": "resolution=ignore-duplicates" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

function diasEnRango(fechaInicio: string, fechaFin: string): string[] {
  const dias: string[] = [];
  const inicio = new Date(fechaInicio + "T12:00:00Z");
  const fin    = new Date(fechaFin    + "T12:00:00Z");
  const cur    = new Date(inicio);
  while (cur <= fin) {
    dias.push(cur.toISOString().split("T")[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dias;
}

export async function POST() {
  try {
    if (!SERVICE_KEY) {
      return NextResponse.json({ error: "INSFORGE_SERVICE_KEY not configured" }, { status: 500 });
    }

    // 1. Leer todas las asignaciones
    const asignaciones = await dbGet("/asignaciones?limit=5000&order=created_at.asc");

    // 2. Leer usuarios para obtener tenant_id
    const users = await dbGet("/users?limit=1000");
    const userMap: Record<string, string> = {};
    for (const u of users) userMap[u.id] = u.tenant_id;

    // 3. Leer obras para obtener tenant_id como fallback
    const obras = await dbGet("/obras?limit=1000");
    const obraMap: Record<string, string> = {};
    for (const o of obras) obraMap[o.id] = o.tenant_id;

    // 4. Leer jornadas existentes para no duplicar
    const jornadasExistentes = await dbGet("/jornadas?limit=10000");
    const jornadaSet = new Set<string>();
    for (const j of jornadasExistentes) jornadaSet.add(`${j.user_id}_${j.fecha}`);

    const hoy = new Date().toISOString().split("T")[0];
    // Expandir hasta máx 90 días en el futuro para no crear miles de registros
    const maxFecha = new Date();
    maxFecha.setDate(maxFecha.getDate() + 90);
    const maxFechaStr = maxFecha.toISOString().split("T")[0];

    let creadas = 0;
    let saltadas = 0;
    let errores = 0;

    for (const asig of asignaciones) {
      const fechaInicio = asig.fecha_inicio;
      // Si no hay fecha_fin, usamos hoy (no creamos jornadas futuras sin fecha_fin definida)
      const fechaFin = asig.fecha_fin
        ? (asig.fecha_fin < maxFechaStr ? asig.fecha_fin : maxFechaStr)
        : hoy;

      if (!fechaInicio || fechaInicio > maxFechaStr) continue;

      const tenantId = userMap[asig.user_id] ?? obraMap[asig.obra_id] ?? null;
      if (!tenantId) { errores++; continue; }

      const dias = diasEnRango(fechaInicio, fechaFin);

      for (const fecha of dias) {
        const key = `${asig.user_id}_${fecha}`;
        if (jornadaSet.has(key)) { saltadas++; continue; }

        const ok = await dbUpsert({
          tenant_id:  tenantId,
          user_id:    asig.user_id,
          obra_id:    asig.obra_id ?? null,
          fecha,
          estado:     "trabajando",
          es_libre:   false,
          ha_fichado: false,
          nota:       asig.nota ?? null,
          hora_inicio: asig.hora_inicio ?? null,
          created_at: asig.created_at,
          updated_at: new Date().toISOString(),
        });

        if (ok) {
          creadas++;
          jornadaSet.add(key); // evitar duplicar en el mismo bucle
        } else {
          errores++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      asignaciones_procesadas: asignaciones.length,
      jornadas_creadas: creadas,
      jornadas_saltadas: saltadas,
      errores,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
