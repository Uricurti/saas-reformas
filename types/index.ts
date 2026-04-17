// ─── Roles ────────────────────────────────────────────────────────────────
export type UserRole = "admin" | "empleado";

// ─── Usuario ──────────────────────────────────────────────────────────────
export interface User {
  id: string;
  tenant_id: string;
  nombre: string;
  email: string;
  email_auth?: string;   // email fijo de InsForge (nunca cambia); email es el de display
  rol: UserRole;
  activo: boolean;
  avatar_url?: string;
  created_at: string;
}

// ─── Sesión ───────────────────────────────────────────────────────────────
export interface AuthSession {
  user: User;
  access_token: string;
  refresh_token: string;
}

// ─── Tenant (empresa) ─────────────────────────────────────────────────────
export interface Tenant {
  id: string;
  nombre: string;
  plan: "free" | "basic" | "pro";
  created_at: string;
}

// ─── Obra ─────────────────────────────────────────────────────────────────
export type ObraEstado = "activa" | "pausada" | "proxima" | "archivada";

export interface Obra {
  id: string;
  tenant_id: string;
  nombre: string;
  direccion: string;
  codigo_postal?: string;
  poblacion?: string;
  cliente_nombre?: string;
  cliente_telefono?: string;
  cliente_dni_nie_cif?: string;
  fecha_inicio: string;
  fecha_fin_estimada?: string;
  estado: ObraEstado;
  notas_internas?: string;
  created_by: string;
  created_at: string;
}

export interface ObraConAsignados extends Obra {
  asignaciones: AsignacionConUsuario[];
}

// ─── Asignación ───────────────────────────────────────────────────────────
export interface Asignacion {
  id: string;
  obra_id: string | null;  // null cuando es_libre = true
  user_id: string;
  fecha_inicio: string;
  fecha_fin?: string;
  hora_inicio?: string;    // "HH:MM" — requiere migración 001
  nota?: string;           // nota opcional — requiere migración 001
  es_libre?: boolean;      // día libre — requiere migración 003
  created_at: string;
}

export interface AsignacionConUsuario extends Asignacion {
  user: User;
}

export interface AsignacionConObra extends Asignacion {
  obra: Obra;
}

// ─── Fichaje ──────────────────────────────────────────────────────────────
export type FichajeEstado = "trabajando" | "baja" | "permiso" | "vacaciones" | "otro" | "libre";

export interface Fichaje {
  id: string;
  user_id: string;
  obra_id: string | null;
  obra_asignada_id?: string; // la obra que tenía asignada originalmente (si hubo cambio)
  tenant_id: string;
  fecha: string; // YYYY-MM-DD
  estado: FichajeEstado;
  hora_registro: string; // ISO datetime
  sincronizado: boolean;
  es_cambio_obra: boolean;
  created_at: string;
}

export interface FichajeConDetalles extends Fichaje {
  user: User;
  obra: Obra;
}

// ─── Material ─────────────────────────────────────────────────────────────
export type MaterialEstado = "pendiente" | "comprado" | "entregado";
export type MaterialUrgencia = "normal" | "urgente";
export type MaterialCategoria =
  | "electricidad"
  | "fontaneria"
  | "albanileria"
  | "pintura"
  | "carpinteria"
  | "otro";

// Catálogo maestro de materiales: guarda los pasillos por tienda
export interface MaterialMaestro {
  id: string;
  tenant_id: string;
  nombre: string;
  sabadell_pasillo: number | null;
  terrassa_pasillo: number | null;
  otra_tienda_pasillo: number | null;
  veces_pedido: number;
  created_at: string;
  updated_at: string;
}

export type TiendaCompra = "sabadell" | "terrassa" | "otra";

export interface Material {
  id: string;
  obra_id: string;
  tenant_id: string;
  solicitado_por: string;
  descripcion: string;
  categoria: MaterialCategoria;
  cantidad: number;
  unidad: string;
  urgencia: MaterialUrgencia;
  estado: MaterialEstado;
  nota?: string;
  created_at: string;
  comprado_at?: string;
  material_maestro_id?: string | null;
}

export interface MaterialConDetalles extends Material {
  obra: Obra;
  solicitante: User;
  maestro?: MaterialMaestro | null;
}

// ─── Documento (planos, PDFs, medidas, contratos…) ───────────────────────
export type DocumentoCategoria =
  | "plano"
  | "medidas"
  | "presupuesto"
  | "contrato"
  | "foto"
  | "otro";

export interface Documento {
  id: string;
  obra_id: string;
  user_id: string;
  tenant_id: string;
  nombre: string;               // nombre original del archivo
  categoria: DocumentoCategoria;
  url_storage: string;
  tamano_bytes: number;
  descripcion?: string;
  created_at: string;
  autor?: { nombre: string };   // join con users
}

// ─── Archivo (foto/vídeo) ─────────────────────────────────────────────────
export type ArchivoTipo = "foto" | "video";

export interface Archivo {
  id: string;
  obra_id: string;
  user_id: string;
  tenant_id: string;
  tipo: ArchivoTipo;
  url_storage: string;
  url_thumbnail?: string;
  descripcion?: string;
  tamano_bytes: number;
  created_at: string;
  autor?: { nombre: string } | null;
}

export interface ArchivoConDetalles extends Archivo {
  obra: Obra;
  autor: User;
}

// ─── Tarifa empleado (solo admin) ─────────────────────────────────────────
export interface TarifaEmpleado {
  id: string;
  user_id: string;
  tenant_id: string;
  tarifa_diaria: number;
  fecha_desde: string;
  fecha_hasta?: string;
}

// ─── Jornada (unifica asignaciones diarias + fichajes) ────────────────────────
export interface Jornada {
  id: string;
  tenant_id: string;
  user_id: string;
  obra_id: string | null;
  fecha: string;             // YYYY-MM-DD
  estado: FichajeEstado;
  es_libre: boolean;
  ha_fichado: boolean;
  fichado_at: string | null;
  fichado_por: string | null;  // user_id de quien fichó (null = el propio empleado, distinto = admin)
  hora_inicio: string | null;
  nota: string | null;
  created_at: string;
  updated_at: string;
}

export interface JornadaConDetalles extends Jornada {
  user: User;
  obra: Obra | null;
}

// ─── Jornal calculado ────────────────────────────────────────────────────
export interface JornalMes {
  user: User;
  mes: number; // 1-12
  anio: number;
  dias_trabajados: number;
  dias_baja: number;
  dias_permiso: number;
  tarifa_diaria: number;
  total_bruto: number;
  jornadas: Jornada[];
}

// ─── Facturación ──────────────────────────────────────────────────────────────
export type PagoEstado = "pendiente_emitir" | "emitida" | "cobrada";

export interface Factura {
  id: string;
  tenant_id: string;
  obra_id: string;
  concepto: string;
  importe_total: number;
  numero_factura: string | null;
  fecha_emision: string | null;
  archivo_url: string | null;
  notas: string | null;
  porcentaje_iva: number;
  created_at: string;
  updated_at: string;
}

export interface Pago {
  id: string;
  tenant_id: string;
  factura_id: string;
  obra_id: string;
  orden: number;
  concepto: string;
  porcentaje: number;
  importe_base: number;
  importe_extra: number;
  importe_total: number;
  // A/B Accounting: Track A (with IVA) and Track B (cash, no IVA)
  importe_facturado_a?: number;  // Amount with IVA (official invoice)
  importe_efectivo_b?: number;   // Amount without IVA (cash/black)
  porcentaje_iva_a?: number;     // IVA percentage for Track A (10 or 21)
  fecha_prevista: string | null;
  fecha_cobro: string | null;
  estado: PagoEstado;
  nota: string | null;
  numero_factura_emitida?: string | null;
  created_at: string;
}

export interface FacturaConPagos extends Factura {
  pagos: Pago[];
}

export interface PagoConContexto extends Pago {
  obra_nombre: string;
  factura_concepto: string;
}

// ─── Notificación ─────────────────────────────────────────────────────────
export type NotificacionTipo =
  | "asignacion_nueva"
  | "asignacion_cambio"
  | "material_pedido"
  | "fichaje_pendiente"
  | "foto_subida"
  | "pago_proximo"
  | "pago_vencido";

export interface Notificacion {
  id: string;
  user_id: string;
  tenant_id: string;
  titulo: string;
  mensaje: string;
  tipo: NotificacionTipo;
  leida: boolean;
  created_at: string;
}

// ─── Formularios ─────────────────────────────────────────────────────────
export interface LoginFormData {
  email: string;
  password: string;
}

export interface ObraFormData {
  nombre: string;
  direccion: string;
  codigo_postal?: string;
  poblacion?: string;
  cliente_nombre?: string;
  cliente_telefono?: string;
  cliente_dni_nie_cif?: string;
  fecha_inicio: string;
  fecha_fin_estimada?: string;
  notas_internas?: string;
}

export interface MaterialFormData {
  descripcion: string;
  categoria: MaterialCategoria;
  cantidad: number;
  unidad: string;
  urgencia: MaterialUrgencia;
  nota?: string;
}

export interface UsuarioFormData {
  nombre: string;
  email: string;
  rol: UserRole;
  tarifa_diaria?: number;
}

// ─── Respuestas API ───────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// ─── Offline (IndexedDB) ─────────────────────────────────────────────────
export interface FichajePendiente {
  id: string; // UUID local temporal
  user_id: string;
  obra_id: string;
  tenant_id: string;
  fecha: string;
  estado: FichajeEstado;
  hora_registro: string;
  es_cambio_obra: boolean;
  obra_asignada_id?: string;
  sincronizado: false;
}

// ─── Presupuestos ────────────────────────────────────────────────────────────
export type PresupuestoEstado = "borrador" | "enviado" | "aceptado" | "rechazado";
export type PresupuestoTipo = "bano" | "cocina" | "otros";

export interface Presupuesto {
  id: string; tenant_id: string; numero: string; version: number;
  tipo: PresupuestoTipo; estado: PresupuestoEstado;
  cliente_nombre: string; cliente_apellidos: string | null;
  cliente_nif: string | null; cliente_direccion: string | null;
  cliente_cp: string | null; cliente_ciudad: string | null;
  cliente_email: string | null; cliente_telefono: string | null;
  fecha_emision: string; fecha_validez: string;
  importe_base: number; porcentaje_iva: number;
  importe_iva: number; importe_total: number;
  forma_pago: { concepto: string; porcentaje: number }[];
  notas_internas: string | null; obra_id: string | null;
  created_at: string; updated_at: string;
}

export interface LineaPresupuesto {
  id: string; tenant_id: string; presupuesto_id: string;
  nombre_partida: string; descripcion: string | null;
  precio: number; orden: number; es_base: boolean; created_at: string;
}

export interface PresupuestoConLineas extends Presupuesto {
  lineas: LineaPresupuesto[];
}

export interface CatalogoPartida {
  id: string; tenant_id: string; tipo: PresupuestoTipo;
  nombre_partida: string; descripcion: string | null;
  precio: number; es_base: boolean; orden: number; activo: boolean;
  created_at: string; updated_at: string;
}
