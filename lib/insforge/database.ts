import insforge from "./client";
import { isoDate } from "@/lib/utils";
import type {
  Obra, ObraFormData, Asignacion, Fichaje, FichajeEstado,
  Material, MaterialFormData, Archivo, TarifaEmpleado,
  Notificacion, User, Documento, DocumentoCategoria, Jornada,
  Factura, Pago, FacturaConPagos, PagoConContexto, PagoEstado
} from "@/types";

// ══════════════════════════════════════════════════════════════════
// OBRAS
// ══════════════════════════════════════════════════════════════════

export async function getObrasActivas(tenantId: string) {
  return insforge.database
    .from("obras")
    .select(`*, asignaciones(*, user:users(*))`)
    .eq("tenant_id", tenantId)
    .in("estado", ["activa", "pausada"])
    .order("created_at", { ascending: false });
}

export async function getObraById(id: string) {
  return insforge.database
    .from("obras")
    .select(`*, asignaciones(*, user:users(*))`)
    .eq("id", id)
    .single();
}

export async function getObrasArchivadas(tenantId: string) {
  return insforge.database
    .from("obras")
    .select(`*, asignaciones(*, user:users(*))`)
    .eq("tenant_id", tenantId)
    .eq("estado", "archivada")
    .order("created_at", { ascending: false });
}

export async function createObra(tenantId: string, createdBy: string, data: ObraFormData) {
  return insforge.database
    .from("obras")
    .insert({ ...data, tenant_id: tenantId, created_by: createdBy, estado: "activa" })
    .select()
    .single();
}

export async function updateObra(id: string, data: Partial<ObraFormData>) {
  return insforge.database
    .from("obras")
    .update(data)
    .eq("id", id)
    .select()
    .single();
}

export async function archivarObra(id: string) {
  return insforge.database
    .from("obras")
    .update({ estado: "archivada" })
    .eq("id", id)
    .select()
    .single();
}

// ══════════════════════════════════════════════════════════════════
// ASIGNACIONES
// ══════════════════════════════════════════════════════════════════

export async function getAsignacionesByFecha(tenantId: string, fecha: string) {
  // Asignaciones activas para una fecha (la fecha cae entre inicio y fin)
  // Ordenamos por created_at DESC para que los overrides de un día (más recientes)
  // tengan prioridad sobre asignaciones de rango más antiguas
  return insforge.database
    .from("asignaciones")
    .select(`*, user:users(*), obra:obras(*)`)
    .lte("fecha_inicio", fecha)
    .or(`fecha_fin.is.null,fecha_fin.gte.${fecha}`)
    .order("created_at", { ascending: false });
}

export async function getAsignacionesByUser(userId: string) {
  return insforge.database
    .from("asignaciones")
    .select(`*, obra:obras(*)`)
    .eq("user_id", userId)
    .order("fecha_inicio", { ascending: false });
}

/** Devuelve las obras únicas (activas) en las que el empleado tiene alguna asignación */
export async function getObrasAsignadasByUser(userId: string): Promise<Obra[]> {
  const { data, error } = await insforge.database
    .from("asignaciones")
    .select(`obra:obras(*)`)
    .eq("user_id", userId)
    .not("obra_id", "is", null);

  if (error || !data) return [];

  // Deduplicar por obra.id y filtrar solo obras activas
  const seen = new Set<string>();
  const obras: Obra[] = [];
  for (const row of data as any[]) {
    const obra = row.obra;
    if (obra && obra.id && !seen.has(obra.id) && obra.estado === "activa") {
      seen.add(obra.id);
      obras.push(obra as Obra);
    }
  }
  return obras;
}

export async function getAsignacionHoyByUser(userId: string): Promise<Obra | null> {
  const hoy = isoDate();
  const { data, error } = await insforge.database
    .from("asignaciones")
    .select(`obra:obras(*)`)
    .eq("user_id", userId)
    .lte("fecha_inicio", hoy)
    .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return (data as any).obra as Obra;
}

export async function createAsignacion(
  obraId: string | null, userId: string, fechaInicio: string,
  fechaFin?: string, horaInicio?: string, nota?: string, esLibre?: boolean,
) {
  const payload: Record<string, any> = {
    user_id: userId,
    fecha_inicio: fechaInicio,
    es_libre: esLibre ?? false,
    ...(obraId     ? { obra_id:     obraId }     : {}),
    ...(fechaFin   ? { fecha_fin:   fechaFin }   : {}),
    ...(horaInicio ? { hora_inicio: horaInicio } : {}),
    ...(nota       ? { nota }                    : {}),
  };
  const result = await insforge.database.from("asignaciones").insert(payload).select().single();
  // Si las columnas opcionales no existen aún, reintentar sin ellas
  if ((result as any).error?.code === "PGRST204") {
    const base: Record<string, any> = { user_id: userId, fecha_inicio: fechaInicio, es_libre: esLibre ?? false };
    if (obraId) base.obra_id = obraId;
    if (fechaFin) base.fecha_fin = fechaFin;
    return insforge.database.from("asignaciones").insert(base).select().single();
  }
  return result;
}

export async function updateAsignacion(
  id: string,
  params: { obra_id?: string | null; hora_inicio?: string; nota?: string; fecha_fin?: string; es_libre?: boolean },
) {
  return insforge.database.from("asignaciones").update(params).eq("id", id).select().single();
}

export async function deleteAsignacion(id: string) {
  return insforge.database.from("asignaciones").delete().eq("id", id);
}

// ══════════════════════════════════════════════════════════════════
// FICHAJES
// ══════════════════════════════════════════════════════════════════

export async function getFichajeHoy(userId: string): Promise<Fichaje | null> {
  return getFichajeByFecha(userId, isoDate());
}

export async function getFichajeByFecha(userId: string, fecha: string): Promise<Fichaje | null> {
  const { data, error } = await insforge.database
    .from("fichajes")
    .select("*")
    .eq("user_id", userId)
    .eq("fecha", fecha)
    .maybeSingle();

  if (error || !data) return null;
  return data as Fichaje;
}

export async function getFichajesByFecha(tenantId: string, fecha: string) {
  return insforge.database
    .from("fichajes")
    .select(`*, user:users(*), obra:obras(*)`)
    .eq("tenant_id", tenantId)
    .eq("fecha", fecha)
    .order("hora_registro", { ascending: true });
}

export async function getFichajesByUserMes(userId: string, anio: number, mes: number) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const fin = new Date(anio, mes, 0).toISOString().split("T")[0]; // último día del mes
  return insforge.database
    .from("fichajes")
    .select("*")
    .eq("user_id", userId)
    .gte("fecha", inicio)
    .lte("fecha", fin)
    .order("fecha", { ascending: true });
}

export async function getFichajesByTenantMes(tenantId: string, anio: number, mes: number) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const fin = new Date(anio, mes, 0).toISOString().split("T")[0];
  return insforge.database
    .from("fichajes")
    .select(`*`)
    .eq("tenant_id", tenantId)
    .gte("fecha", inicio)
    .lte("fecha", fin)
    .order("fecha", { ascending: true });
}

export async function registrarFichaje(params: {
  userId: string;
  obraId?: string;            // opcional para ausencias (libre, baja, etc.)
  obraAsignadaId?: string;
  tenantId: string;
  fecha?: string;             // opcional, por defecto hoy
  estado: FichajeEstado;
  esCambioObra?: boolean;
}) {
  const fecha = params.fecha ?? isoDate();
  const payload: Record<string, any> = {
    user_id: params.userId,
    tenant_id: params.tenantId,
    fecha,
    estado: params.estado,
    hora_registro: new Date().toISOString(),
    sincronizado: true,
    es_cambio_obra: params.esCambioObra ?? false,
  };
  if (params.obraId)         payload.obra_id          = params.obraId;
  if (params.obraAsignadaId) payload.obra_asignada_id = params.obraAsignadaId;

  return insforge.database.from("fichajes").insert(payload).select().single();
}

// ══════════════════════════════════════════════════════════════════
// MATERIALES
// ══════════════════════════════════════════════════════════════════

export async function getMaterialesPendientes(tenantId: string) {
  return insforge.database
    .from("materiales")
    .select(`*, obra:obras(*), solicitante:users(*)`)
    .eq("tenant_id", tenantId)
    .eq("estado", "pendiente")
    .order("urgencia", { ascending: false })
    .order("created_at", { ascending: true });
}

export async function getMaterialesByObra(obraId: string) {
  return insforge.database
    .from("materiales")
    .select(`*, solicitante:users(nombre)`)
    .eq("obra_id", obraId)
    .order("created_at", { ascending: false });
}

export async function pedirMaterial(tenantId: string, obraId: string, userId: string, data: MaterialFormData) {
  return insforge.database
    .from("materiales")
    .insert({
      ...data,
      obra_id: obraId,
      tenant_id: tenantId,
      solicitado_por: userId,
      estado: "pendiente",
    })
    .select()
    .single();
}

export async function marcarMaterialComprado(id: string) {
  return insforge.database
    .from("materiales")
    .update({ estado: "comprado", comprado_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
}

export async function marcarMaterialesComprados(ids: string[]) {
  return insforge.database
    .from("materiales")
    .update({ estado: "comprado", comprado_at: new Date().toISOString() })
    .in("id", ids)
    .select();
}

export async function deleteMaterial(id: string) {
  return insforge.database.from("materiales").delete().eq("id", id);
}

// ══════════════════════════════════════════════════════════════════
// ARCHIVOS (FOTOS)
// ══════════════════════════════════════════════════════════════════

export async function getArchivosByObra(obraId: string) {
  return insforge.database
    .from("archivos")
    .select(`*, autor:users(nombre)`)
    .eq("obra_id", obraId)
    .order("created_at", { ascending: false });
}

export async function createArchivoRecord(params: {
  obraId: string;
  userId: string;
  tenantId: string;
  tipo: "foto" | "video";
  urlStorage: string;
  urlThumbnail?: string;
  descripcion?: string;
  tamanoByte: number;
}) {
  return insforge.database
    .from("archivos")
    .insert({
      obra_id: params.obraId,
      user_id: params.userId,
      tenant_id: params.tenantId,
      tipo: params.tipo,
      url_storage: params.urlStorage,
      url_thumbnail: params.urlThumbnail,
      descripcion: params.descripcion,
      tamano_bytes: params.tamanoByte,
    })
    .select()
    .single();
}

export async function deleteArchivo(id: string) {
  return insforge.database.from("archivos").delete().eq("id", id);
}

// ══════════════════════════════════════════════════════════════════
// DOCUMENTOS (planos, PDFs, medidas, contratos…)
// ══════════════════════════════════════════════════════════════════

export async function getDocumentosByObra(obraId: string) {
  return insforge.database
    .from("documentos")
    .select(`*, autor:users(nombre)`)
    .eq("obra_id", obraId)
    .order("created_at", { ascending: false });
}

export async function createDocumentoRecord(params: {
  obraId: string;
  userId: string;
  tenantId: string;
  nombre: string;
  categoria: DocumentoCategoria;
  urlStorage: string;
  tamanoByte: number;
  descripcion?: string;
}) {
  return insforge.database
    .from("documentos")
    .insert({
      obra_id: params.obraId,
      user_id: params.userId,
      tenant_id: params.tenantId,
      nombre: params.nombre,
      categoria: params.categoria,
      url_storage: params.urlStorage,
      tamano_bytes: params.tamanoByte,
      descripcion: params.descripcion,
    })
    .select()
    .single();
}

export async function deleteDocumento(id: string) {
  return insforge.database.from("documentos").delete().eq("id", id);
}

// ══════════════════════════════════════════════════════════════════
// TARIFAS y JORNALES (solo admin)
// ══════════════════════════════════════════════════════════════════

export async function getTarifaEmpleado(userId: string): Promise<number> {
  const { data } = await insforge.database
    .from("tarifas_empleado")
    .select("tarifa_diaria")
    .eq("user_id", userId)
    .is("fecha_hasta", null)
    .order("fecha_desde", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as any)?.tarifa_diaria ?? 0;
}

export async function setTarifaEmpleado(userId: string, tenantId: string, tarifaDiaria: number) {
  // Cerrar la tarifa anterior
  const hoy = isoDate();
  await insforge.database
    .from("tarifas_empleado")
    .update({ fecha_hasta: hoy })
    .eq("user_id", userId)
    .is("fecha_hasta", null);

  // Insertar la nueva
  return insforge.database
    .from("tarifas_empleado")
    .insert({ user_id: userId, tenant_id: tenantId, tarifa_diaria: tarifaDiaria, fecha_desde: hoy })
    .select()
    .single();
}

// ══════════════════════════════════════════════════════════════════
// USUARIOS
// ══════════════════════════════════════════════════════════════════

export async function getUsuariosByTenant(tenantId: string) {
  return insforge.database
    .from("users")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("activo", true)
    .order("nombre", { ascending: true });
}

export async function toggleUsuarioActivo(userId: string, activo: boolean) {
  return insforge.database
    .from("users")
    .update({ activo })
    .eq("id", userId)
    .select()
    .single();
}

// ══════════════════════════════════════════════════════════════════
// NOTIFICACIONES
// ══════════════════════════════════════════════════════════════════

export async function getNotificaciones(userId: string, limit = 20) {
  return insforge.database
    .from("notificaciones")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function marcarNotificacionLeida(id: string) {
  return insforge.database
    .from("notificaciones")
    .update({ leida: true })
    .eq("id", id);
}

export async function marcarTodasLeidas(userId: string) {
  return insforge.database
    .from("notificaciones")
    .update({ leida: true })
    .eq("user_id", userId)
    .eq("leida", false);
}

export async function crearNotificacion(params: {
  userId: string;
  tenantId: string;
  titulo: string;
  mensaje: string;
  tipo: string;
}) {
  return insforge.database.from("notificaciones").insert({
    user_id: params.userId,
    tenant_id: params.tenantId,
    titulo: params.titulo,
    mensaje: params.mensaje,
    tipo: params.tipo,
    leida: false,
  });
}

// ══════════════════════════════════════════════════════════════════
// JORNADAS (unifica planning + fichaje en una sola tabla)
// ══════════════════════════════════════════════════════════════════

export async function getJornadasByMes(
  tenantId: string, fechaInicio: string, fechaFin: string
) {
  return insforge.database
    .from("jornadas")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: true });
}

export async function getJornadasByTenantMes(
  tenantId: string, anio: number, mes: number
) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const fin = new Date(anio, mes, 0).toISOString().split("T")[0];
  return insforge.database
    .from("jornadas")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("fecha", inicio)
    .lte("fecha", fin)
    .order("fecha", { ascending: true });
}

export async function getJornadaByFecha(
  userId: string, fecha: string
): Promise<Jornada | null> {
  const { data, error } = await insforge.database
    .from("jornadas")
    .select("*")
    .eq("user_id", userId)
    .eq("fecha", fecha)
    .maybeSingle();
  if (error || !data) return null;
  return data as Jornada;
}

export async function getJornadaHoy(userId: string): Promise<Jornada | null> {
  return getJornadaByFecha(userId, isoDate());
}

export async function upsertJornada(params: {
  userId: string;
  tenantId: string;
  fecha: string;
  estado: FichajeEstado;
  obraId?: string | null;
  esLibre?: boolean;
  haFichado?: boolean;
  horaInicio?: string;
  nota?: string;
}): Promise<{ data: Jornada | null; error: any }> {
  const esLibre = params.esLibre ?? params.estado !== "trabajando";
  const obraId  = esLibre ? null : (params.obraId ?? null);

  const payload: Record<string, any> = {
    user_id:    params.userId,
    tenant_id:  params.tenantId,
    fecha:      params.fecha,
    estado:     params.estado,
    es_libre:   esLibre,
    obra_id:    obraId,
    ha_fichado: params.haFichado ?? false,
    updated_at: new Date().toISOString(),
  };
  if (params.haFichado) payload.fichado_at = new Date().toISOString();
  if (params.horaInicio) payload.hora_inicio = params.horaInicio;
  if (params.nota !== undefined) payload.nota = params.nota;

  const result = await insforge.database
    .from("jornadas")
    .upsert(payload, { onConflict: "user_id,fecha" })
    .select()
    .single();

  // Auto-asignar a la obra si trabaja en ella y aún no está asignado
  if (!esLibre && obraId) {
    ensureAsignacionObra(params.userId, obraId, params.fecha).catch(() => {});
  }

  return result as { data: Jornada | null; error: any };
}

/**
 * Comprueba si el trabajador ya tiene una asignación activa a la obra.
 * Si no la tiene, la crea automáticamente con fecha_inicio = fecha.
 * Se llama en segundo plano (fire-and-forget) desde upsertJornada.
 */
async function ensureAsignacionObra(
  userId: string, obraId: string, fecha: string
): Promise<void> {
  // Buscar asignación activa (sin fecha_fin, o fecha_fin >= fecha de hoy)
  const hoy = isoDate();
  const { data } = await insforge.database
    .from("asignaciones")
    .select("id")
    .eq("user_id", userId)
    .eq("obra_id", obraId)
    .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
    .limit(1)
    .maybeSingle();

  if (data) return; // Ya está asignado, no hacer nada

  // No está asignado → crear asignación desde la fecha indicada (sin fecha_fin = abierta)
  await insforge.database
    .from("asignaciones")
    .insert({ user_id: userId, obra_id: obraId, fecha_inicio: fecha, es_libre: false });
}

export async function deleteJornada(id: string) {
  return insforge.database.from("jornadas").delete().eq("id", id);
}

// ══════════════════════════════════════════════════════════════════
// FACTURACIÓN
// ══════════════════════════════════════════════════════════════════

/** Devuelve todas las facturas de una obra, con sus pagos incluidos */
export async function getFacturasByObra(obraId: string): Promise<FacturaConPagos[]> {
  const { data: facturas, error } = await insforge.database
    .from("facturas")
    .select("*")
    .eq("obra_id", obraId)
    .order("created_at", { ascending: false });

  if (error || !facturas || facturas.length === 0) return [];

  const ids = (facturas as Factura[]).map((f) => f.id);
  const { data: pagos } = await insforge.database
    .from("pagos")
    .select("*")
    .in("factura_id", ids)
    .order("orden", { ascending: true });

  const pagosPorFactura: Record<string, Pago[]> = {};
  for (const p of (pagos ?? []) as Pago[]) {
    if (!pagosPorFactura[p.factura_id]) pagosPorFactura[p.factura_id] = [];
    pagosPorFactura[p.factura_id].push(p);
  }

  return (facturas as Factura[]).map((f) => ({
    ...f,
    pagos: pagosPorFactura[f.id] ?? [],
  }));
}

/** Próximo número de factura global para el tenant (FAC-001, FAC-002…) */
export async function getNextNumeroFactura(tenantId: string): Promise<string> {
  const { data } = await insforge.database
    .from("facturas")
    .select("numero_factura")
    .eq("tenant_id", tenantId)
    .not("numero_factura", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  let maxNum = 0;
  for (const row of (data ?? []) as { numero_factura: string | null }[]) {
    const match = row.numero_factura?.match(/(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `FAC-${String(maxNum + 1).padStart(3, "0")}`;
}

/** Crea una factura y auto-genera los 3 pagos */
export async function createFactura(params: {
  tenantId: string;
  obraId: string;
  concepto: string;
  importeTotal: number;
  numeroFactura: string;
  porcentajeIva?: number;
  fechaEmision?: string | null;
  notas?: string | null;
  pagos: {
    concepto: string;
    porcentaje: number;
    fechaPrevista: string | null;
  }[];
}): Promise<{ factura: Factura | null; error: string | null }> {
  const { data: factura, error } = await insforge.database
    .from("facturas")
    .insert({
      tenant_id: params.tenantId,
      obra_id: params.obraId,
      concepto: params.concepto,
      importe_total: params.importeTotal,
      numero_factura: params.numeroFactura,
      porcentaje_iva: params.porcentajeIva ?? 21,
      fecha_emision: params.fechaEmision ?? null,
      notas: params.notas ?? null,
    })
    .select()
    .single();

  if (error || !factura) return { factura: null, error: (error as any)?.message ?? "Error al crear factura" };

  const f = factura as Factura;
  const pagoRows = params.pagos.map((p, i) => {
    const importe_base = Math.round((params.importeTotal * p.porcentaje) / 100 * 100) / 100;
    return {
      tenant_id: params.tenantId,
      factura_id: f.id,
      obra_id: params.obraId,
      orden: i + 1,
      concepto: p.concepto,
      porcentaje: p.porcentaje,
      importe_base,
      importe_extra: 0,
      importe_total: importe_base,
      fecha_prevista: p.fechaPrevista,
      estado: "pendiente_emitir" as PagoEstado,
    };
  });

  await insforge.database.from("pagos").insert(pagoRows);

  return { factura: f, error: null };
}

/** Actualiza campos de una factura */
export async function updateFactura(id: string, params: Partial<{
  concepto: string;
  importe_total: number;
  numero_factura: string;
  fecha_emision: string | null;
  archivo_url: string | null;
  notas: string | null;
}>) {
  return insforge.database
    .from("facturas")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
}

/** Elimina una factura y sus pagos */
export async function deleteFactura(id: string) {
  await insforge.database.from("pagos").delete().eq("factura_id", id);
  return insforge.database.from("facturas").delete().eq("id", id);
}

/** Actualiza un pago (estado, extras, fecha, nota) */
export async function updatePago(id: string, params: Partial<{
  concepto: string;
  porcentaje: number;
  importe_base: number;
  importe_extra: number;
  fecha_prevista: string | null;
  fecha_cobro: string | null;
  estado: PagoEstado;
  nota: string | null;
  numero_factura_emitida: string | null;
}>) {
  // Recalcular importe_total si cambia alguno de los importes
  const updates: Record<string, unknown> = { ...params };
  if (params.importe_extra !== undefined || params.importe_base !== undefined) {
    // necesitamos leer los valores actuales si solo llega uno
    const { data: current } = await insforge.database
      .from("pagos").select("importe_base, importe_extra").eq("id", id).single();
    const base = params.importe_base ?? (current as any)?.importe_base ?? 0;
    const extra = params.importe_extra ?? (current as any)?.importe_extra ?? 0;
    updates.importe_total = Math.round((base + extra) * 100) / 100;
  }

  return insforge.database
    .from("pagos")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
}

/** Pagos pendientes/emitidos para panel de alertas y cron */
export async function getPagosPendientesYEmitidos(tenantId: string): Promise<PagoConContexto[]> {
  const { data: pagos, error } = await insforge.database
    .from("pagos")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("estado", ["pendiente_emitir", "emitida"])
    .not("fecha_prevista", "is", null)
    .order("fecha_prevista", { ascending: true });

  if (error || !pagos || pagos.length === 0) return [];

  const facturaIds = Array.from(new Set((pagos as Pago[]).map((p) => p.factura_id)));
  const obraIds    = Array.from(new Set((pagos as Pago[]).map((p) => p.obra_id)));

  const [facturasRes, obrasRes] = await Promise.all([
    insforge.database.from("facturas").select("id, concepto, porcentaje_iva").in("id", facturaIds),
    insforge.database.from("obras").select("id, nombre").in("id", obraIds),
  ]);

  const facturaMap: Record<string, string> = {};
  const facturaIvaMap: Record<string, number> = {};
  for (const f of (facturasRes.data ?? []) as { id: string; concepto: string; porcentaje_iva: number }[]) {
    facturaMap[f.id] = f.concepto;
    facturaIvaMap[f.id] = f.porcentaje_iva ?? 21;
  }
  const obraMap: Record<string, string> = {};
  for (const o of (obrasRes.data ?? []) as { id: string; nombre: string }[]) {
    obraMap[o.id] = o.nombre;
  }

  return (pagos as Pago[]).map((p) => {
    const iva = facturaIvaMap[p.factura_id] ?? 21;
    return {
      ...p,
      // importe_total con IVA para que las alertas muestren lo que el cliente debe pagar
      importe_total: Math.round(p.importe_total * (1 + iva / 100) * 100) / 100,
      obra_nombre: obraMap[p.obra_id] ?? "—",
      factura_concepto: facturaMap[p.factura_id] ?? "—",
    };
  });
}

/** Datos del dashboard de facturación */
export async function getFacturacionDashboard(tenantId: string): Promise<{
  totalFacturado: number;
  totalCobrado: number;
  pendiente: number;
  facturadoEsteMes: number;
  facturadoMesAnterior: number;
  porMes: { mes: string; facturado: number; cobrado: number; anioAnterior: number }[];
}> {
  const ahora   = new Date();
  const anio    = ahora.getFullYear();
  const mes     = ahora.getMonth() + 1;

  // Calcular el rango: 12 meses del año actual + los mismos 12 del año anterior
  const inicioAnioActual   = `${anio}-01-01`;
  const finAnioActual      = `${anio}-12-31`;
  const inicioAnioAnterior = `${anio - 1}-01-01`;
  const finAnioAnterior    = `${anio - 1}-12-31`;

  const [pagosActual, pagosAnterior] = await Promise.all([
    insforge.database.from("pagos").select("*")
      .eq("tenant_id", tenantId)
      .gte("created_at", inicioAnioActual)
      .lte("created_at", finAnioActual + "T23:59:59"),
    insforge.database.from("pagos").select("*")
      .eq("tenant_id", tenantId)
      .gte("created_at", inicioAnioAnterior)
      .lte("created_at", finAnioAnterior + "T23:59:59"),
  ]);

  const actual   = (pagosActual.data   ?? []) as Pago[];
  const anterior = (pagosAnterior.data ?? []) as Pago[];

  const totalFacturado = actual.reduce((s, p) => s + p.importe_total, 0);
  const totalCobrado   = actual.filter((p) => p.estado === "cobrada").reduce((s, p) => s + p.importe_total, 0);
  const pendiente      = totalFacturado - totalCobrado;

  const mesStr = (m: number) => String(m).padStart(2, "0");

  const primerDiaMes  = `${anio}-${mesStr(mes)}-01`;
  const ultimoDiaMes  = new Date(anio, mes, 0).getDate();
  const ultimoDiaMesStr = `${anio}-${mesStr(mes)}-${ultimoDiaMes}`;
  const facturadoEsteMes = actual
    .filter((p) => p.created_at >= primerDiaMes && p.created_at <= ultimoDiaMesStr + "T23:59:59")
    .reduce((s, p) => s + p.importe_total, 0);

  const mesPasado = mes === 1 ? 12 : mes - 1;
  const anioMesPasado = mes === 1 ? anio - 1 : anio;
  const primerDiaMesPasado = `${anioMesPasado}-${mesStr(mesPasado)}-01`;
  const ultimoDiaMesPasado = new Date(anioMesPasado, mesPasado, 0).getDate();
  const ultimoDiaMesPasadoStr = `${anioMesPasado}-${mesStr(mesPasado)}-${ultimoDiaMesPasado}`;
  const sourceAnterior = mes === 1 ? anterior : actual;
  const facturadoMesAnterior = sourceAnterior
    .filter((p) => p.created_at >= primerDiaMesPasado && p.created_at <= ultimoDiaMesPasadoStr + "T23:59:59")
    .reduce((s, p) => s + p.importe_total, 0);

  // Construir array de 12 meses del año actual con comparativa
  const porMes = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const mStr = mesStr(m);
    const ini = `${anio}-${mStr}-01`;
    const fin = `${anio}-${mStr}-${new Date(anio, m, 0).getDate()}T23:59:59`;
    const iniAnt = `${anio - 1}-${mStr}-01`;
    const finAnt = `${anio - 1}-${mStr}-${new Date(anio - 1, m, 0).getDate()}T23:59:59`;

    const facturado  = actual.filter((p) => p.created_at >= ini && p.created_at <= fin).reduce((s, p) => s + p.importe_total, 0);
    const cobrado    = actual.filter((p) => p.estado === "cobrada" && p.fecha_cobro && p.fecha_cobro >= ini && p.fecha_cobro <= fin).reduce((s, p) => s + p.importe_total, 0);
    const anioAnterior = anterior.filter((p) => p.created_at >= iniAnt && p.created_at <= finAnt).reduce((s, p) => s + p.importe_total, 0);

    return { mes: mStr, facturado, cobrado, anioAnterior };
  });

  return { totalFacturado, totalCobrado, pendiente, facturadoEsteMes, facturadoMesAnterior, porMes };
}

// ══════════════════════════════════════════════════════════════════
// DASHBOARD FINANZAS COMPLETO (facturación + costes + margen)
// ══════════════════════════════════════════════════════════════════

export interface DashboardFinanzas {
  // Facturación
  totalFacturado: number;
  totalCobrado: number;
  pendienteCobro: number;
  facturadoEsteMes: number;
  facturadoMesAnterior: number;
  // Costes
  costeEmpleados: number;   // jornales del año actual
  costeMateriales: number;  // materiales con precio del año actual
  // Margen
  margenBruto: number;      // facturado - costeEmpleados - costeMateriales
  margenPct: number;        // margenBruto / totalFacturado * 100
  // Series mensuales (12 meses año actual)
  porMes: {
    mes: string; // "01"–"12"
    facturado: number;
    cobrado: number;
    costeEmpleados: number;
    costeMateriales: number;
    margen: number;
    anioAnterior: number;
  }[];
  // Por obra (top activas)
  porObra: {
    obra_id: string;
    obra_nombre: string;
    facturado: number;
    cobrado: number;
    costeEmpleados: number;
    costeMateriales: number;
    margen: number;
  }[];
}

export async function getFinanzasDashboard(tenantId: string): Promise<DashboardFinanzas> {
  const ahora = new Date();
  const anio  = ahora.getFullYear();
  const mes   = ahora.getMonth() + 1;
  const mesStr = (m: number) => String(m).padStart(2, "0");

  const inicioAnio    = `${anio}-01-01`;
  const finAnio       = `${anio}-12-31T23:59:59`;
  const inicioAnioAnt = `${anio - 1}-01-01`;
  const finAnioAnt    = `${anio - 1}-12-31T23:59:59`;

  // ── 1. Pagos del año actual y anterior ──────────────────────────
  const [pagosRes, pagosAntRes, jornadasRes, materialesRes, obrasRes, facturasRes] = await Promise.all([
    insforge.database.from("pagos").select("*")
      .eq("tenant_id", tenantId)
      .gte("created_at", inicioAnio).lte("created_at", finAnio),
    insforge.database.from("pagos").select("*")
      .eq("tenant_id", tenantId)
      .gte("created_at", inicioAnioAnt).lte("created_at", finAnioAnt),
    // Jornadas trabajadas del año actual
    insforge.database.from("jornadas").select("user_id, obra_id, fecha, estado, ha_fichado")
      .eq("tenant_id", tenantId)
      .eq("ha_fichado", true)
      .eq("estado", "trabajando")
      .gte("fecha", inicioAnio).lte("fecha", `${anio}-12-31`),
    // Materiales del año actual con precio
    insforge.database.from("materiales").select("obra_id, precio_unitario, precio_total, cantidad, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", inicioAnio).lte("created_at", finAnio)
      .not("precio_unitario", "is", null),
    insforge.database.from("obras").select("id, nombre").eq("tenant_id", tenantId),
    // IVA por factura para calcular totales con IVA incluido
    insforge.database.from("facturas").select("id, porcentaje_iva").eq("tenant_id", tenantId),
  ]);

  const pagos      = (pagosRes.data     ?? []) as Pago[];
  const pagosAnt   = (pagosAntRes.data  ?? []) as Pago[];
  const jornadas   = (jornadasRes.data  ?? []) as any[];
  const materiales = (materialesRes.data ?? []) as any[];
  const obras      = (obrasRes.data     ?? []) as { id: string; nombre: string }[];
  const obraMap    = Object.fromEntries(obras.map((o) => [o.id, o.nombre]));
  // Mapa factura_id → porcentaje_iva (para calcular totales con IVA)
  const facturaIvaMap: Record<string, number> = {};
  for (const f of ((facturasRes as any).data ?? []) as { id: string; porcentaje_iva: number }[]) {
    facturaIvaMap[f.id] = f.porcentaje_iva ?? 21;
  }
  // Helper: importe del pago multiplicado por (1 + iva/100)
  function conIva(p: Pago) {
    const iva = facturaIvaMap[p.factura_id] ?? 21;
    return p.importe_total * (1 + iva / 100);
  }

  // ── 2. Tarifas empleados ─────────────────────────────────────────
  const userIds = Array.from(new Set(jornadas.map((j: any) => j.user_id)));
  let tarifaMap: Record<string, number> = {};
  if (userIds.length > 0) {
    const { data: tarifas } = await insforge.database
      .from("tarifas_empleado").select("user_id, tarifa_diaria")
      .in("user_id", userIds);
    for (const t of (tarifas ?? []) as any[]) {
      tarifaMap[t.user_id] = parseFloat(t.tarifa_diaria) || 0;
    }
  }

  // ── 3. Calcular coste por jornadda ────────────────────────────────
  function costeJornada(j: any) { return tarifaMap[j.user_id] ?? 0; }
  function costeMaterial(m: any) {
    if (m.precio_total) return parseFloat(m.precio_total) || 0;
    return (parseFloat(m.precio_unitario) || 0) * (parseFloat(m.cantidad) || 0);
  }

  // ── 4. KPIs globales (con IVA incluido) ──────────────────────────
  const totalFacturado    = pagos.reduce((s, p) => s + conIva(p), 0);
  const totalCobrado      = pagos.filter((p) => p.estado === "cobrada").reduce((s, p) => s + conIva(p), 0);
  const pendienteCobro    = totalFacturado - totalCobrado;
  const costeEmpleados    = jornadas.reduce((s: number, j: any) => s + costeJornada(j), 0);
  const costeMateriales   = materiales.reduce((s: number, m: any) => s + costeMaterial(m), 0);
  const margenBruto       = totalFacturado - costeEmpleados - costeMateriales;
  const margenPct         = totalFacturado > 0 ? (margenBruto / totalFacturado) * 100 : 0;

  // Mes actual vs mes anterior (con IVA)
  const primerDiaMes = `${anio}-${mesStr(mes)}-01`;
  const ultimoDiaMes = `${anio}-${mesStr(mes)}-${new Date(anio, mes, 0).getDate()}T23:59:59`;
  const facturadoEsteMes = pagos
    .filter((p) => p.created_at >= primerDiaMes && p.created_at <= ultimoDiaMes)
    .reduce((s, p) => s + conIva(p), 0);
  const mesPasado = mes === 1 ? 12 : mes - 1;
  const anioMesP  = mes === 1 ? anio - 1 : anio;
  const primerMP  = `${anioMesP}-${mesStr(mesPasado)}-01`;
  const ultimoMP  = `${anioMesP}-${mesStr(mesPasado)}-${new Date(anioMesP, mesPasado, 0).getDate()}T23:59:59`;
  const srcAnt    = mes === 1 ? pagosAnt : pagos;
  // Para pagos del año anterior no tenemos el IVA exacto; usamos 21% por defecto
  const facturadoMesAnterior = srcAnt
    .filter((p) => p.created_at >= primerMP && p.created_at <= ultimoMP)
    .reduce((s, p) => s + (mes === 1 ? p.importe_total * 1.21 : conIva(p)), 0);

  // ── 5. Series mensuales ──────────────────────────────────────────
  const porMes = Array.from({ length: 12 }, (_, i) => {
    const m    = i + 1;
    const mS   = mesStr(m);
    const ini  = `${anio}-${mS}-01`;
    const fin  = `${anio}-${mS}-${new Date(anio, m, 0).getDate()}T23:59:59`;
    const iniA = `${anio - 1}-${mS}-01`;
    const finA = `${anio - 1}-${mS}-${new Date(anio - 1, m, 0).getDate()}T23:59:59`;

    // Series con IVA incluido
    const facturado = pagos.filter((p) => p.created_at >= ini && p.created_at <= fin)
      .reduce((s, p) => s + conIva(p), 0);
    const cobrado = pagos.filter((p) => p.estado === "cobrada" && p.fecha_cobro && p.fecha_cobro >= ini.slice(0,7) && p.fecha_cobro <= fin.slice(0,7))
      .reduce((s, p) => s + conIva(p), 0);
    const cemp = jornadas.filter((j: any) => j.fecha >= ini && j.fecha <= fin.slice(0, 10))
      .reduce((s: number, j: any) => s + costeJornada(j), 0);
    const cmat = materiales.filter((m2: any) => m2.created_at >= ini && m2.created_at <= fin)
      .reduce((s: number, m2: any) => s + costeMaterial(m2), 0);
    // Año anterior: sin mapa IVA → usamos 21% por defecto
    const anioAnterior = pagosAnt.filter((p) => p.created_at >= iniA && p.created_at <= finA)
      .reduce((s, p) => s + p.importe_total * 1.21, 0);

    return { mes: mS, facturado, cobrado, costeEmpleados: cemp, costeMateriales: cmat, margen: facturado - cemp - cmat, anioAnterior };
  });

  // ── 6. Por obra (con IVA) ────────────────────────────────────────
  const obraIds = Array.from(new Set([
    ...pagos.map((p) => p.obra_id),
    ...jornadas.map((j: any) => j.obra_id).filter(Boolean),
    ...materiales.map((m: any) => m.obra_id).filter(Boolean),
  ]));

  const porObra = obraIds.map((oid) => {
    const oFact = pagos.filter((p) => p.obra_id === oid).reduce((s, p) => s + conIva(p), 0);
    const oCob  = pagos.filter((p) => p.obra_id === oid && p.estado === "cobrada").reduce((s, p) => s + conIva(p), 0);
    const oCEmp = jornadas.filter((j: any) => j.obra_id === oid).reduce((s: number, j: any) => s + costeJornada(j), 0);
    const oCMat = materiales.filter((m: any) => m.obra_id === oid).reduce((s: number, m: any) => s + costeMaterial(m), 0);
    return {
      obra_id: oid,
      obra_nombre: obraMap[oid] ?? "Obra desconocida",
      facturado: oFact, cobrado: oCob,
      costeEmpleados: oCEmp, costeMateriales: oCMat,
      margen: oFact - oCEmp - oCMat,
    };
  }).filter((o) => o.facturado > 0 || o.costeEmpleados > 0)
    .sort((a, b) => b.facturado - a.facturado);

  return {
    totalFacturado, totalCobrado, pendienteCobro,
    facturadoEsteMes, facturadoMesAnterior,
    costeEmpleados, costeMateriales,
    margenBruto, margenPct,
    porMes, porObra,
  };
}

// ── Tenant config (datos empresa para facturas) ───────────────────
export interface TenantConfig {
  id: string;
  tenant_id: string;
  empresa_nombre: string | null;
  empresa_cif: string | null;
  empresa_direccion: string | null;
  empresa_telefono: string | null;
  empresa_email: string | null;
  numero_cuenta: string | null;
  updated_at: string;
}

export async function getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
  const { data } = await insforge.database
    .from("tenant_config").select("*").eq("tenant_id", tenantId).maybeSingle();
  return (data as TenantConfig | null) ?? null;
}

export async function upsertTenantConfig(tenantId: string, params: Partial<Omit<TenantConfig, "id" | "tenant_id" | "updated_at">>) {
  return insforge.database.from("tenant_config")
    .upsert({ tenant_id: tenantId, ...params, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" })
    .select().single();
}

// ══════════════════════════════════════════════════════════════════
// NOTIFICACIONES CONFIG
// ══════════════════════════════════════════════════════════════════

export interface NotificacionConfig {
  id: string;
  tenant_id: string;
  notif_asignacion: boolean;
  notif_fichaje: boolean;
  notif_obra_manana: boolean;
  hora_fichaje: string;   // "HH:MM" en hora local España
  updated_at: string;
}

const NOTIF_DEFAULTS: Omit<NotificacionConfig, "id" | "tenant_id" | "updated_at"> = {
  notif_asignacion:  true,
  notif_fichaje:     true,
  notif_obra_manana: true,
  hora_fichaje:      "20:00",
};

export async function getNotificacionConfig(tenantId: string): Promise<NotificacionConfig> {
  const { data } = await insforge.database
    .from("notificacion_config").select("*").eq("tenant_id", tenantId).maybeSingle();
  return data ? (data as NotificacionConfig) : { id: "", tenant_id: tenantId, updated_at: "", ...NOTIF_DEFAULTS };
}

export async function upsertNotificacionConfig(
  tenantId: string,
  params: Partial<Omit<NotificacionConfig, "id" | "tenant_id" | "updated_at">>
) {
  return insforge.database.from("notificacion_config")
    .upsert(
      { tenant_id: tenantId, ...NOTIF_DEFAULTS, ...params, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" }
    )
    .select().single();
}
