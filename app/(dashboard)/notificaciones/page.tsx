"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore, useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import { useNotificacionesStore } from "@/lib/stores/notificaciones-store";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Bell, Check, CheckCheck, Trash2,
  BarChart2, Users, Mail, Smartphone, Eye, EyeOff, Loader2,
} from "lucide-react";
import { formatRelative } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import type { Notificacion } from "@/types";

const tipoIconos: Record<string, string> = {
  asignacion_nueva:   "📍",
  asignacion_cambio:  "🔀",
  material_pedido:    "🛒",
  fichaje_pendiente:  "⏰",
  foto_subida:        "📷",
};
const tipoLabel: Record<string, string> = {
  asignacion_nueva:   "Asignación nueva",
  asignacion_cambio:  "Cambio asignación",
  material_pedido:    "Material pedido",
  fichaje_pendiente:  "Fichaje pendiente",
  foto_subida:        "Foto subida",
};

// ─── Umbrales de swipe ────────────────────────────────────────────────────────
const REVEAL_THRESHOLD  = 72;
const DELETE_THRESHOLD  = 160;

// ─── Tarjeta con swipe ────────────────────────────────────────────────────────
function SwipeCard({
  notif, onDelete, onMarkRead,
}: {
  notif: Notificacion; onDelete: (id: string) => void; onMarkRead: (id: string) => void;
}) {
  const [offset,   setOffset]   = useState(0);
  const [snapping, setSnapping] = useState(false);
  const [leaving,  setLeaving]  = useState(false);
  const startX    = useRef(0);
  const startY    = useRef(0);
  const dragging  = useRef(false);
  const lockedDir = useRef<"h" | "v" | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startX.current = e.clientX; startY.current = e.clientY;
    dragging.current = true; lockedDir.current = null;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (!lockedDir.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      lockedDir.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (lockedDir.current === "v") return;
    e.preventDefault();
    if (dx > 0) { setOffset(0); return; }
    const raw = Math.abs(dx);
    const clamped = raw > DELETE_THRESHOLD ? DELETE_THRESHOLD + (raw - DELETE_THRESHOLD) * 0.15 : raw;
    setOffset(-clamped);
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    const abs = Math.abs(offset);
    if (abs >= DELETE_THRESHOLD) {
      setSnapping(true); setLeaving(true); setOffset(-400);
      setTimeout(() => onDelete(notif.id), 320);
    } else if (abs >= REVEAL_THRESHOLD) {
      setSnapping(true); setOffset(-REVEAL_THRESHOLD);
      setTimeout(() => setSnapping(false), 300);
    } else {
      setSnapping(true); setOffset(0);
      setTimeout(() => setSnapping(false), 300);
    }
  }, [offset, notif.id, onDelete]);

  const closeReveal = useCallback(() => {
    if (offset < 0 && Math.abs(offset) <= REVEAL_THRESHOLD + 4) {
      setSnapping(true); setOffset(0);
      setTimeout(() => setSnapping(false), 300);
    }
  }, [offset]);

  const revealed = Math.abs(offset) >= REVEAL_THRESHOLD - 4;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", leaving && "transition-all duration-300 opacity-0 scale-y-0 max-h-0 mb-0")}>
      <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-5 rounded-2xl"
        style={{ background: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)", width: Math.max(0, Math.abs(offset) + 20), opacity: Math.min(1, Math.abs(offset) / REVEAL_THRESHOLD), transition: snapping ? "width 0.3s cubic-bezier(0.25,1,0.5,1)" : "none" }}>
        <button onPointerDown={(e) => { e.stopPropagation(); onDelete(notif.id); }} className="flex flex-col items-center gap-1 text-white" style={{ opacity: revealed ? 1 : 0, transition: "opacity 0.15s" }}>
          <Trash2 className="w-5 h-5" /><span className="text-[10px] font-semibold tracking-wide">BORRAR</span>
        </button>
      </div>
      <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onClick={() => { if (Math.abs(offset) > 5) { closeReveal(); return; } if (!notif.leida) onMarkRead(notif.id); }}
        className={cn("card p-4 flex items-start gap-3 text-left select-none touch-pan-y cursor-pointer", !notif.leida && "border-l-4 border-l-primary", "active:brightness-95")}
        style={{ transform: `translateX(${offset}px)`, transition: snapping ? "transform 0.3s cubic-bezier(0.25,1,0.5,1)" : "none", willChange: "transform", userSelect: "none" }}>
        <span className="text-2xl flex-shrink-0 mt-0.5">{tipoIconos[notif.tipo] ?? "🔔"}</span>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium", notif.leida ? "text-content-secondary" : "text-content-primary")}>{notif.titulo}</p>
          <p className="text-xs text-content-muted mt-0.5">{notif.mensaje}</p>
          <p className="text-xs text-content-muted mt-1">{formatRelative(notif.created_at)}</p>
        </div>
        {!notif.leida ? <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" /> : <Check className="w-4 h-4 text-content-muted flex-shrink-0 mt-1" />}
      </div>
    </div>
  );
}

// ─── Dashboard de actividad (admin) ──────────────────────────────────────────
function ActividadDashboard({ tenantId }: { tenantId: string }) {
  const [datos, setDatos]       = useState<any>(null);
  const [push, setPush]         = useState<{ total: number; activos: number } | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const [resNotif, resPush] = await Promise.all([
        fetch(`/api/admin/notificaciones?tenantId=${tenantId}`),
        fetch("/api/admin/onesignal-stats"),
      ]);
      if (resNotif.ok) setDatos(await resNotif.json());
      if (resPush.ok)  setPush(await resPush.json());
      setCargando(false);
    }
    cargar();
  }, [tenantId]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { stats, porUsuario, recientes } = datos ?? {};

  return (
    <div className="space-y-6">

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Bell className="w-5 h-5" />} label="Total enviadas" value={stats?.total ?? 0} color="#607eaa" />
        <StatCard icon={<Eye className="w-5 h-5" />}  label="% leídas"       value={`${stats?.pctLeidas ?? 0}%`} color="#10b981"
          sub={`${stats?.leidas ?? 0} de ${stats?.total ?? 0}`} />
        <StatCard icon={<Users className="w-5 h-5" />} label="Usuarios activos" value={stats?.usuariosConNotif ?? 0} color="#f59e0b" />
        <StatCard icon={<Smartphone className="w-5 h-5" />} label="Push suscritos" value={push?.activos ?? "—"} color="#8b5cf6"
          sub={push ? `${push.total} registrados` : undefined} />
      </div>

      {/* ── Tabla por usuario ── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-content-primary text-sm">Por usuario</h3>
        </div>
        {!porUsuario?.length ? (
          <p className="p-5 text-sm text-content-muted">Sin datos todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Usuario</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Leídas</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-content-muted uppercase tracking-wide">Sin leer</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-content-muted uppercase tracking-wide hidden sm:table-cell">% leído</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-content-muted uppercase tracking-wide hidden md:table-cell">Última</th>
                </tr>
              </thead>
              <tbody>
                {porUsuario.map((u: any) => {
                  const pct = u.total > 0 ? Math.round((u.leidas / u.total) * 100) : 0;
                  return (
                    <tr key={u.userId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">{u.nombre.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-medium text-content-primary">{u.nombre}</p>
                            {u.email && <p className="text-xs text-content-muted">{u.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-4 py-3 font-semibold text-content-primary">{u.total}</td>
                      <td className="text-center px-4 py-3">
                        <span className="text-emerald-600 font-semibold">{u.leidas}</span>
                      </td>
                      <td className="text-center px-4 py-3">
                        {u.noLeidas > 0
                          ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold">{u.noLeidas}</span>
                          : <span className="text-content-muted">—</span>}
                      </td>
                      <td className="text-center px-4 py-3 hidden sm:table-cell">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-content-muted w-8">{pct}%</span>
                        </div>
                      </td>
                      <td className="text-right px-5 py-3 text-xs text-content-muted hidden md:table-cell">
                        {formatRelative(u.ultima)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Log de actividad reciente ── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-content-primary text-sm">Actividad reciente</h3>
          <span className="ml-auto text-xs text-content-muted">Últimas 50</span>
        </div>
        {!recientes?.length ? (
          <p className="p-5 text-sm text-content-muted">Sin actividad todavía.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recientes.map((n: any) => (
              <div key={n.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <span className="text-xl flex-shrink-0">{tipoIconos[n.tipo] ?? "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-content-primary">{n.nombre}</span>
                    <span className="text-xs text-content-muted">·</span>
                    <span className="text-xs text-content-muted">{tipoLabel[n.tipo] ?? n.tipo}</span>
                  </div>
                  <p className="text-xs text-content-muted truncate mt-0.5">{n.titulo}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {n.leida
                    ? <Eye className="w-3.5 h-3.5 text-emerald-500" title="Leída" />
                    : <EyeOff className="w-3.5 h-3.5 text-content-muted" title="No leída" />}
                  <span className="text-xs text-content-muted hidden sm:block">{formatRelative(n.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, sub }: {
  icon: React.ReactNode; label: string; value: string | number; color: string; sub?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + "18", color }}>
          {icon}
        </div>
        <span className="text-xs text-content-muted font-medium">{label}</span>
      </div>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-content-muted mt-1">{sub}</p>}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function NotificacionesPage() {
  const user     = useAuthStore((s) => s.user);
  const isAdmin  = useIsAdmin();
  const tenantId = useTenantId();
  const { notificaciones, isLoading, fetchNotificaciones, marcarLeida, marcarTodas, eliminar } =
    useNotificacionesStore();

  const [tab, setTab] = useState<"mis" | "actividad">("mis");

  useEffect(() => {
    if (user) fetchNotificaciones(user.id);
  }, [user]);

  const hayNoLeidas = notificaciones.some((n) => !n.leida);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Notificaciones"
        action={
          tab === "mis" && hayNoLeidas ? (
            <button onClick={() => user && marcarTodas(user.id)} className="btn-ghost text-sm">
              <CheckCheck className="w-4 h-4" /> Marcar todas leídas
            </button>
          ) : undefined
        }
      />

      {/* Tabs — solo si es admin */}
      {isAdmin && (
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
          <button
            onClick={() => setTab("mis")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              tab === "mis"
                ? "bg-white text-content-primary shadow-sm"
                : "text-content-muted hover:text-content-primary"
            )}
          >
            <span className="flex items-center gap-2">
              <Bell className="w-4 h-4" /> Mis notificaciones
            </span>
          </button>
          <button
            onClick={() => setTab("actividad")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              tab === "actividad"
                ? "bg-white text-content-primary shadow-sm"
                : "text-content-muted hover:text-content-primary"
            )}
          >
            <span className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4" /> Actividad del equipo
            </span>
          </button>
        </div>
      )}

      {/* ── Tab: Mis notificaciones ── */}
      {tab === "mis" && (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <div className="w-8 h-8 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
            </div>
          ) : notificaciones.length === 0 ? (
            <div className="card p-10 flex flex-col items-center text-center gap-4">
              <div className="icon-container w-14 h-14">
                <Bell className="w-7 h-7" />
              </div>
              <div>
                <p className="font-semibold text-content-primary mb-1">Sin notificaciones</p>
                <p className="text-sm text-content-secondary">Cuando haya novedades, aparecerán aquí.</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-content-muted text-right mb-2 pr-1 select-none">← Desliza para borrar</p>
              <div className="space-y-2">
                {notificaciones.map((n) => (
                  <SwipeCard key={n.id} notif={n} onDelete={eliminar} onMarkRead={marcarLeida} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Tab: Actividad del equipo ── */}
      {tab === "actividad" && isAdmin && tenantId && (
        <ActividadDashboard tenantId={tenantId} />
      )}
    </div>
  );
}
