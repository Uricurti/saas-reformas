"use client";

import { useEffect, useState, useCallback } from "react";
import { useTenantId, useIsAdmin } from "@/lib/stores/auth-store";
import { useRouter } from "next/navigation";
import {
  getJornadasByTenantMes, getUsuariosByTenant, getTarifaEmpleado,
  getObrasActivas, getJornadaByFecha, upsertJornada, deleteJornada,
} from "@/lib/insforge/database";
import type { User, Jornada, JornalMes, Obra, FichajeEstado } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  ChevronLeft, ChevronRight, Calculator, Lock,
  ChevronDown, ChevronUp, Plus, Pencil, Trash2,
  Check, X, Loader2, Clock,
} from "lucide-react";
import { formatCurrency, formatMonthYear } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { format, getDaysInMonth, getDay } from "date-fns";
import { es } from "date-fns/locale";

const ESTADOS: { value: FichajeEstado; label: string; emoji: string; color: string }[] = [
  { value: "trabajando",  label: "Trabajando",  emoji: "🏗️", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { value: "libre",       label: "Libre",       emoji: "🏖️", color: "text-amber-700  bg-amber-50  border-amber-200"  },
  { value: "baja",        label: "Baja médica", emoji: "🏥", color: "text-red-700    bg-red-50    border-red-200"    },
  { value: "permiso",     label: "Permiso",     emoji: "📋", color: "text-blue-700   bg-blue-50   border-blue-200"   },
  { value: "vacaciones",  label: "Vacaciones",  emoji: "✈️", color: "text-teal-700   bg-teal-50   border-teal-200"   },
  { value: "otro",        label: "Otro",        emoji: "💬", color: "text-gray-700   bg-gray-50   border-gray-200"   },
];

const estadoInfo = (e: string) => ESTADOS.find(x => x.value === e) ?? ESTADOS[5];
const initials = (n: string) => n.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase();

function todosDiasMes(anio: number, mes: number): string[] {
  const total = getDaysInMonth(new Date(anio, mes - 1, 1));
  const dias: string[] = [];
  for (let d = 1; d <= total; d++) {
    dias.push(`${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return dias;
}

export default function JornalesPage() {
  const tenantId = useTenantId();
  const isAdmin  = useIsAdmin();
  const router   = useRouter();

  const [anio, setAnio]     = useState(new Date().getFullYear());
  const [mes, setMes]       = useState(new Date().getMonth() + 1);
  const [jornales, setJornales] = useState<JornalMes[]>([]);
  const [obras, setObras]   = useState<Obra[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ userId: string; fecha: string; jornadaId?: string } | null>(null);

  useEffect(() => { if (!isAdmin) router.replace("/obras"); }, [isAdmin]);
  useEffect(() => { if (tenantId && isAdmin) cargar(); }, [tenantId, mes, anio, isAdmin]);

  const cargar = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const [usersRes, jornadasRes, obrasRes] = await Promise.all([
        getUsuariosByTenant(tenantId),
        getJornadasByTenantMes(tenantId, anio, mes),
        getObrasActivas(tenantId),
      ]);

      const usuarios   = ((usersRes.data as User[]) ?? []).filter(u => u.rol === "empleado");
      const jornadas   = (jornadasRes.data as Jornada[]) ?? [];
      const obrasData  = (obrasRes.data as Obra[]) ?? [];
      setObras(obrasData);

      const resultados: JornalMes[] = await Promise.all(
        usuarios.map(async (user) => {
          const jUser          = jornadas.filter(j => j.user_id === user.id);
          const diasTrabajados = jUser.filter(j => j.estado === "trabajando" && j.ha_fichado).length;
          const diasBaja       = jUser.filter(j => j.estado === "baja").length;
          const diasPermiso    = jUser.filter(j => ["permiso", "vacaciones", "otro"].includes(j.estado)).length;
          const tarifaDiaria   = await getTarifaEmpleado(user.id);
          return {
            user, mes, anio,
            dias_trabajados: diasTrabajados,
            dias_baja: diasBaja,
            dias_permiso: diasPermiso,
            tarifa_diaria: tarifaDiaria,
            total_bruto: diasTrabajados * tarifaDiaria,
            jornadas: jUser,
          };
        })
      );

      setJornales(resultados);
    } catch (e) {
      console.error("[jornales] Error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, anio, mes]);

  function cambiarMes(delta: number) {
    let nm = mes + delta, ny = anio;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1)  { nm = 12; ny--; }
    setMes(nm); setAnio(ny);
    setExpanded(null); setEditando(null);
  }

  const totalGeneral = jornales.reduce((acc, j) => acc + j.total_bruto, 0);
  if (!isAdmin) return null;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Jornales"
        subtitle="Días trabajados y cálculo de nómina"
        action={
          <div className="flex items-center gap-1.5 text-xs text-success-foreground bg-success-light px-3 py-1.5 rounded-full">
            <Lock className="w-3 h-3" /> Solo admins
          </div>
        }
      />

      {/* Selector de mes */}
      <div className="card p-3 flex items-center justify-between mb-6">
        <button onClick={() => cambiarMes(-1)} className="btn-ghost p-2"><ChevronLeft className="w-5 h-5" /></button>
        <span className="font-semibold text-content-primary capitalize">
          {formatMonthYear(new Date(anio, mes - 1, 1))}
        </span>
        <button onClick={() => cambiarMes(1)} className="btn-ghost p-2"><ChevronRight className="w-5 h-5" /></button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-4">
            {jornales.map(j => (
              <EmpleadoJornal
                key={j.user.id}
                jornal={j}
                obras={obras}
                tenantId={tenantId!}
                anio={anio}
                mes={mes}
                expanded={expanded === j.user.id}
                editando={editando?.userId === j.user.id ? editando : null}
                onToggle={() => {
                  setExpanded(prev => prev === j.user.id ? null : j.user.id);
                  setEditando(null);
                }}
                onSetEditando={setEditando}
                onRefresh={cargar}
              />
            ))}

            {jornales.length === 0 && (
              <div className="card p-10 text-center text-content-muted">
                <Calculator className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No hay empleados este mes.</p>
              </div>
            )}
          </div>

          {/* Total general */}
          <div className="card p-5 flex items-center justify-between bg-primary text-white">
            <div className="flex items-center gap-3">
              <Calculator className="w-5 h-5" />
              <span className="font-semibold">Total del mes</span>
            </div>
            <span className="text-2xl font-bold">{formatCurrency(totalGeneral)}</span>
          </div>

          <p className="text-xs text-content-muted mt-4 text-center px-4">
            ⚠️ Cálculo orientativo. No reemplaza a un sistema de nóminas oficial.
          </p>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function EmpleadoJornal({
  jornal, obras, tenantId, anio, mes,
  expanded, editando, onToggle, onSetEditando, onRefresh,
}: {
  jornal: JornalMes;
  obras: Obra[];
  tenantId: string;
  anio: number;
  mes: number;
  expanded: boolean;
  editando: { userId: string; fecha: string; jornadaId?: string } | null;
  onToggle: () => void;
  onSetEditando: (e: { userId: string; fecha: string; jornadaId?: string } | null) => void;
  onRefresh: () => void;
}) {
  const { user, dias_trabajados, dias_baja, tarifa_diaria, total_bruto, jornadas } = jornal;

  const jornadaMap: Record<string, Jornada> = {};
  jornadas.forEach(j => { jornadaMap[j.fecha] = j; });

  const diasMes = todosDiasMes(anio, mes);
  const hoy     = new Date().toISOString().split("T")[0];

  return (
    <div className="card overflow-hidden">
      {/* Cabecera */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-primary">{initials(user.nombre)}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-content-primary">{user.nombre}</p>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-content-muted">
              🏗️ <strong>{dias_trabajados}</strong> días fichados
            </span>
            {dias_baja > 0 && (
              <span className="text-xs text-content-muted">🏥 <strong>{dias_baja}</strong> baja</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="font-bold text-content-primary text-sm sm:text-base">{formatCurrency(total_bruto)}</p>
            {tarifa_diaria > 0 && (
              <p className="text-[10px] sm:text-xs text-content-muted">{formatCurrency(tarifa_diaria)}/día</p>
            )}
          </div>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-content-muted flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 text-content-muted flex-shrink-0" />}
        </div>
      </button>

      {/* Detalle */}
      {expanded && (
        <div className="border-t border-border">
          <div className="grid grid-cols-[72px_1fr_auto] gap-2 px-4 py-2 bg-gray-50 border-b border-border">
            <span className="text-[10px] font-semibold text-content-muted uppercase">Día</span>
            <span className="text-[10px] font-semibold text-content-muted uppercase">Estado / Obra</span>
            <span className="text-[10px] font-semibold text-content-muted uppercase">Acción</span>
          </div>

          <div className="divide-y divide-border">
            {diasMes.map(fecha => {
              const jornada    = jornadaMap[fecha];
              const esFuturo   = fecha > hoy;
              const isEditRow  = editando?.fecha === fecha;
              const info       = jornada ? estadoInfo(jornada.estado) : null;
              const obraNombre = obras.find(o => o.id === jornada?.obra_id)?.nombre;
              const fechaLabel = format(new Date(fecha + "T12:00:00"), "EEE d MMM", { locale: es });
              const dow        = getDay(new Date(fecha + "T12:00:00"));
              const esFinde    = dow === 0 || dow === 6;

              return (
                <div key={fecha}>
                  <div className={cn(
                    "grid grid-cols-[72px_1fr_auto] items-center gap-2 px-4 py-2.5 text-sm",
                    esFinde && !isEditRow && "bg-gray-50/80",
                    isEditRow && "bg-primary-light/20",
                  )}>
                    <span className={cn(
                      "text-xs font-medium capitalize leading-tight",
                      esFuturo ? "text-content-muted" : esFinde ? "text-gray-400" : "text-content-secondary",
                    )}>
                      {fechaLabel}
                    </span>

                    {jornada ? (
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border",
                          info?.color,
                        )}>
                          <span>{info?.emoji}</span>
                          <span className="hidden sm:inline">{info?.label}</span>
                        </span>
                        {obraNombre && (
                          <span className="text-xs text-content-muted truncate">{obraNombre}</span>
                        )}
                        {jornada.ha_fichado && (
                          <span className="text-[10px] text-success font-medium flex items-center gap-0.5">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-content-muted italic">
                        {esFuturo || esFinde ? "—" : "Sin fichar"}
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      {!esFuturo && !isEditRow && (
                        <>
                          {jornada ? (
                            <>
                              {/* Toggle fichado rápido */}
                              <ToggleFichadoBtn
                                jornada={jornada}
                                tenantId={tenantId}
                                onDone={onRefresh}
                              />
                              {/* Editar obra/estado */}
                              <button
                                onClick={() => onSetEditando({ userId: user.id, fecha, jornadaId: jornada.id })}
                                className="p-2 rounded-lg text-content-muted hover:bg-primary-light hover:text-primary transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                                title="Editar obra / estado"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <DeleteJornadaBtn jornadaId={jornada.id} onDone={onRefresh} />
                            </>
                          ) : (
                            <button
                              onClick={() => onSetEditando({ userId: user.id, fecha })}
                              className="p-2 rounded-lg text-content-muted hover:bg-success-light hover:text-success transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                              title="Añadir jornada"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                      {isEditRow && (
                        <button
                          onClick={() => onSetEditando(null)}
                          className="p-2 rounded-lg text-content-muted hover:bg-gray-100 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditRow && (
                    <JornadaInlineForm
                      userId={user.id}
                      tenantId={tenantId}
                      fecha={fecha}
                      jornadaExistente={jornada}
                      obras={obras}
                      onDone={() => { onSetEditando(null); onRefresh(); }}
                      onCancel={() => onSetEditando(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Pie */}
          <div className="px-4 py-3 bg-gray-50 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-content-muted">
            <span>
              {jornadas.length} jornada{jornadas.length !== 1 ? "s" : ""} registrada{jornadas.length !== 1 ? "s" : ""}
              {" "}de {diasMes.length} días del mes
            </span>
            {tarifa_diaria > 0 && (
              <span className="font-semibold text-content-primary">
                {dias_trabajados} × {formatCurrency(tarifa_diaria)} = {formatCurrency(total_bruto)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Botón de fichado rápido: toggle ha_fichado con un solo clic
function ToggleFichadoBtn({
  jornada, tenantId, onDone,
}: {
  jornada: Jornada;
  tenantId: string;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    await upsertJornada({
      userId:    jornada.user_id,
      tenantId,
      fecha:     jornada.fecha,
      estado:    jornada.estado as FichajeEstado,
      obraId:    jornada.obra_id,
      esLibre:   jornada.es_libre,
      haFichado: !jornada.ha_fichado,
    });
    setLoading(false);
    onDone();
  }

  if (jornada.ha_fichado) {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        title="Desmarcar fichado"
        className="p-2 rounded-lg bg-success-light text-success hover:bg-danger-light hover:text-danger transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title="Marcar como fichado"
      className="p-2 rounded-lg text-content-muted hover:bg-success-light hover:text-success transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
function DeleteJornadaBtn({ jornadaId, onDone }: { jornadaId: string; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading]       = useState(false);

  async function eliminar() {
    setLoading(true);
    await deleteJornada(jornadaId);
    setLoading(false);
    setConfirming(false);
    onDone();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button onClick={eliminar} disabled={loading}
          className="p-2 rounded-lg bg-danger-light text-danger hover:bg-danger hover:text-white transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => setConfirming(false)} className="p-2 rounded-lg text-content-muted hover:bg-gray-100 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="p-2 rounded-lg text-content-muted hover:bg-danger-light hover:text-danger transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
      title="Eliminar"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
function JornadaInlineForm({
  userId, tenantId, fecha, jornadaExistente, obras, onDone, onCancel,
}: {
  userId: string;
  tenantId: string;
  fecha: string;
  jornadaExistente?: Jornada;
  obras: Obra[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [estado, setEstado]     = useState<FichajeEstado>(
    (jornadaExistente?.estado as FichajeEstado) ?? "trabajando"
  );
  const [obraId, setObraId]     = useState(jornadaExistente?.obra_id ?? "");
  const [haFichado, setHaFichado] = useState(jornadaExistente?.ha_fichado ?? false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const necesitaObra = estado === "trabajando";

  async function guardar() {
    if (necesitaObra && !obraId) { setError("Selecciona una obra"); return; }
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await upsertJornada({
        userId,
        tenantId,
        fecha,
        estado,
        obraId: obraId || null,
        haFichado,
      });
      if (err) { setError("Error al guardar"); setSaving(false); return; }
      onDone();
    } catch { setError("Error de red"); setSaving(false); }
  }

  return (
    <div className="px-4 pb-3 pt-1 bg-primary-light/10 border-b border-primary/20 space-y-3">
      {/* Estado */}
      <div>
        <p className="text-xs font-semibold text-content-muted mb-1.5">Estado</p>
        <div className="flex flex-wrap gap-1.5">
          {ESTADOS.map(e => (
            <button
              key={e.value}
              type="button"
              onClick={() => { setEstado(e.value); setError(null); }}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                estado === e.value ? e.color + " ring-2 ring-offset-1 ring-current/30" : "border-border text-content-secondary hover:border-primary/50",
              )}
            >
              {e.emoji} {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Obra */}
      {necesitaObra && (
        <div>
          <p className="text-xs font-semibold text-content-muted mb-1.5">Obra</p>
          <select
            className="input py-1.5 text-sm"
            value={obraId}
            onChange={e => { setObraId(e.target.value); setError(null); }}
          >
            <option value="">Selecciona obra…</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        </div>
      )}

      {/* Toggle fichado */}
      <button
        type="button"
        onClick={() => setHaFichado(v => !v)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
          haFichado
            ? "border-success bg-success-light text-success"
            : "border-border text-content-secondary hover:border-primary/40",
        )}
      >
        <div className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
          haFichado ? "bg-success border-success" : "border-content-muted",
        )}>
          {haFichado && <Check className="w-3 h-3 text-white" />}
        </div>
        {haFichado ? "✅ Marcado como fichado" : "⬜ No fichado (solo planificado)"}
      </button>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary py-1.5 px-3 text-sm flex-1">Cancelar</button>
        <button onClick={guardar} disabled={saving} className="btn-primary py-1.5 px-3 text-sm flex-1">
          {saving
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…</>
            : <><Check className="w-3.5 h-3.5" /> {jornadaExistente ? "Actualizar" : "Guardar"}</>}
        </button>
      </div>
    </div>
  );
}
