/**
 * GET /api/dashboard/data?tenantId=xxx
 * Agrega todos los datos para el dashboard del admin (SERVICE_KEY, sin RLS).
 *
 * 2 rondas (antes eran 3):
 *  R1 — todo lo que solo necesita tenantId (obras incluye nombre para evitar R3)
 *  R2 — asignaciones + facturas en paralelo (necesita user_ids y factura_ids de R1)
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

function uniq(arr: (string | null | undefined)[]): string[] {
  return Array.from(new Set(arr.filter(Boolean))) as string[];
}

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId requerido" }, { status: 400 });

  const hoy     = new Date().toISOString().split("T")[0];
  const hace48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  // ── Ronda 1: todo lo que solo necesita tenantId ───────────────────────────
  const [
    tenantUsers,
    jornadasHoy,
    obrasActivas,
    pagos,
    jornadasFichadas,
    materiales,
    archivos,
  ] = await Promise.all([
    db(`/api/database/records/users?tenant_id=eq.${tenantId}&activo=eq.true&select=id,nombre`),
    db(`/api/database/records/jornadas?tenant_id=eq.${tenantId}&fecha=eq.${hoy}&select=id,user_id,ha_fichado,fichado_at,estado,obra_id,es_libre`),
    db(`/api/database/records/obras?tenant_id=eq.${tenantId}&estado=in.(activa,pausada)&select=id,nombre`),
    db(`/api/database/records/pagos?tenant_id=eq.${tenantId}&estado=in.(pendiente_emitir,emitida)&fecha_prevista=not.is.null&select=id,importe_total,fecha_prevista,estado,obra_id,factura_id&order=fecha_prevista.asc`),
    db(`/api/database/records/jornadas?tenant_id=eq.${tenantId}&ha_fichado=eq.true&fichado_at=gte.${hace48h}&select=user_id,obra_id,fichado_at,fichado_por&order=fichado_at.desc&limit=20`),
    db(`/api/database/records/materiales?tenant_id=eq.${tenantId}&created_at=gte.${hace48h}&select=id,descripcion,cantidad,unidad,obra_id,solicitado_por,estado,created_at,comprado_at&order=created_at.desc&limit=20`),
    db(`/api/database/records/archivos?tenant_id=eq.${tenantId}&created_at=gte.${hace48h}&select=id,tipo,obra_id,user_id,created_at&order=created_at.desc&limit=20`),
  ]);

  const tenantUserIds  = tenantUsers.map((u: any) => u.id as string);
  const allFacturaIds  = uniq(pagos.map((p: any) => p.factura_id));

  // ── Ronda 2: asignaciones + facturas en paralelo ──────────────────────────
  // (asignaciones no tiene tenant_id fiable, usamos user_id IN (...))
  const [asignaciones, allFacturas] = await Promise.all([
    tenantUserIds.length > 0
      ? db(
          `/api/database/records/asignaciones` +
          `?select=user_id,obra_id,es_libre,created_at` +
          `&user_id=in.(${tenantUserIds.join(",")})` +
          `&fecha_inicio=lte.${hoy}` +
          `&or=(fecha_fin.is.null,fecha_fin.gte.${hoy})` +
          `&order=created_at.desc`
        )
      : Promise.resolve([]),
    allFacturaIds.length > 0
      ? db(`/api/database/records/facturas?id=in.(${allFacturaIds.join(",")})&select=id,concepto`)
      : Promise.resolve([]),
  ]);

  // Deduplica asignaciones por user_id (más reciente = prioridad)
  const asigByUser: Record<string, any> = {};
  for (const a of asignaciones) {
    if (a.es_libre === true || !a.obra_id) continue;
    if (!asigByUser[a.user_id]) asigByUser[a.user_id] = a;
  }

  // obras ya vienen de R1 con nombre incluido → no hay ronda 3
  const allObras = obrasActivas; // obrasActivas ya tiene id + nombre

  // ── Mapas de lookup ────────────────────────────────────────────────────────
  const userMap:    Record<string, string> = Object.fromEntries(tenantUsers.map((u: any) => [u.id, u.nombre]));
  const obraMap:    Record<string, string> = Object.fromEntries(allObras.map((o: any) => [o.id, o.nombre]));
  const facturaMap: Record<string, string> = Object.fromEntries(allFacturas.map((f: any) => [f.id, f.concepto]));
  const jornadaByUser: Record<string, any> = Object.fromEntries(jornadasHoy.map((j: any) => [j.user_id, j]));

  // ── Sección 1: Fichaje de hoy ─────────────────────────────────────────────
  // Solo mostramos empleados con jornada creada HOY (igual que el calendario).
  // Las asignaciones activas sin jornada de hoy NO se muestran — el admin
  // no ha planificado ese empleado para hoy.
  const fichajeUserIds = jornadasHoy
    .map((j: any) => j.user_id)
    .filter((uid: string) => tenantUserIds.includes(uid));

  const fichajeHoy = fichajeUserIds
    .map((userId: string) => {
      const nombre = userMap[userId];
      if (!nombre) return null;
      const jornada = jornadaByUser[userId];
      const asig    = asigByUser[userId];
      // La jornada tiene la obra real del día (la fuente de verdad)
      // Si no hay jornada todavía, usamos la asignación
      const esLibre = jornada?.es_libre ?? false;
      const obraId  = esLibre ? null : (jornada?.obra_id ?? asig?.obra_id ?? null);
      return {
        user_id:     userId,
        nombre,
        es_libre:    esLibre,
        obra_nombre: esLibre ? null : (obraId ? (obraMap[obraId] ?? null) : null),
        obra_id:     obraId,
        ha_fichado:  jornada?.ha_fichado ?? false,
        fichado_at:  jornada?.fichado_at ?? null,
        jornada_id:  jornada?.id ?? null,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      // 1) Libres siempre al final
      if (a.es_libre !== b.es_libre) return a.es_libre ? 1 : -1;
      // 2) Fichados antes que los que no han fichado
      if (a.ha_fichado !== b.ha_fichado) return a.ha_fichado ? -1 : 1;
      // 3) Entre fichados: orden cronológico (el primero en fichar, arriba)
      if (a.fichado_at && b.fichado_at)
        return new Date(a.fichado_at).getTime() - new Date(b.fichado_at).getTime();
      // 4) Sin fichar: alfabético
      return a.nombre.localeCompare(b.nombre, "es");
    });

  // ── Sección 2: Alertas de cobro ───────────────────────────────────────────
  const hoyMs = new Date(hoy).getTime();
  const alertas = pagos
    .map((p: any) => {
      const diffDias = Math.round((new Date(p.fecha_prevista).getTime() - hoyMs) / 86400000);
      if (diffDias > 7) return null;
      return {
        id:            p.id,
        obra_nombre:   obraMap[p.obra_id]       ?? "Obra",
        concepto:      facturaMap[p.factura_id]  ?? "",
        importe_total: p.importe_total,
        fecha_prevista: p.fecha_prevista,
        estado:        p.estado,
        dias_diff:     diffDias,
      };
    })
    .filter(Boolean);

  // ── Sección 4: Actividad reciente ─────────────────────────────────────────
  const actividad: any[] = [];

  for (const j of jornadasFichadas) {
    if (!j.fichado_at) continue;
    const hora = new Date(j.fichado_at).toLocaleTimeString("es-ES", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid",
    });
    // fichado_por distinto al propio empleado → lo fichó el admin
    const fichadoPorAdmin = j.fichado_por && j.fichado_por !== j.user_id;
    const empNombre   = userMap[j.user_id]      ?? "Empleado";
    const adminNombre = fichadoPorAdmin ? (userMap[j.fichado_por] ?? "Admin") : null;
    actividad.push({
      id:          `f-${j.user_id}-${j.fichado_at}`,
      tipo:        "fichaje",
      // Admin ficha: sujeto = admin → "Oriol fichó a Alan a las 09:15"
      // Empleado ficha: sujeto = empleado → "Alan fichó a las 09:15"
      user_nombre: fichadoPorAdmin ? "Admin" : empNombre,
      obra_nombre: obraMap[j.obra_id] ?? null,
      descripcion: fichadoPorAdmin
        ? `fichó a ${empNombre} a las ${hora}`
        : `fichó a las ${hora}`,
      created_at: j.fichado_at,
    });
  }

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

  const archivoGroups: Record<string, any> = {};
  for (const a of archivos) {
    const key = `${a.user_id}-${a.obra_id}-${a.tipo}`;
    if (!archivoGroups[key]) {
      archivoGroups[key] = { count: 0, tipo: a.tipo, obra_id: a.obra_id, user_id: a.user_id, created_at: a.created_at };
    }
    archivoGroups[key].count++;
  }
  for (const [, g] of Object.entries(archivoGroups) as any) {
    const tipoLabel = g.tipo === "video" ? `vídeo${g.count > 1 ? "s" : ""}` : `foto${g.count > 1 ? "s" : ""}`;
    actividad.push({
      id:          `ar-${g.user_id}-${g.obra_id}-${g.tipo}`,
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
    obras:     { total: obrasActivas.length, empleados_hoy: fichajeUserIds.length },
    alertas,
    actividad: actividad.slice(0, 30),
  });
}
