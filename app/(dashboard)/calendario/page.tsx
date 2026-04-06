"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useTenantId, useIsAdmin, useUser } from "@/lib/stores/auth-store";
import { useRefreshOnFocus } from "@/lib/hooks/useRefreshOnFocus";
import {
  getJornadasByMes, upsertJornada, getUsuariosByTenant, getObrasActivas,
  crearNotificacion,
} from "@/lib/insforge/database";
import type { JornadaConDetalles, User, Obra } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChevronLeft, ChevronRight, Building2, Edit3, Plus, Check, X, Clock, Bell, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isoDate } from "@/lib/utils/format";
import {
  addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, getDay,
} from "date-fns";
import { es } from "date-fns/locale";
import type { FichajeEstado } from "@/types";

const PALETTE = [
  { bg: "bg-blue-100",    text: "text-blue-700",    dot: "bg-blue-500"    },
  { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  { bg: "bg-violet-100",  text: "text-violet-700",  dot: "bg-violet-500"  },
  { bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-500"   },
  { bg: "bg-rose-100",    text: "text-rose-700",    dot: "bg-rose-500"    },
  { bg: "bg-cyan-100",    text: "text-cyan-700",    dot: "bg-cyan-500"    },
  { bg: "bg-orange-100",  text: "text-orange-700",  dot: "bg-orange-500"  },
  { bg: "bg-teal-100",    text: "text-teal-700",    dot: "bg-teal-500"    },
];

const esFinDeSemana = (d: Date) => { const w = getDay(d); return w === 0 || w === 6; };
const initials = (n: string) => n.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase();

export default function CalendarioPage() {
  const tenantId    = useTenantId();
  const isAdmin     = useIsAdmin();
  const currentUser = useUser();

  const [mesBase, setMesBase]     = useState(() => startOfMonth(new Date()));
  const [diaSeleccionado, setDia] = useState<string>(isoDate());
  const [jornadasByFecha, setJornadasByFecha] = useState<Record<string, JornadaConDetalles[]>>({});
  const [usuarios, setUsuarios]   = useState<User[]>([]);
  const [obras, setObras]         = useState<Obra[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const diasCalendario = useMemo(() => {
    const ini = startOfWeek(startOfMonth(mesBase), { weekStartsOn: 1 });
    const fin  = endOfWeek(endOfMonth(mesBase),    { weekStartsOn: 1 });
    return eachDayOfInterval({ start: ini, end: fin });
  }, [mesBase]);

  const colorPorUser = useMemo(() => {
    const m: Record<string, typeof PALETTE[0]> = {};
    usuarios.filter(u => u.rol === "empleado").forEach((u, i) => { m[u.id] = PALETTE[i % PALETTE.length]; });
    return m;
  }, [usuarios]);

  const cargar = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const fechaInicio = isoDate(diasCalendario[0]);
      const fechaFin    = isoDate(diasCalendario[diasCalendario.length - 1]);

      const [usersRes, obrasRes, jornadasRes] = await Promise.all([
        getUsuariosByTenant(tenantId),
        getObrasActivas(tenantId),
        getJornadasByMes(tenantId, fechaInicio, fechaFin),
      ]);

      setUsuarios((usersRes.data as User[]) ?? []);
      setObras((obrasRes.data as Obra[]) ?? []);

      // Agrupar jornadas por fecha
      const byFecha: Record<string, JornadaConDetalles[]> = {};
      const jornadas = (jornadasRes.data as JornadaConDetalles[]) ?? [];
      jornadas.forEach(j => {
        if (!byFecha[j.fecha]) byFecha[j.fecha] = [];
        byFecha[j.fecha].push(j);
      });
      setJornadasByFecha(byFecha);
    } catch (e) {
      console.error("[calendario] Error cargando:", e);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, diasCalendario, mesBase]);

  useEffect(() => { cargar(); }, [cargar]);
  useRefreshOnFocus(cargar);

  const hoy       = isoDate();
  const jornadasDia = jornadasByFecha[diaSeleccionado] ?? [];
  const DIAS      = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const empleados = usuarios.filter(u => u.rol === "empleado");

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <PageHeader title="Calendario del equipo" subtitle="Quién trabaja, en qué obra y qué días" />

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

      {/* Leyenda */}
      {empleados.length > 0 && (
        <div className="card p-3 mb-4 flex flex-wrap gap-2">
          {empleados.map(u => {
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
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-hidden mb-4">
          <div className="grid grid-cols-7 border-b border-border">
            {DIAS.map((d, i) => (
              <div key={d} className={cn("text-center py-2 text-xs font-semibold uppercase", i >= 5 ? "text-gray-400" : "text-content-muted")}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-border">
            {diasCalendario.map(dia => {
              const fechaStr = isoDate(dia);
              const delMes   = isSameMonth(dia, mesBase);
              const finde    = esFinDeSemana(dia);
              const esHoy    = fechaStr === hoy;
              const sel      = diaSeleccionado === fechaStr;
              const jornadasCell = jornadasByFecha[fechaStr] ?? [];
              const trabajando = jornadasCell.filter(j => !j.es_libre);

              return (
                <button
                  key={fechaStr}
                  onClick={() => setDia(fechaStr)}
                  className={cn(
                    "relative min-h-[58px] md:min-h-[88px] p-1.5 text-left transition-colors",
                    finde && delMes ? "bg-gray-50" : "bg-white",
                    !delMes && "opacity-40",
                    sel && "bg-primary-light ring-2 ring-inset ring-primary/30",
                    !sel && delMes && "hover:bg-gray-50",
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1",
                    esHoy ? "bg-primary text-white" : finde ? "text-gray-400" : "text-content-primary",
                  )}>{format(dia, "d")}</div>

                  {/* Dots (móvil) */}
                  {delMes && trabajando.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 md:hidden">
                      {trabajando.slice(0, 4).map(j => (
                        <span key={j.id} className={cn("w-1.5 h-1.5 rounded-full", colorPorUser[j.user_id]?.dot ?? "bg-gray-400")} />
                      ))}
                      {trabajando.length > 4 && <span className="text-[9px] text-content-muted">+{trabajando.length - 4}</span>}
                    </div>
                  )}

                  {/* Chips (desktop) */}
                  {delMes && trabajando.length > 0 && (
                    <div className="hidden md:flex flex-col gap-0.5">
                      {trabajando.slice(0, 3).map(j => {
                        const c = colorPorUser[j.user_id];
                        const fichado = j.ha_fichado;
                        return (
                          <div key={j.id} className={cn(
                            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate",
                            c?.bg, c?.text,
                            !fichado && "opacity-60",
                          )}>
                            <span className="truncate">{(j as any).user?.nombre?.split(" ")[0] ?? "—"}</span>
                            {fichado && <Check className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />}
                          </div>
                        );
                      })}
                      {trabajando.length > 3 && <div className="text-[10px] text-content-muted pl-1">+{trabajando.length - 3}</div>}
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
        jornadas={jornadasDia}
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
function DayPanel({
  fecha, jornadas, usuarios, obras, tenantId,
  isAdmin, currentUser, colorPorUser, onRefresh,
}: {
  fecha: string;
  jornadas: JornadaConDetalles[];
  usuarios: User[];
  obras: Obra[];
  tenantId: string;
  isAdmin: boolean;
  currentUser: User | null;
  colorPorUser: Record<string, typeof PALETTE[0]>;
  onRefresh: () => void;
}) {
  const [editando, setEditando]   = useState<string | null>(null);
  const [modoLibre, setModoLibre] = useState(false);
  const [obraId, setObraId]       = useState("");
  const [hora, setHora]           = useState("");
  const [nota, setNota]           = useState("");
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk]       = useState(false);

  const hoy     = isoDate();
  const esHoy   = fecha === hoy;
  const esFinde = esFinDeSemana(new Date(fecha + "T12:00:00"));
  const empleados = usuarios.filter(u => u.rol === "empleado");
  const diasLabel = format(new Date(fecha + "T12:00:00"), "EEEE, d 'de' MMMM", { locale: es });
  const numTrabajando = jornadas.filter(j => !j.es_libre).length;

  // Map userId → jornada for quick lookup
  const jornadaByUser: Record<string, JornadaConDetalles> = {};
  jornadas.forEach(j => { jornadaByUser[j.user_id] = j; });

  function iniciarEdicion(userId: string) {
    const j = jornadaByUser[userId];
    setEditando(userId);
    setModoLibre(j ? j.es_libre : esFinde);
    setObraId(j?.obra_id ?? "");
    setHora((j as any)?.hora_inicio ?? "");
    setNota(j?.nota ?? "");
    setSaveError(null);
    setSaveOk(false);
  }

  async function guardar(userId: string) {
    if (!modoLibre && !obraId) { setSaveError("Selecciona una obra"); return; }
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);

    const estado: FichajeEstado = modoLibre ? "libre" : "trabajando";
    const { error } = await upsertJornada({
      userId,
      tenantId,
      fecha,
      estado,
      obraId: modoLibre ? null : obraId,
      esLibre: modoLibre,
      horaInicio: hora || undefined,
      nota: nota || undefined,
    });

    if (error) {
      setSaveError(`Error al guardar: ${error?.message ?? JSON.stringify(error)}`);
      setSaving(false);
      return;
    }

    // Notificación al empleado
    const obraNombre = obras.find(o => o.id === obraId)?.nombre;
    if (modoLibre) {
      await crearNotificacion({ userId, tenantId, titulo: "Día libre", mensaje: `El ${diasLabel} tienes el día libre.`, tipo: "asignacion_cambio" });
    } else {
      await crearNotificacion({ userId, tenantId, titulo: "Nueva asignación", mensaje: `El ${diasLabel}, vas a la obra "${obraNombre ?? obraId}".`, tipo: "asignacion_nueva" });
    }

    setSaveOk(true);
    setSaving(false);
    setTimeout(() => { setEditando(null); setSaveOk(false); onRefresh(); }, 800);
  }

  return (
    <div className="card p-4 animate-fade-in">
      {/* Cabecera del día */}
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
            {numTrabajando === 0
              ? esFinde ? "🏖️ Fin de semana" : "📋 Sin asignaciones"
              : `🏗️ ${numTrabajando} trabajador${numTrabajando !== 1 ? "es" : ""} asignado${numTrabajando !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Lista de empleados */}
      <div className="space-y-2 mb-4">
        {empleados.map(user => {
          const j = jornadaByUser[user.id];
          const c = colorPorUser[user.id];
          const esEditando = editando === user.id;

          return (
            <div key={user.id} className={cn(
              "rounded-xl border transition-all",
              esEditando ? "border-primary/40 bg-primary-light/30" : "border-border bg-gray-50",
            )}>
              {/* Fila */}
              <div className="flex items-center gap-3 p-3">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white", c?.dot ?? "bg-gray-400")}>
                  {initials(user.nombre)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-content-primary">{user.nombre}</p>
                  {j ? (
                    j.es_libre ? (
                      <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <span>🏖️</span><span>Libre</span>
                        {j.nota && <span className="text-content-muted font-normal ml-1">· {j.nota}</span>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-content-muted flex-wrap">
                        <Building2 className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{(j as any).obra?.nombre ?? "Obra"}</span>
                        {j.hora_inicio && <><Clock className="w-3 h-3 ml-1" /><span>{j.hora_inicio}</span></>}
                        {j.ha_fichado && <span className="text-success font-medium flex items-center gap-0.5"><Check className="w-3 h-3" />Fichado</span>}
                      </div>
                    )
                  ) : (
                    <p className="text-xs text-content-muted italic">Sin asignación</p>
                  )}
                </div>

                {isAdmin && !esEditando && (
                  <button onClick={() => iniciarEdicion(user.id)} className="btn-ghost p-1.5 flex-shrink-0" title="Editar jornada">
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
                {isAdmin && esEditando && (
                  <button onClick={() => setEditando(null)} className="btn-ghost p-1.5 flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Formulario de edición (admin) */}
              {isAdmin && esEditando && (
                <div className="px-3 pb-3 space-y-3 border-t border-primary/20 pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setModoLibre(false)}
                      className={cn("flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                        !modoLibre ? "border-primary bg-primary-light text-primary" : "border-border text-content-secondary hover:border-primary/40")}>
                      <Building2 className="w-4 h-4" /> Asignar obra
                    </button>
                    <button type="button" onClick={() => setModoLibre(true)}
                      className={cn("flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                        modoLibre ? "border-amber-400 bg-amber-50 text-amber-700" : "border-border text-content-secondary hover:border-amber-300")}>
                      🏖️ Libre
                    </button>
                  </div>

                  {!modoLibre && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

                  {modoLibre && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                      🏖️ <strong>{user.nombre}</strong> tendrá el día libre. Se le enviará una notificación.
                    </div>
                  )}

                  {saveError && editando === user.id && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</div>
                  )}
                  {saveOk && editando === user.id && (
                    <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Guardado correctamente
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <div className="hidden sm:flex items-center gap-1 text-xs text-content-muted flex-1">
                      <Bell className="w-3 h-3" /> Notificación automática al empleado
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={() => setEditando(null)} className="btn-ghost py-2 px-3 text-sm flex-1 sm:flex-none">Cancelar</button>
                      <button
                        onClick={() => guardar(user.id)}
                        disabled={(!modoLibre && !obraId) || saving}
                        className={cn(
                          "py-2 px-3 text-sm gap-1.5 rounded-xl font-medium flex items-center justify-center transition-all flex-1 sm:flex-none",
                          modoLibre ? "bg-amber-500 text-white hover:bg-amber-600" : "btn-primary",
                          ((!modoLibre && !obraId) || saving) && "opacity-60 cursor-not-allowed",
                        )}
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {modoLibre ? "Poner libre" : "Guardar"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {empleados.length === 0 && (
          <p className="text-sm text-center text-content-muted py-4">No hay empleados en el equipo aún.</p>
        )}
      </div>
    </div>
  );
}
