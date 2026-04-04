// ─── Roles ────────────────────────────────────────────────────────────────
export type UserRole = "admin" | "empleado";

// ─── Usuario ──────────────────────────────────────────────────────────────
export interface User {
  id: string;
  tenant_id: string;
  nombre: string;
  email: string;
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
export type ObraEstado = "activa" | "pausada" | "archivada";

export interface Obra {
  id: string;
  tenant_id: string;
  nombre: string;
  direccion: string;
  cliente_nombre?: string;
  cliente_telefono?: string;
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
  obra_id: string;
  user_id: string;
  fecha_inicio: string;
  fecha_fin?: string;
  hora_inicio?: string; // "HH:MM" — requiere migración 001
  nota?: string;        // nota opcional — requiere migración 001
  created_at: string;
}

export interface AsignacionConUsuario extends Asignacion {
  user: User;
}

export interface AsignacionConObra extends Asignacion {
  obra: Obra;
}

// ─── Fichaje ──────────────────────────────────────────────────────────────
export type FichajeEstado = "trabajando" | "baja" | "permiso" | "vacaciones" | "otro";

export interface Fichaje {
  id: string;
  user_id: string;
  obra_id: string;
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
}

export interface MaterialConDetalles extends Material {
  obra: Obra;
  solicitante: User;
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
  fichajes: Fichaje[];
}

// ─── Notificación ─────────────────────────────────────────────────────────
export type NotificacionTipo =
  | "asignacion_nueva"
  | "asignacion_cambio"
  | "material_pedido"
  | "fichaje_pendiente"
  | "foto_subida";

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
  cliente_nombre?: string;
  cliente_telefono?: string;
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
