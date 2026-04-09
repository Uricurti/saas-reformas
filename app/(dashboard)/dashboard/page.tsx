"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock, CheckCircle2, Building2, ChevronRight,
  ShoppingCart, Camera, Loader2, AlertCircle,
  BadgeEuro, UserCheck, Zap,
} from "lucide-react";
import { useAuthStore, useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import { useRefreshOnFocus } from "@/lib/hooks/useRefreshOnFocus";
import { upsertJornada, updatePago } from "@/lib/insforge/database";
import { initials } from "@/lib/utils/format";
import type { PagoEstado } from "@/types";

// ── Tipos locales ──────────────────────────────────────────────────────────────
interface FichajeEmpleado {
  user_id:    string;
  nombre:     string;
  obra_nombre: string | null;
  obra_id:    string | null;
  ha_fichado: boolean;
  fichado_at: string | null;
  jornada_id: string | null;
}

interface Alerta {
  id:            string;
  obra_nombre:   string;
  concepto:      string;
  importe_total: number;
  fecha_prevista: string;
  estado:        string;
  dias_diff:     number;
}

interface ActividadItem {
  id:          string;
  tipo:        "fichaje" | "material_pedido" | "material_comprado" | "foto";
  user_nombre: string;
  obra_nombre: string | null;
  descripcion: string;
  created_at:  string;
}

interface DashboardData {
  hoy:        string;
  fichajeHoy: FichajeEmpleado[];
  obras:      { total: number; empleados_hoy: number };
  alertas:    Alerta[];
  actividad:  ActividadItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function tiempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24)    return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ayer" : `hace ${d}d`;
}

function formatEuro(n: number): string {
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

function alertaColor(dias: number): { bg: string; border: string; text: string; label: string } {
  if (dias < 0)  return { bg: "#FEF2F2", border: "#EF4444", text: "#991B1B", label: `venció hace ${Math.abs(dias)}d` };
  if (dias === 0) return { bg: "#FFFBEB", border: "#F59E0B", text: "#92400E", label: "vence hoy" };
  if (dias <= 3)  return { bg: "#FFF7ED", border: "#FB923C", text: "#9A3412", label: `vence en ${dias}d` };
  return         { bg: "#EFF6FF", border: "#607eaa", text: "#1c3879", label: `vence en ${dias}d` };
}

const actividadConfig = {
  fichaje:          { icon: Clock,          color: "#607eaa", bg: "#EEF2F8" },
  material_pedido:  { icon: ShoppingCart,   color: "#F59E0B", bg: "#FFFBEB" },
  material_comprado:{ icon: CheckCircle2,   color: "#10B981", bg: "#D1FAE5" },
  foto:             { icon: Camera,         color: "#8B5CF6", bg: "#F5F3FF" },
};

// ── Sub-componentes ────────────────────────────────────────────────────────────

function SectionCard({ title, badge, badgeOk, children }: {
  title: string; badge?: string; badgeOk?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "#94A3B8" }}>
          {title}
        </h2>
        {badge && (
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{
              background: badgeOk ? "#D1FAE5" : "#FEE2E2",
              color:      badgeOk ? "#065F46" : "#991B1B",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function FichajeRow({
  emp, procesando, onFichar,
}: {
  emp: FichajeEmpleado; procesando: boolean; onFichar: () => void;
}) {
  const hora = emp.fichado_at
    ? new Date(emp.fichado_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      className="flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors"
      style={{ background: emp.ha_fichado ? "#F9FAFB" : "#FFFBEB" }}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
        style={{ background: "linear-gradient(135deg, #1c3879 0%, #607eaa 100%)" }}
      >
        {initials(emp.nombre)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>
          {emp.nombre}
        </p>
        {emp.obra_nombre && (
          <p className="text-xs truncate" style={{ color: "#94A3B8" }}>
            {emp.obra_nombre}
          </p>
        )}
      </div>

      {/* Estado + acción */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {emp.ha_fichado ? (
          <>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "#D1FAE5", color: "#065F46" }}
            >
              ✓ {hora}
            </span>
            <button
              onClick={onFichar}
              disabled={procesando}
              className="text-[11px] px-2 py-0.5 rounded-lg border transition-colors"
              style={{ borderColor: "#E5E7EB", color: "#9CA3AF", background: "#fff" }}
              title="Quitar fichaje"
            >
              {procesando ? <Loader2 className="w-3 h-3 animate-spin" /> : "Reset"}
            </button>
          </>
        ) : (
          <>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "#FEE2E2", color: "#991B1B" }}
            >
              Sin fichar
            </span>
            <button
              onClick={onFichar}
              disabled={procesando}
              className="text-[11px] font-semibold px-3 py-1 rounded-lg transition-all active:scale-95"
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

function AlertaRow({
  alerta, cobrando, onCobrar,
}: {
  alerta: Alerta; cobrando: boolean; onCobrar: () => void;
}) {
  const c = alertaColor(alerta.dias_diff);
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: c.bg, borderLeft: `3px solid ${c.border}` }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>
            {alerta.obra_nombre}
          </p>
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: c.border, color: "#fff" }}
          >
            {c.label}
          </span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: c.text }}>
          {formatEuro(alerta.importe_total)}
          {alerta.concepto ? ` · ${alerta.concepto}` : ""}
        </p>
      </div>
      <button
        onClick={onCobrar}
        disabled={cobrando}
        className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95 flex items-center gap-1"
        style={{ background: "#10B981", color: "#fff" }}
      >
        {cobrando
          ? <Loader2 className="w-3 h-3 animate-spin" />
          : <><CheckCircle2 className="w-3 h-3" /> Cobrada</>
        }
      </button>
    </div>
  );
}

function ActividadRow({ item, last }: { item: ActividadItem; last: boolean }) {
  const cfg = actividadConfig[item.tipo];
  const Icon = cfg.icon;

  return (
    <div className={`flex items-start gap-3 py-2.5 ${!last ? "border-b border-gray-50" : ""}`}>
      {/* Línea vertical + icono */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ marginTop: 2 }}>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: cfg.bg }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
        </div>
        {!last && (
          <div className="w-px flex-1 mt-1" style={{ background: "#F3F4F6", minHeight: 8 }} />
        )}
      </div>

      {/* Texto */}
      <div className="flex-1 min-w-0 pb-0.5">
        <p className="text-sm leading-snug" style={{ color: "#374151" }}>
          <span className="font-semibold">{item.user_nombre}</span>
          {" "}
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

function LoadingSkeleton() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <div className="h-7 w-48 rounded-xl animate-pulse" style={{ background: "#E5E7EB" }} />
        <div className="h-4 w-32 rounded-lg mt-2 animate-pulse" style={{ background: "#E5E7EB" }} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-4">
          <div className="h-4 w-32 rounded-lg mb-4 animate-pulse" style={{ background: "#E5E7EB" }} />
          <div className="space-y-3">
            {[1, 2].map((j) => (
              <div key={j} className="h-12 rounded-xl animate-pulse" style={{ background: "#F3F4F6" }} />
            ))}
          </div>
        </div>
      ))}
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
  const [procesando, setProcesando] = useState<string | null>(null); // user_id en proceso
  const [cobrando,   setCobrando]   = useState<string | null>(null); // pago_id en proceso

  // Guard: solo admin
  useEffect(() => {
    if (user && !isAdmin) router.replace("/obras");
  }, [user, isAdmin, router]);

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

  // ── Fichar / reset fichaje ─────────────────────────────────────────────────
  async function handleFichar(emp: FichajeEmpleado) {
    if (!tenantId || procesando) return;
    setProcesando(emp.user_id);

    const nuevoFichado = !emp.ha_fichado;
    const hoy = new Date().toISOString().split("T")[0];

    // Optimistic update
    setData((prev) =>
      prev
        ? {
            ...prev,
            fichajeHoy: prev.fichajeHoy.map((e) =>
              e.user_id === emp.user_id
                ? { ...e, ha_fichado: nuevoFichado, fichado_at: nuevoFichado ? new Date().toISOString() : null }
                : e
            ),
          }
        : prev
    );

    await upsertJornada({
      userId:    emp.user_id,
      tenantId,
      fecha:     hoy,
      estado:    "trabajando",
      obraId:    emp.obra_id ?? undefined,
      haFichado: nuevoFichado,
    });

    setProcesando(null);
    // Recarga el feed de actividad
    cargar();
  }

  // ── Marcar pago como cobrado ───────────────────────────────────────────────
  async function handleCobrar(alertaId: string) {
    if (cobrando) return;
    setCobrando(alertaId);

    // Optimistic update
    setData((prev) =>
      prev ? { ...prev, alertas: prev.alertas.filter((a) => a.id !== alertaId) } : prev
    );

    const hoy = new Date().toISOString().split("T")[0];
    await updatePago(alertaId, { estado: "cobrada" as PagoEstado, fecha_cobro: hoy });
    setCobrando(null);
  }

  if (loading) return <LoadingSkeleton />;
  if (!data)   return null;

  const fichados = data.fichajeHoy.filter((e) => e.ha_fichado).length;
  const totalEmp = data.fichajeHoy.length;
  const todosHanFichado = totalEmp > 0 && fichados === totalEmp;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">

      {/* ── Saludo ──────────────────────────────────────────────────────────── */}
      <div className="pt-1">
        <h1 className="text-2xl font-bold" style={{ color: "#1c3879" }}>
          {user ? getGreeting(user.nombre) : "Dashboard"}
        </h1>
        <p className="text-sm mt-0.5 capitalize" style={{ color: "#94A3B8" }}>
          {data.hoy ? formatFecha(data.hoy) : ""}
        </p>
      </div>

      {/* ── Fichaje de hoy ──────────────────────────────────────────────────── */}
      <SectionCard
        title="Fichaje de hoy"
        badge={totalEmp > 0 ? `${fichados} / ${totalEmp}` : undefined}
        badgeOk={todosHanFichado}
      >
        {totalEmp === 0 ? (
          <div className="flex items-center gap-3 py-4 text-center justify-center">
            <UserCheck className="w-5 h-5" style={{ color: "#D1D5DB" }} />
            <p className="text-sm" style={{ color: "#9CA3AF" }}>No hay empleados asignados hoy</p>
          </div>
        ) : (
          <>
            {todosHanFichado && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3"
                style={{ background: "#D1FAE5" }}
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#065F46" }} />
                <p className="text-sm font-semibold" style={{ color: "#065F46" }}>
                  ¡Todo el equipo ha fichado hoy! 🎉
                </p>
              </div>
            )}
            <div className="space-y-1.5">
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
      </SectionCard>

      {/* ── Alertas de cobro (solo si hay) ──────────────────────────────────── */}
      {data.alertas.length > 0 && (
        <SectionCard title="Alertas de cobro">
          <div className="space-y-2">
            {data.alertas.map((alerta) => (
              <AlertaRow
                key={alerta.id}
                alerta={alerta}
                cobrando={cobrando === alerta.id}
                onCobrar={() => handleCobrar(alerta.id)}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Obras activas (chip clicable) ────────────────────────────────────── */}
      <Link href="/obras">
        <div
          className="card p-4 flex items-center gap-4 cursor-pointer transition-all hover:shadow-md active:scale-[0.99]"
          style={{ borderLeft: "4px solid #607eaa" }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#EEF2F8" }}
          >
            <Building2 className="w-5 h-5" style={{ color: "#607eaa" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold" style={{ color: "#1c3879" }}>
              <span className="text-xl">{data.obras.total}</span>
              {" "}
              <span className="text-base">
                obra{data.obras.total !== 1 ? "s" : ""} activa{data.obras.total !== 1 ? "s" : ""}
              </span>
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              {data.obras.empleados_hoy} empleado{data.obras.empleados_hoy !== 1 ? "s" : ""} asignado{data.obras.empleados_hoy !== 1 ? "s" : ""} hoy
            </p>
          </div>
          <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: "#CBD5E1" }} />
        </div>
      </Link>

      {/* ── Actividad reciente ───────────────────────────────────────────────── */}
      {data.actividad.length > 0 && (
        <SectionCard title="Actividad reciente">
          <div>
            {data.actividad.map((item, i) => (
              <ActividadRow
                key={item.id}
                item={item}
                last={i === data.actividad.length - 1}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Estado vacío total ───────────────────────────────────────────────── */}
      {data.actividad.length === 0 && data.fichajeHoy.length === 0 && (
        <div className="card p-8 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#EEF2F8" }}>
            <Zap className="w-7 h-7" style={{ color: "#607eaa" }} />
          </div>
          <p className="font-semibold" style={{ color: "#1c3879" }}>Sin actividad hoy</p>
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            Cuando el equipo empiece a trabajar, aquí verás todo en tiempo real.
          </p>
        </div>
      )}

    </div>
  );
}
