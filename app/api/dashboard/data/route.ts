/**
 * GET /api/dashboard/data?tenantId=xxx
 * Agrega todos los datos necesarios para el dashboard del admin usando SERVICE_KEY.
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

async function db(path: string): Promise<any[]> {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const d = await res.json();
  return Array.isArray(d) ? d : [];
}

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });

  const hoy     = new Date().toISOString().split("T")[0];
  const hace48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  // ── Primera ronda de queries en paralelo ──────────────────────────────────
  const [
    asignaciones,
    jornadasHoy,
    obrasActivas,
    pagos,
    jornadasFichadas,
    materiales,
    archivos,
  ] = await Promise.all([
    db(`/api/database/records/asignaciones?tenant_id=eq.${tenantId}&fecha_inicio=lte.${hoy}&select=user_id,obra_id,es_libre,created_at&or=(fecha_fin.is.null,fecha_fin.gte.${hoy})&order=created_at.desc`),
    db(`/api/database/records/jornadas?tenant_id=eq.${tenantId}&fecha=eq.${hoy}&select=id,user_id,ha_fichado,fichado_at,estado`),
    db(`/api/database/records/obras?tenant_id=eq.${tenantId}&estado=in.(activa,pausada)&select=id`),
    db(`/api/database/records/pagos?tenant_id=eq.${tenantId}&estado=in.(pendiente_emitir,emitida)&fecha_prevista=not.is.null&select=id,importe_total,fecha_prevista,estado,obra_id,factura_id&order=fecha_prevista.asc`),
    db(`/api/database/records/jornadas?tenant_id=eq.${tenantId}&ha_fichado=eq.true&fichado_at=gte.${hace48h}&select=user_id,obra_id,fichado_at&order=fichado_at.desc&limit=15`),
    db(`/api/database/records/materiales?tenant_id=eq.${tenantId}&created_at=gte.${hace48h}&select=id,descripcion,cantidad,unidad,obra_id,solicitado_por,estado,created_at,comprado_at&order=created_at.desc&limit=15`),
    db(`/api/database/records/archivos?tenant_id=eq.${tenantId}&created_at=gte.${hace48h}&select=id,tipo,obra_id,user_id,created_at&order=created_at.desc&limit=15`),
  ]);

  // Deduplica asignaciones por user_id (la más reciente = mayor prioridad)
  const asigByUser: Record<string, any> = {};
  for (const a of asignaciones) {
    if (a.es_libre === true) continue;
    if (!asigByUser[a.user_id]) asigByUser[a.user_id] = a;
  }
  const userIds     = Object.keys(asigByUser);
  const obraIdsAsig = Array.from(new Set(Object.values(asigByUser).map((a: any) => a.obra_id).filter(Boolean))) as string[];

  // Recoge todos los IDs de users y obras necesarios
  const allUserIds = Array.from(new Set([
    ...userIds,
    ...jornadasFichadas.map((j: any) => j.user_id),
    ...materiales.map((m: any) => m.solicitado_por),
    ...archivos.map((a: any) => a.user_id),
  ].filter(Boolean))) as string[];

  const allObraIds = Array.from(new Set([
    ...obraIdsAsig,
    ...jornadasFichadas.map((j: any) => j.obra_id),
    ...materiales.map((m: any) => m.obra_id),
    ...archivos.map((a: any) => a.obra_id),
    ...pagos.map((p: any) => p.obra_id),
  ].filter(Boolean))) as string[];

  const facturaIds = Array.from(new Set(pagos.map((p: any) => p.factura_id).filter(Boolean))) as string[];

  // ── Segunda ronda de queries en paralelo ──────────────────────────────────
  const [allUsers, allObras, allFacturas] = await Promise.all([
    allUserIds.length > 0
      ? db(`/api/database/records/users?id=in.(${allUserIds.join(",")})&select=id,nombre`)
      : Promise.resolve([]),
    allObraIds.length > 0
      ? db(`/api/database/records/obras?id=in.(${allObraIds.join(",")})&select=id,nombre`)
      : Promise.resolve([]),
    facturaIds.length > 0
      ? db(`/api/database/records/facturas?id=in.(${facturaIds.join(",")})&select=id,concepto`)
      : Promise.resolve([]),
  ]);

  const userMap:    Record<string, string> = Object.fromEntries(allUsers.map((u: any) => [u.id, u.nombre]));
  const obraMap:    Record<string, string> = Object.fromEntries(allObras.map((o: any) => [o.id, o.nombre]));
  const facturaMap: Record<string, string> = Object.fromEntries(allFacturas.map((f: any) => [f.id, f.concepto]));
  const jornadaByUser: Record<string, any> = Object.fromEntries(jornadasHoy.map((j: any) => [j.user_id, j]));

  // ── Sección 1: Fichaje de hoy ─────────────────────────────────────────────
  const fichajeHoy = Object.entries(asigByUser)
    .map(([userId, asig]: [string, any]) => {
      const nombre = userMap[userId];
      if (!nombre) return null;
      const jornada = jornadaByUser[userId];
      return {
        user_id:    userId,
        nombre,
        obra_nombre: obraMap[asig.obra_id] ?? null,
        obra_id:     asig.obra_id ?? null,
        ha_fichado:  jornada?.ha_fichado ?? false,
        fichado_at:  jornada?.fichado_at ?? null,
        jornada_id:  jornada?.id ?? null,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      // Sin fichar primero, luego alfabético
      if (a.ha_fichado !== b.ha_fichado) return a.ha_fichado ? 1 : -1;
      return a.nombre.localeCompare(b.nombre, "es");
    });

  // ── Sección 2: Alertas de cobro ───────────────────────────────────────────
  const hoyMs = new Date(hoy).getTime();
  const alertas = pagos
    .map((p: any) => {
      const diffDias = Math.round((new Date(p.fecha_prevista).getTime() - hoyMs) / 86400000);
      if (diffDias > 7) return null; // Solo alertas urgentes (7 días o vencidas)
      return {
        id:           p.id,
        obra_nombre:  obraMap[p.obra_id]      ?? "Obra",
        concepto:     facturaMap[p.factura_id] ?? "",
        importe_total: p.importe_total,
        fecha_prevista: p.fecha_prevista,
        estado:       p.estado,
        dias_diff:    diffDias,
      };
    })
    .filter(Boolean);

  // ── Sección 4: Actividad reciente ─────────────────────────────────────────
  const actividad: any[] = [];

  // Fichajes
  for (const j of jornadasFichadas) {
    if (!j.fichado_at) continue;
    actividad.push({
      id:          `f-${j.user_id}-${j.fichado_at}`,
      tipo:        "fichaje",
      user_nombre: userMap[j.user_id] ?? "Empleado",
      obra_nombre: obraMap[j.obra_id] ?? null,
      descripcion: `fichó a las ${new Date(j.fichado_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`,
      created_at:  j.fichado_at,
    });
  }

  // Materiales pedidos y comprados
  for (const m of materiales) {
    if (m.estado === "pendiente") {
      actividad.push({
        id:          `mp-${m.id}`,
        tipo:        "material_pedido",
        user_nombre: userMap[m.solicitado_por] ?? "Empleado",
        obra_nombre: obraMap[m.obra_id] ?? null,
        descripcion: `pidió ${m.cantidad} ${m.unidad} de ${m.descripcion}`,
        created_at:  m.created_at,
      });
    } else if (m.estado === "comprado" && m.comprado_at && new Date(m.comprado_at) >= new Date(hace48h)) {
      actividad.push({
        id:          `mc-${m.id}`,
        tipo:        "material_comprado",
        user_nombre: userMap[m.solicitado_por] ?? "—",
        obra_nombre: obraMap[m.obra_id] ?? null,
        descripcion: `marcó comprado: ${m.descripcion}`,
        created_at:  m.comprado_at,
      });
    }
  }

  // Archivos — agrupados por user+obra+tipo para no repetir
  const archivoGroups: Record<string, { count: number; tipo: string; obra_id: string; user_id: string; created_at: string }> = {};
  for (const a of archivos) {
    const key = `${a.user_id}-${a.obra_id}-${a.tipo}`;
    if (!archivoGroups[key]) {
      archivoGroups[key] = { count: 0, tipo: a.tipo, obra_id: a.obra_id, user_id: a.user_id, created_at: a.created_at };
    }
    archivoGroups[key].count++;
  }
  for (const [key, g] of Object.entries(archivoGroups)) {
    const tipoLabel = g.tipo === "video"
      ? `vídeo${g.count > 1 ? "s" : ""}`
      : `foto${g.count > 1 ? "s" : ""}`;
    actividad.push({
      id:          `ar-${key}`,
      tipo:        "foto",
      user_nombre: userMap[g.user_id] ?? "Empleado",
      obra_nombre: obraMap[g.obra_id] ?? null,
      descripcion: `subió ${g.count} ${tipoLabel}`,
      created_at:  g.created_at,
    });
  }

  actividad.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({
    hoy,
    fichajeHoy,
    obras:    { total: obrasActivas.length, empleados_hoy: userIds.length },
    alertas,
    actividad: actividad.slice(0, 20),
  });
}
