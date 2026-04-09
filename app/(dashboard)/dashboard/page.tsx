"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock, CheckCircle2, Building2, ChevronRight,
  ShoppingCart, Camera, Loader2, ArrowRight, Zap,
} from "lucide-react";
import { useAuthStore, useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import { useRefreshOnFocus } from "@/lib/hooks/useRefreshOnFocus";
import { upsertJornada, updatePago } from "@/lib/insforge/database";
import { initials } from "@/lib/utils/format";
import type { PagoEstado } from "@/types";

// ── Tipos ──────────────────────────────────────────────────────────────────────
export interface FichajeEmpleado {
  user_id:    string;
  nombre:     string;
  obra_nombre: string | null;
  obra_id:    string | null;
  ha_fichado: boolean;
  fichado_at: string | null;
  jornada_id: string | null;
}

export interface Alerta {
  id:            string;
  obra_nombre:   string;
  concepto:      string;
  importe_total: number;
  fecha_prevista: string;
  estado:        string;
  dias_diff:     number;
}

export interface ActividadItem {
  id:          string;
  tipo:        "fichaje" | "material_pedido" | "material_comprado" | "foto";
  user_nombre: string;
  obra_nombre: string | null;
  descripcion: string;
  created_at:  string;
}

export interface DashboardData {
  hoy:        string;
  fichajeHoy: FichajeEmpleado[];
  obras:      { total: number; empleados_hoy: number };
  alertas:    Alerta[];
  actividad:  ActividadItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
export function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24)    return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ayer" : `hace ${d}d`;
}

export function formatEuro(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(n);
}

function getGreeting(nombre: string): string {
  const h = new Date().getHours();
  const prefix = h < 12 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
  return `${prefix}, ${nombre.split(" ")[0]} 👋`;
}

function formatFecha(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long",
  });
}

export function alertaColor(dias: number) {
  if (dias < 0)   return { bg: "#FEF2F2", border: "#EF4444", text: "#991B1B", label: `venció hace ${Math.abs(dias)}d` };
  if (dias === 0) return { bg: "#FFFBEB", border: "#F59E0B", text: "#92400E", label: "vence hoy" };
  if (dias <= 3)  return { bg: "#FFF7ED", border: "#FB923C", text: "#9A3412", label: `vence en ${dias}d` };
  return           { bg: "#EFF6FF", border: "#607eaa", text: "#1c3879", label: `vence en ${dias}d` };
}

export const actividadConfig = {
  fichaje:           { icon: Clock,         color: "#607eaa", bg: "#EEF2F8" },
  material_pedido:   { icon: ShoppingCart,  color: "#F59E0B", bg: "#FFFBEB" },
  material_comprado: { icon: CheckCircle2,  color: "#10B981", bg: "#D1FAE5" },
  foto:              { icon: Camera,        color: "#8B5CF6", bg: "#F5F3FF" },
};

// ── Componente: Fila de empleado fichaje ──────────────────────────────────────
function FichajeRow({ emp, procesando, onFichar }: {
  emp: FichajeEmpleado; procesando: boolean; onFichar: () => void;
}) {
  // Siempre formatear en hora de España (el servidor guarda en UTC)
  const hora = emp.fichado_at
    ? new Date(emp.fichado_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })
    : null;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
      style={{ background: emp.ha_fichado ? "transparent" : "rgba(254,242,242,0.5)" }}
    >
      {/* Status dot */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: emp.ha_fichado ? "#10B981" : "#EF4444" }}
      />

      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold"
        style={{ background: "linear-gradient(135deg, #1c3879 0%, #607eaa 100%)" }}
      >
        {initials(emp.nombre)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight truncate" style={{ color: "#111827" }}>
          {emp.nombre}
        </p>
        {emp.obra_nombre && (
          <p className="text-xs truncate" style={{ color: "#94A3B8" }}>{emp.obra_nombre}</p>
        )}
      </div>

      {/* Badge + acción */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {emp.ha_fichado ? (
          <>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "#D1FAE5", color: "#065F46" }}>
              ✓ {hora}
            </span>
            <button
              onClick={onFichar} disabled={procesando}
              className="text-[11px] px-2 py-0.5 rounded-lg border transition-colors"
              style={{ borderColor: "#E5E7EB", color: "#9CA3AF", background: "#fff" }}
              title="Quitar fichaje"
            >
              {procesando ? <Loader2 className="w-3 h-3 animate-spin" /> : "Reset"}
            </button>
          </>
        ) : (
          <>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "#FEE2E2", color: "#991B1B" }}>
              Sin fichar
            </span>
            <button
              onClick={onFichar} disabled={procesando}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95"
              style={{ background: "#607eaa", color: "#fff" }}
            >
              {procesando ? <Loader2 className="w-3 h-3 animate-spin" /> : "Fichar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Componente: Fila de actividad ─────────────────────────────────────────────
export function ActividadRow({ item, last }: { item: ActividadItem; last: boolean }) {
  const cfg  = actividadConfig[item.tipo];
  const Icon = cfg.icon;
  return (
    <div className={`flex items-start gap-3 py-2.5 ${!last ? "border-b" : ""}`}
      style={{ borderColor: "#F3F4F6" }}>
      <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
        <div className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: cfg.bg }}>
          <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
        </div>
        {!last && <div className="w-px mt-1.5" style={{ height: 8, background: "#F3F4F6" }} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug" style={{ color: "#374151" }}>
          <span className="font-semibold">{item.user_nombre}</span>{" "}
          {item.descripcion}
          {item.obra_nombre && (
            <span style={{ color: "#94A3B8" }}> · {item.obra_nombre}</span>
          )}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "#9CA3AF" }}>
          {tiempoRelativo(item.created_at)}
        </p>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="p-4 md:p-8 w-full">
      <div className="h-8 w-64 rounded-xl animate-pulse mb-2" style={{ background: "#E5E7EB" }} />
      <div className="h-4 w-40 rounded-lg animate-pulse mb-8" style={{ background: "#E5E7EB" }} />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "#F3F4F6" }} />
          ))}
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="h-32 rounded-2xl animate-pulse" style={{ background: "#F3F4F6" }} />
          <div className="h-24 rounded-2xl animate-pulse" style={{ background: "#F3F4F6" }} />
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router   = useRouter();
  const user     = useAuthStore((s) => s.user);
  const isAdmin  = useIsAdmin();
  const tenantId = useTenantId();

  const [data,       setData]       = useState<DashboardData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [cobrando,   setCobrando]   = useState<string | null>(null);

  useEffect(() => { if (user && !isAdmin) router.replace("/obras"); }, [user, isAdmin, router]);

  const cargar = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/dashboard/data?tenantId=${tenantId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { if (tenantId) cargar(); }, [tenantId, cargar]);
  useRefreshOnFocus(() => { if (tenantId) cargar(); });

  async function handleFichar(emp: FichajeEmpleado) {
    if (!tenantId || procesando) return;
    setProcesando(emp.user_id);
    const nuevoFichado = !emp.ha_fichado;
    const hoy = new Date().toISOString().split("T")[0];
    setData((prev) => {
      if (!prev) return prev;
      const updated = prev.fichajeHoy.map((e) =>
        e.user_id === emp.user_id
          ? { ...e, ha_fichado: nuevoFichado, fichado_at: nuevoFichado ? new Date().toISOString() : null }
          : e
      );
      // Reordenar: fichados primero, sin fichar al final
      updated.sort((a, b) => {
        if (a.ha_fichado !== b.ha_fichado) return a.ha_fichado ? -1 : 1;
        return a.nombre.localeCompare(b.nombre, "es");
      });
      return { ...prev, fichajeHoy: updated };
    });
    await upsertJornada({ userId: emp.user_id, tenantId, fecha: hoy, estado: "trabajando", obraId: emp.obra_id ?? undefined, haFichado: nuevoFichado });
    setProcesando(null);
    cargar();
  }

  async function handleCobrar(alertaId: string) {
    if (cobrando) return;
    setCobrando(alertaId);
    setData((prev) => prev ? { ...prev, alertas: prev.alertas.filter((a) => a.id !== alertaId) } : prev);
    const hoy = new Date().toISOString().split("T")[0];
    await updatePago(alertaId, { estado: "cobrada" as PagoEstado, fecha_cobro: hoy });
    setCobrando(null);
  }

  if (loading) return <LoadingSkeleton />;
  if (!data)   return null;

  const fichados       = data.fichajeHoy.filter((e) => e.ha_fichado).length;
  const totalEmp       = data.fichajeHoy.length;
  const todosHanFichado = totalEmp > 0 && fichados === totalEmp;
  const actividadPreview = data.actividad.slice(0, 4);

  return (
    <div className="p-4 md:p-8 w-full max-w-none">

      {/* ── Cabecera ────────────────────────────────────────────────────────── */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#1c3879" }}>
          {user ? getGreeting(user.nombre) : "Dashboard"}
        </h1>
        <p className="text-sm mt-1 capitalize" style={{ color: "#94A3B8" }}>
          {data.hoy ? formatFecha(data.hoy) : ""}
        </p>
      </div>

      {/* ── Grid principal ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

        {/* ── Columna izquierda (3/5): solo fichaje ───────────────────────── */}
        <div className="lg:col-span-3">

          {/* FICHAJE DE HOY */}
          <div className="card overflow-hidden">
            {/* Header card */}
            <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid #F3F4F6" }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>
                  Fichaje de hoy
                </h2>
                {totalEmp > 0 && (
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{
                      background: todosHanFichado ? "#D1FAE5" : "#FEE2E2",
                      color:      todosHanFichado ? "#065F46"  : "#991B1B",
                    }}
                  >
                    {fichados} / {totalEmp}
                  </span>
                )}
              </div>
              {/* Barra de progreso */}
              {totalEmp > 0 && (
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#F3F4F6" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(fichados / totalEmp) * 100}%`,
                      background: todosHanFichado
                        ? "linear-gradient(90deg, #10B981, #34D399)"
                        : "linear-gradient(90deg, #607eaa, #26bbec)",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Lista empleados */}
            <div className="px-3 py-3">
              {totalEmp === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#F3F4F6" }}>
                    <Clock className="w-5 h-5" style={{ color: "#D1D5DB" }} />
                  </div>
                  <p className="text-sm" style={{ color: "#9CA3AF" }}>No hay empleados asignados hoy</p>
                </div>
              ) : (
                <>
                  {todosHanFichado && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-2"
                      style={{ background: "#D1FAE5" }}>
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#065F46" }} />
                      <p className="text-sm font-semibold" style={{ color: "#065F46" }}>
                        ¡Todo el equipo ha fichado hoy! 🎉
                      </p>
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {data.fichajeHoy.map((emp) => (
                      <FichajeRow
                        key={emp.user_id}
                        emp={emp}
                        procesando={procesando === emp.user_id}
                        onFichar={() => handleFichar(emp)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>

        {/* ── Columna derecha (2/5) ────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* OBRAS ACTIVAS — stat card con gradiente */}
          <Link href="/obras">
            <div
              className="rounded-2xl p-5 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: "linear-gradient(135deg, #1c3879 0%, #607eaa 100%)",
                boxShadow: "0 4px 24px rgba(28,56,121,0.25)",
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                >
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <ChevronRight className="w-5 h-5" style={{ color: "rgba(255,255,255,0.5)" }} />
              </div>
              <p className="text-4xl font-bold text-white mb-1">{data.obras.total}</p>
              <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
                obra{data.obras.total !== 1 ? "s" : ""} activa{data.obras.total !== 1 ? "s" : ""}
              </p>
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {data.obras.empleados_hoy} empleado{data.obras.empleados_hoy !== 1 ? "s" : ""} asignado{data.obras.empleados_hoy !== 1 ? "s" : ""} hoy
                </p>
              </div>
            </div>
          </Link>

          {/* ALERTAS DE COBRO */}
          {data.alertas.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid #F3F4F6" }}>
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>
                  Alertas de cobro
                </h2>
              </div>
              <div className="p-3 space-y-2">
                {data.alertas.map((alerta) => {
                  const c = alertaColor(alerta.dias_diff);
                  return (
                    <div
                      key={alerta.id}
                      className="rounded-xl p-3"
                      style={{ background: c.bg, borderLeft: `3px solid ${c.border}` }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>
                            {alerta.obra_nombre}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: c.border, color: "#fff" }}>
                              {c.label}
                            </span>
                            <span className="text-xs font-semibold" style={{ color: c.text }}>
                              {formatEuro(alerta.importe_total)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCobrar(alerta.id)}
                        disabled={cobrando === alerta.id}
                        className="w-full text-xs font-semibold py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95"
                        style={{ background: "#10B981", color: "#fff" }}
                      >
                        {cobrando === alerta.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <><CheckCircle2 className="w-3 h-3" /> Marcar cobrada</>
                        }
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Estado vacío: nada pendiente */}
          {data.alertas.length === 0 && data.fichajeHoy.length > 0 && (
            <div
              className="rounded-2xl p-5 flex flex-col items-center text-center gap-2"
              style={{ background: "#F0FDF4", border: "1px solid #D1FAE5" }}
            >
              <CheckCircle2 className="w-8 h-8" style={{ color: "#10B981" }} />
              <p className="text-sm font-semibold" style={{ color: "#065F46" }}>Sin cobros pendientes</p>
              <p className="text-xs" style={{ color: "#6EE7B7" }}>Todo al día 🎉</p>
            </div>
          )}

        </div>
      </div>

      {/* ── Actividad reciente — siempre al final, full-width ─────────────── */}
      {data.actividad.length > 0 && (
        <div className="card overflow-hidden mt-5">
          <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid #F3F4F6" }}>
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#94A3B8" }}>
              Actividad reciente
            </h2>
          </div>
          <div className="px-5 py-3">
            {actividadPreview.map((item, i) => (
              <ActividadRow
                key={item.id}
                item={item}
                last={i === actividadPreview.length - 1 && data.actividad.length <= 4}
              />
            ))}
          </div>
          {data.actividad.length > 4 && (
            <Link
              href="/dashboard/actividad"
              className="flex items-center justify-center gap-2 py-3.5 transition-colors"
              style={{ borderTop: "1px solid #F3F4F6", color: "#607eaa", fontSize: 13, fontWeight: 600 }}
            >
              Ver toda la actividad
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}

      {/* ── Empty state total ──────────────────────────────────────────────── */}
      {data.actividad.length === 0 && data.fichajeHoy.length === 0 && (
        <div className="mt-8 card p-12 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #EEF2F8, #e0eaff)" }}>
            <Zap className="w-8 h-8" style={{ color: "#607eaa" }} />
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color: "#1c3879" }}>Sin actividad hoy</p>
            <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
              Cuando el equipo empiece a trabajar, aquí verás todo en tiempo real.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
