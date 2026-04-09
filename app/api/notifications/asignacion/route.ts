/**
 * POST /api/notifications/asignacion
 * Envía email al empleado cuando se le asigna una obra.
 * Llamado desde el cliente tras crear/actualizar una asignación.
 */
import { NextRequest, NextResponse } from "next/server";
import { sendEmailAsignacion } from "@/lib/resend";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

async function dbQuery(path: string): Promise<any[]> {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId, userId, obraId, fechaInicio, fechaFin, horaInicio } = await req.json();
    if (!tenantId || !userId || !obraId || !fechaInicio) {
      return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
    }

    // Comprobar si las notificaciones de asignación están activas
    const configs = await dbQuery(`/api/database/records/notificacion_config?tenant_id=eq.${tenantId}&select=notif_asignacion`);
    const notifActiva = configs.length === 0 ? true : configs[0]?.notif_asignacion !== false;
    if (!notifActiva) return NextResponse.json({ skipped: true });

    // Obtener datos del empleado y la obra en paralelo
    const [usuarios, obras] = await Promise.all([
      dbQuery(`/api/database/records/users?id=eq.${userId}&select=nombre,email`),
      dbQuery(`/api/database/records/obras?id=eq.${obraId}&select=nombre,direccion`),
    ]);

    const empleado = usuarios[0];
    const obra     = obras[0];

    if (!empleado?.email || !obra?.nombre) {
      return NextResponse.json({ error: "No se encontraron datos de empleado u obra" }, { status: 400 });
    }

    await sendEmailAsignacion({
      to:            empleado.email,
      nombre:        empleado.nombre,
      obraNombre:    obra.nombre,
      obraDireccion: obra.direccion ?? "",
      fechaInicio,
      fechaFin:      fechaFin   ?? undefined,
      horaInicio:    horaInicio ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[notif/asignacion]", err);
    return NextResponse.json({ error: err?.message ?? "Error" }, { status: 500 });
  }
}
