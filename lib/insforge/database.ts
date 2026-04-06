import insforge from "./client";
import { isoDate } from "@/lib/utils";
import type {
  Obra, ObraFormData, Asignacion, Fichaje, FichajeEstado,
  Material, MaterialFormData, Archivo, TarifaEmpleado,
  Notificacion, User, Documento, DocumentoCategoria
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
