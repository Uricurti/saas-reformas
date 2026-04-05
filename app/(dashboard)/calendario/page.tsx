"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useTenantId, useIsAdmin, useUser } from "@/lib/stores/auth-store";
import {
  getAsignacionesByFecha, getUsuariosByTenant, getObrasActivas,
  createAsignacion, updateAsignacion, deleteAsignacion, crearNotificacion,
} from "@/lib/insforge/database";
import type { AsignacionConUsuario, User, Obra } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChevronLeft, ChevronRight, Building2, Edit3, Plus, Check, X, Clock, Bell, Loader2, Sunset } from "lucide-react";
import { cn } from "@/lib/utils";
import { isoDate } from "@/lib/utils/format";
import {
  addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isToday, getDay,
} from "date-fns";
import { es } from "date-fns/locale";

// ── Colores por empleado ──────────────────────────────────────
const PALETTE = [
  { bg: "bg-blue-100",   text: "text-blue-700",   dot: "bg-blue-500",   ring: "ring-blue-400"   },
  { bg: "bg-emerald-100",text: "text-emerald-700",dot: "bg-emerald-500",ring: "ring-emerald-400" },
  { bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-500", ring: "ring-violet-400"  },
  { bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-500",  ring: "ring-amber-400"   },
  { bg: "bg-rose-100",   text: "text-rose-700",   dot: "bg-rose-500",   ring: "ring-rose-400"    },
  { bg: "bg-cyan-100",   text: "text-cyan-700",   dot: "bg-cyan-500",   ring: "ring-cyan-400"    },
  { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500", ring: "ring-orange-400"  },
  { bg: "bg-teal-100",   text: "text-teal-700",   dot: "bg-teal-500",   ring: "ring-teal-400"    },
];

const esFinDeSemana = (fecha: Date) => { const d = getDay(fecha); return d === 0 || d === 6; };
const initials = (nombre: string) => nombre.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

// ─────────────────────────────────────────────────────────────
export default function CalendarioPage() {
  const tenantId  = useTenantId();
  const isAdmin   = useIsAdmin();
  const currentUser = useUser();

  const [mesBase, setMesBase]   = useState(() => startOfMonth(new Date()));
  const [diaSeleccionado, setDia] = useState<string>(isoDate());
  const [asignaciones, setAsignaciones] = useState<Record<string, AsignacionConUsuario[]>>({});
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [obras, setObras]       = useState<Obra[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const diasCalendario = useMemo(() => {
    const ini = startOfWeek(startOfMonth(mesBase), { weekStartsOn: 1 });
    const fin  = endOfWeek(endOfMonth(mesBase),   { weekStartsOn: 1 });
    return eachDayOfInterval({ start: ini, end: fin });
  }, [mesBase]);

  const colorPorUser = useMemo(() => {
    const map: Record<string, typeof PALETTE[0]> = {};
    usuarios.filter(u => u.rol === "empleado").forEach((u, i) => { map[u.id] = PALETTE[i % PALETTE.length]; });
    return map;
  }, [usuarios]);

  const cargar = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    const diasDelMes = diasCalendario.filter(d => isSameMonth(d, mesBase));
    const [usersRes, obrasRes, ...asigResults] = await Promise.all([
      getUsuariosByTenant(tenantId),
      getObrasActivas(tenantId),
      ...diasDelMes.map(d => getAsignacionesByFecha(tenantId, isoDate(d))),
    ]);
    setUsuarios((usersRes.data as User[]) ?? []);
    setObras((obrasRes.data as Obra[]) ?? []);

    const mapa: Record<string, AsignacionConUsuario[]> = {};
    diasDelMes.forEach((d, i) => {
      const raw = (asigResults[i].data as AsignacionConUsuario[]) ?? [];
      // Deduplicar: el API devuelve created_at DESC, así que el primero por user es el más reciente
      // (override de un día o "libre" tiene prioridad sobre asignación de rango antigua)
      const porUser: Record<string, AsignacionConUsuario> = {};
      raw.forEach(a => {
        if (!porUser[a.user_id]) porUser[a.user_id] = a; // first wins = más reciente
      });
      mapa[isoDate(d)] = Object.values(porUser);
    });
    setAsignaciones(mapa);
    setIsLoading(false);
  }, [tenantId, diasCalendario, mesBase]);

  useEffect(() => { cargar(); }, [cargar]);

  const hoy = isoDate();
  const asigsDia = asignaciones[diaSeleccionado] ?? [];
  const DIAS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Calendario del equipo"
        subtitle="Quién trabaja, en qué obra y qué días"
      />

      {/* Navegación de mes */}
      <div className="flex items-center justify-between mb-4 card p-3">
        <button onClick={() => setMesBase(m => subMonths(m, 1))} className="btn-ghost p-2">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-content-primary capitalize">
          {format(mesBase, "MMMM yyyy", { locale: es })}
        </span>
        <button onClick={() => setMesBase(m => addMonths(m, 1))} className="btn-ghost p-2">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Leyenda de empleados */}
      {usuarios.filter(u => u.rol === "empleado").length > 0 && (
        <div className="card p-3 mb-4 flex flex-wrap gap-2">
          {usuarios.filter(u => u.rol === "empleado").map(u => {
            const c = colorPorUser[u.id];
            return (
              <div key={u.id} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", c?.bg, c?.text)}>
                <span className={cn("w-2 h-2 rounded-full", c?.dot)} />
                {u.nombre.split(" ")[0]}
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-400 ml-auto">
            <span className="w-2 h-2 rounded-full bg-gray-300" /> Fin de semana
          </div>
        </div>
      )}

      {/* Grid del mes */}
      {isLoading ? (
        <div className="card animate-pulse overflow-hidden">
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => <div key={i} className="h-16 md:h-24 bg-gray-100 border border-gray-50" />)}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden mb-4">
          {/* Cabecera días */}
          <div className="grid grid-cols-7 border-b border-border">
            {DIAS.map((d, i) => (
              <div key={d} className={cn(
                "text-center py-2 text-xs font-semibold uppercase",
                i >= 5 ? "text-gray-400" : "text-content-muted"
              )}>{d}</div>
            ))}
          </div>

          {/* Celdas */}
          <div className="grid grid-cols-7 divide-x divide-y divide-border">
            {diasCalendario.map(dia => {
              const fechaStr = isoDate(dia);
              const delMes   = isSameMonth(dia, mesBase);
              const finde    = esFinDeSemana(dia);
              const esHoy    = fechaStr === hoy;
              const sel      = diaSeleccionado === fechaStr;
              const asigsDia      = asignaciones[fechaStr] ?? [];
              const asigsActivas  = asigsDia.filter(a => !(a as any).es_libre); // excluir libres
              const numAsigs      = asigsActivas.length;

              return (
                <button
                  key={fechaStr}
                  onClick={() => setDia(fechaStr)}
                  className={cn(
                    "relative min-h-[58px] md:min-h-[88px] p-1.5 text-left transition-colors",
                    finde && delMes ? "bg-gray-50" : "bg-white",
                    !delMes && "opacity-40",
                    sel && "bg-primary-light ring-2 ring-inset ring-primary/30",
                    !sel && delMes && !finde && "hover:bg-gray-50",
                  )}
                >
                  {/* Número */}
                  <div className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1",
                    esHoy ? "bg-primary text-white" : finde ? "text-gray-400" : "text-content-primary",
                  )}>{format(dia, "d")}</div>

                  {/* Fin de semana label (solo desktop) */}
                  {finde && delMes && numAsigs === 0 && (
                    <div className="hidden md:block text-[9px] text-gray-400 uppercase font-medium px-0.5">Libre</div>
                  )}

                  {/* Dots (móvil) — solo trabajadores activos ese día */}
                  {delMes && numAsigs > 0 && (
                    <div className="flex flex-wrap gap-0.5 md:hidden">
                      {asigsActivas.slice(0, 4).map(a => (
                        <span key={a.id} className={cn("w-1.5 h-1.5 rounded-full", colorPorUser[a.user_id]?.dot ?? "bg-gray-400")} />
                      ))}
                      {numAsigs > 4 && <span className="text-[9px] text-content-muted">+{numAsigs - 4}</span>}
                    </div>
                  )}

                  {/* Chips (desktop) — solo trabajadores activos ese día */}
                  {delMes && numAsigs > 0 && (
                    <div className="hidden md:flex flex-col gap-0.5">
                      {asigsActivas.slice(0, 3).map(a => {
                        const c = colorPorUser[a.user_id];
                        return (
                          <div key={a.id} className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate", c?.bg, c?.text)}>
                            <span className="truncate">{a.user?.nombre?.split(" ")[0] ?? "—"}</span>
                            {(a as any).hora_inicio && <Clock className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />}
                          </div>
                        );
                      })}
                      {numAsigs > 3 && <div className="text-[10px] text-content-muted pl-1">+{numAsigs - 3}</div>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Panel de detalle del día */}
      <DayPanel
        fecha={diaSeleccionado}
        asigs={asigsDia}
        usuarios={usuarios}
        obras={obras}
        tenantId={tenantId!}
        isAdmin={isAdmin}
        currentUser={currentUser}
        colorPorUser={colorPorUser}
        onRefresh={cargar}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Panel lateral de detalle del día
// ─────────────────────────────────────────────────────────────
function DayPanel({
  fecha, asigs, usuarios, obras, tenantId,
  isAdmin, currentUser, colorPorUser, onRefresh,
}: {
  fecha: string;
  asigs: AsignacionConUsuario[];
  usuarios: User[];
  obras: Obra[];
  tenantId: string;
  isAdmin: boolean;
  currentUser: User | null;
  colorPorUser: Record<string, typeof PALETTE[0]>;
  onRefresh: () => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [modoLibre, setModoLibre] = useState(false);
  const [obraId, setObraId]     = useState("");
  const [hora, setHora]         = useState("");
  const [nota, setNota]         = useState("");
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk]     = useState(false);

  // Estado para "trabajar hoy" (empleado en fin de semana)
  const [trabajarObraId, setTrabajorObraId] = useState("");
  const [trabajarHora, setTrabajorHora]     = useState("");
  const [savingTrabajo, setSavingTrabajo]   = useState(false);

  const hoy = isoDate();
  const esHoy  = fecha === hoy;
  const esFinde = esFinDeSemana(new Date(fecha + "T12:00:00"));
  const empleados = usuarios.filter(u => u.rol === "empleado");
  const diasLabel = format(new Date(fecha + "T12:00:00"), "EEEE, d 'de' MMMM", { locale: es });

  // ¿El empleado actual tiene asignación ese día?
  const miAsig = asigs.find(a => a.user_id === currentUser?.id);

  function iniciarEdicion(userId: string, asig?: AsignacionConUsuario) {
    setEditando(userId);
    setModoLibre((asig as any)?.es_libre === true);
    setObraId(asig?.obra_id ?? "");
    setHora((asig as any)?.hora_inicio ?? "");
    setNota((asig as any)?.nota ?? "");
  }

  async function guardarReasignacion(userId: string, asigExistente?: AsignacionConUsuario) {
    if (!modoLibre && !obraId) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    const obraSeleccionada = obras.find(o => o.id === obraId);

    try {
      let err: any = null;

      if (asigExistente) {
        const esSoloDia = asigExistente.fecha_fin === asigExistente.fecha_inicio;
        if (esSoloDia) {
          const res = await updateAsignacion(asigExistente.id, {
            obra_id: modoLibre ? null : obraId,
            es_libre: modoLibre,
            ...(modoLibre ? {} : hora ? { hora_inicio: hora } : {}),
            ...(modoLibre ? {} : nota ? { nota } : {}),
          });
          err = (res as any).error;
        } else {
          const res = await createAsignacion(
            modoLibre ? null : obraId,
            userId, fecha, fecha,
            modoLibre ? undefined : hora || undefined,
            modoLibre ? undefined : nota || undefined,
            modoLibre,
          );
          err = (res as any).error;
        }
      } else {
        const res = await createAsignacion(
          modoLibre ? null : obraId,
          userId, fecha, fecha,
          modoLibre ? undefined : hora || undefined,
          modoLibre ? undefined : nota || undefined,
          modoLibre,
        );
        err = (res as any).error;
      }

      if (err) {
        const msg = err?.message ?? err?.code ?? JSON.stringify(err);
        setSaveError(`Error al guardar: ${msg}`);
        return;
      }

      // Notificación al empleado
      if (modoLibre) {
        await crearNotificacion({
          userId, tenantId,
          titulo: "Día libre",
          mensaje: `El ${diasLabel} tienes el día libre.`,
          tipo: "asignacion_cambio",
        });
      } else {
        const horaTexto = hora ? ` a las ${hora}` : "";
        await crearNotificacion({
          userId, tenantId,
          titulo: "Nueva asignación",
          mensaje: `El ${diasLabel}, vas a la obra "${obraSeleccionada?.nombre ?? obraId}"${horaTexto}.`,
          tipo: "asignacion_nueva",
        });
      }

      setSaveOk(true);
      setTimeout(() => {
        setEditando(null);
        setSaveOk(false);
        onRefresh();
      }, 800);

    } catch (e: any) {
      setSaveError(`Error inesperado: ${e?.message ?? "desconocido"}`);
    } finally {
      setSaving(false);
    }
  }

  async function guardarTrabajoExcepcional() {
    if (!trabajarObraId || !currentUser) return;
    setSavingTrabajo(true);
    try {
      await createAsignacion(trabajarObraId, currentUser.id, fecha, fecha, trabajarHora || undefined);
      await crearNotificacion({
        userId: currentUser.id,
        tenantId,
        titulo: "Trabajo excepcional registrado",
        mensaje: `Has registrado trabajo en fin de semana (${diasLabel}).`,
        tipo: "asignacion_nueva",
      });
      setTrabajorObraId("");
      setTrabajorHora("");
      onRefresh();
    } finally {
      setSavingTrabajo(false);
    }
  }

  return (
    <div className="card p-4 animate-fade-in">
      {/* Cabecera día */}
      <div className="flex items-center gap-2 mb-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0",
          esHoy ? "bg-primary text-white" : esFinde ? "bg-gray-100 text-gray-500" : "bg-primary-light text-primary",
        )}>
          <span className="text-xs font-bold leading-none">{format(new Date(fecha + "T12:00:00"), "d")}</span>
          <span className="text-[9px] uppercase leading-none mt-0.5">{format(new Date(fecha + "T12:00:00"), "MMM", { locale: es })}</span>
        </div>
        <div>
          <p className="font-semibold text-content-primary capitalize">{diasLabel}</p>
          <p className="text-xs text-content-muted">
            {esFinde ? "🏖️ Fin de semana" : `${asigs.length} trabajador${asigs.length !== 1 ? "es" : ""} asignado${asigs.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Lista de todos los empleados */}
      <div className="space-y-2 mb-4">
        {empleados.map(user => {
          const asig = asigs.find(a => a.user_id === user.id);
          const c    = colorPorUser[user.id];
          const esEditando = editando === user.id;

          return (
            <div key={user.id} className={cn("rounded-xl border transition-all", esEditando ? "border-primary/40 bg-primary-light/30" : "border-border bg-gray-50")}>
              {/* Fila del trabajador */}
              <div className="flex items-center gap-3 p-3">
                {/* Avatar */}
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white", c?.dot ?? "bg-gray-400")}>
                  {initials(user.nombre)}
                </div>

                {/* Nombre + obra actual */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-content-primary">{user.nombre}</p>
                  {asig ? (
                    (asig as any).es_libre ? (
                      <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <span>🏖️</span>
                        <span>Libre</span>
                        {(asig as any).nota && <span className="text-content-muted font-normal ml-1">· {(asig as any).nota}</span>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-content-muted">
                        <Building2 className="w-3 h-3" />
                        <span className="truncate">{(asig as any).obra?.nombre ?? "Obra"}</span>
                        {(asig as any).hora_inicio && (
                          <><Clock className="w-3 h-3 ml-1" /><span>{(asig as any).hora_inicio}</span></>
                        )}
                      </div>
                    )
                  ) : (
                    <p className="text-xs text-content-muted italic">{esFinde ? "Día libre" : "Sin asignación"}</p>
                  )}
                </div>

                {/* Acción admin */}
                {isAdmin && !esEditando && (
                  <button
                    onClick={() => iniciarEdicion(user.id, asig)}
                    className="btn-ghost p-1.5 flex-shrink-0"
                    title="Cambiar obra"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                {isAdmin && esEditando && (
                  <button onClick={() => setEditando(null)} className="btn-ghost p-1.5 flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Formulario de reasignación (admin) */}
              {isAdmin && esEditando && (
                <div className="px-3 pb-3 space-y-3 border-t border-primary/20 pt-3">
                  {/* Toggle Obra / Libre */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setModoLibre(false)}
                      className={cn(
                        "flex items-center justify-center gap-2 py-2 rounded-xl border-2 text-sm font-medium transition-all",
                        !modoLibre
                          ? "border-primary bg-primary-light text-primary"
                          : "border-border text-content-secondary hover:border-primary/40"
                      )}
                    >
                      <Building2 className="w-4 h-4" /> Asignar obra
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoLibre(true)}
                      className={cn(
                        "flex items-center justify-center gap-2 py-2 rounded-xl border-2 text-sm font-medium transition-all",
                        modoLibre
                          ? "border-amber-400 bg-amber-50 text-amber-700"
                          : "border-border text-content-secondary hover:border-amber-300"
                      )}
                    >
                      🏖️ Libre
                    </button>
                  </div>

                  {/* Campos de obra (solo si no es libre) */}
                  {!modoLibre && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="label text-xs">Obra</label>
                          <select value={obraId} onChange={e => setObraId(e.target.value)} className="input py-1.5 text-sm">
                            <option value="">Seleccionar...</option>
                            {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label text-xs flex items-center gap-1"><Clock className="w-3 h-3" />Hora (opcional)</label>
                          <input type="time" value={hora} onChange={e => setHora(e.target.value)} className="input py-1.5 text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="label text-xs">Nota (opcional)</label>
                        <input type="text" value={nota} onChange={e => setNota(e.target.value)} className="input py-1.5 text-sm" placeholder="Ej: traer herramienta específica" />
                      </div>
                    </div>
                  )}

                  {/* Mensaje cuando es libre */}
                  {modoLibre && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                      🏖️ <strong>{user.nombre}</strong> tendrá el día libre. Se le enviará una notificación.
                    </div>
                  )}

                  {/* Feedback */}
                  {saveError && editando === user.id && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {saveError}
                    </div>
                  )}
                  {saveOk && editando === user.id && (
                    <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Guardado correctamente
                    </div>
                  )}

                  {/* Botones guardar */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex items-center gap-1 text-xs text-content-muted flex-1">
                      <Bell className="w-3 h-3" />
                      Notificación automática al empleado
                    </div>
                    <button onClick={() => setEditando(null)} className="btn-ghost py-1.5 px-3 text-sm">Cancelar</button>
                    <button
                      onClick={() => guardarReasignacion(user.id, asig)}
                      disabled={(!modoLibre && !obraId) || saving}
                      className={cn(
                        "py-1.5 px-3 text-sm gap-1.5 rounded-xl font-medium flex items-center transition-all",
                        modoLibre
                          ? "bg-amber-500 text-white hover:bg-amber-600"
                          : "btn-primary",
                        ((!modoLibre && !obraId) || saving) && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      {modoLibre ? "Poner libre" : "Guardar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Botón "Trabajar hoy" — solo si: empleado, fin de semana, hoy, sin asignación */}
      {!isAdmin && esFinde && esHoy && !miAsig && currentUser && (
        <div className="border border-dashed border-primary/30 rounded-xl p-4 bg-primary-light/20">
          <p className="text-sm font-semibold text-content-primary mb-1">¿Trabajas hoy excepcionalmente?</p>
          <p className="text-xs text-content-muted mb-3">Es fin de semana — si vas a una obra, regístralo aquí.</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="label text-xs">¿En qué obra?</label>
              <select value={trabajarObraId} onChange={e => setTrabajorObraId(e.target.value)} className="input py-1.5 text-sm">
                <option value="">Seleccionar...</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs flex items-center gap-1"><Clock className="w-3 h-3" />Hora entrada</label>
              <input type="time" value={trabajarHora} onChange={e => setTrabajorHora(e.target.value)} className="input py-1.5 text-sm" />
            </div>
          </div>
          <button
            onClick={guardarTrabajoExcepcional}
            disabled={!trabajarObraId || savingTrabajo}
            className={cn("btn-primary w-full justify-center gap-2", (!trabajarObraId || savingTrabajo) && "opacity-60 cursor-not-allowed")}
          >
            {savingTrabajo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Registrar trabajo excepcional
          </button>
        </div>
      )}

      {/* Si el empleado trabaja en fin de semana — mostrar su asignación destacada */}
      {!isAdmin && esFinde && miAsig && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Trabajo excepcional registrado</p>
            <p className="text-xs text-amber-700">
              Obra: {(miAsig as any).obra?.nombre ?? "—"}
              {(miAsig as any).hora_inicio && ` · ${(miAsig as any).hora_inicio}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
