import { NextRequest, NextResponse } from "next/server";
import insforge from "@/lib/insforge/client";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isoHoy() {
  return new Date().toISOString().split("T")[0];
}
function addDias(d: string, dias: number) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + dias);
  return dt.toISOString().split("T")[0];
}

// ─── POST /api/facturacion/check-pagos ───────────────────────────────────────
// Llamado por Vercel Cron cada día a las 9:00h
// También se puede llamar manualmente para pruebas
export async function POST(req: NextRequest) {
  // Verificar CRON_SECRET si existe
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const hoy   = isoHoy();
  const en7d  = addDias(hoy, 7);

  // 1. Leer todos los pagos pendientes/emitidos con fecha_prevista definida
  const { data: pagos, error } = await insforge.database
    .from("pagos")
    .select("id, tenant_id, factura_id, obra_id, concepto, importe_total, fecha_prevista, estado")
    .in("estado", ["pendiente_emitir", "emitida"])
    .not("fecha_prevista", "is", null)
    .lte("fecha_prevista", en7d);   // solo los que vencen en los próximos 7 días o ya vencieron

  if (error) {
    console.error("[check-pagos] Error leyendo pagos:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pagos || pagos.length === 0) {
    return NextResponse.json({ procesados: 0, notificaciones_creadas: 0 });
  }

  // 2. Para cada tenant, buscar el/los admins
  const tenantIds = Array.from(new Set(pagos.map((p: any) => p.tenant_id))) as string[];
  const { data: admins } = await insforge.database
    .from("users")
    .select("id, tenant_id")
    .in("tenant_id", tenantIds)
    .eq("rol", "admin");

  const adminsPorTenant: Record<string, string[]> = {};
  for (const a of (admins ?? []) as { id: string; tenant_id: string }[]) {
    if (!adminsPorTenant[a.tenant_id]) adminsPorTenant[a.tenant_id] = [];
    adminsPorTenant[a.tenant_id].push(a.id);
  }

  // 3. Obtener notificaciones ya creadas hoy (para evitar duplicados)
  const { data: notifsHoy } = await insforge.database
    .from("notificaciones")
    .select("mensaje, user_id, tipo")
    .gte("created_at", hoy + "T00:00:00")
    .lte("created_at", hoy + "T23:59:59")
    .in("tipo", ["pago_proximo", "pago_vencido"]);

  const clavesExistentes = new Set<string>();
  for (const n of (notifsHoy ?? []) as { mensaje: string; user_id: string; tipo: string }[]) {
    // Clave única: tipo + user_id + pago_id (buscamos el pago_id en el mensaje)
    clavesExistentes.add(`${n.tipo}:${n.user_id}:${n.mensaje}`);
  }

  // 4. Crear notificaciones
  let creadas = 0;
  const nuevasNotifs: object[] = [];

  for (const pago of pagos as any[]) {
    const adminIds = adminsPorTenant[pago.tenant_id] ?? [];
    const vencido = pago.fecha_prevista < hoy;
    const tipo = vencido ? "pago_vencido" : "pago_proximo";
    const diasDiff = Math.abs(
      Math.floor((new Date(pago.fecha_prevista).getTime() - new Date(hoy).getTime()) / 86400000)
    );

    // Obtener nombre de la obra
    const { data: obraRow } = await insforge.database
      .from("obras").select("nombre").eq("id", pago.obra_id).single();
    const obraNombre = (obraRow as any)?.nombre ?? "Obra desconocida";

    const titulo = vencido
      ? `💳 Pago vencido — ${obraNombre}`
      : `⏰ Pago próximo — ${obraNombre}`;
    const mensaje = vencido
      ? `El pago "${pago.concepto}" de ${Number(pago.importe_total).toLocaleString("es-ES")} € venció hace ${diasDiff}d (ID: ${pago.id})`
      : `El pago "${pago.concepto}" de ${Number(pago.importe_total).toLocaleString("es-ES")} € vence en ${diasDiff}d (ID: ${pago.id})`;

    for (const adminId of adminIds) {
      const clave = `${tipo}:${adminId}:${mensaje}`;
      if (clavesExistentes.has(clave)) continue; // ya creada hoy

      nuevasNotifs.push({
        user_id: adminId,
        tenant_id: pago.tenant_id,
        titulo,
        mensaje,
        tipo,
        leida: false,
      });
      clavesExistentes.add(clave);
      creadas++;
    }
  }

  if (nuevasNotifs.length > 0) {
    const { error: insertErr } = await insforge.database
      .from("notificaciones")
      .insert(nuevasNotifs);
    if (insertErr) {
      console.error("[check-pagos] Error insertando notificaciones:", insertErr);
    }
  }

  return NextResponse.json({
    procesados: pagos.length,
    notificaciones_creadas: creadas,
    fecha: hoy,
  });
}

// GET también acepta llamadas del cron de Vercel (que envía GET)
export async function GET(req: NextRequest) {
  return POST(req);
}
