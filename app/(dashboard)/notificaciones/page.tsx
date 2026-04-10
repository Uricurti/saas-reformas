"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useNotificacionesStore } from "@/lib/stores/notificaciones-store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
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

// ─── Umbrales de swipe ────────────────────────────────────────────────────────
const REVEAL_THRESHOLD  = 72;  // px → muestra botón borrar
const DELETE_THRESHOLD  = 160; // px → borrado automático al soltar

// ─── Tarjeta con swipe ────────────────────────────────────────────────────────
function SwipeCard({
  notif,
  onDelete,
  onMarkRead,
}: {
  notif:       Notificacion;
  onDelete:    (id: string) => void;
  onMarkRead:  (id: string) => void;
}) {
  const [offset,   setOffset]   = useState(0);   // px desplazamiento actual
  const [snapping, setSnapping] = useState(false); // true → animar retorno/salida
  const [leaving,  setLeaving]  = useState(false); // true → animación de salida
  const startX    = useRef(0);
  const startY    = useRef(0);
  const dragging  = useRef(false);
  const lockedDir = useRef<"h" | "v" | null>(null); // bloquea eje tras 10px

  // ── Inicio del gesto ──────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startX.current   = e.clientX;
    startY.current   = e.clientY;
    dragging.current = true;
    lockedDir.current = null;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  // ── Movimiento ────────────────────────────────────────────────────────────
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;

    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    // Determinar eje dominante la primera vez
    if (!lockedDir.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      lockedDir.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (lockedDir.current === "v") return; // scroll vertical → no swipe

    e.preventDefault(); // evita scroll mientras deslizamos horizontalmente

    // Solo izquierda (negativo); con resistencia suave pasado el DELETE_THRESHOLD
    if (dx > 0) { setOffset(0); return; }
    const raw = Math.abs(dx);
    const clamped = raw > DELETE_THRESHOLD
      ? DELETE_THRESHOLD + (raw - DELETE_THRESHOLD) * 0.15
      : raw;
    setOffset(-clamped);
  }, []);

  // ── Fin del gesto ─────────────────────────────────────────────────────────
  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;

    const abs = Math.abs(offset);

    if (abs >= DELETE_THRESHOLD) {
      // Borrado automático: animación de salida completa
      setSnapping(true);
      setLeaving(true);
      setOffset(-400);
      setTimeout(() => onDelete(notif.id), 320);
    } else if (abs >= REVEAL_THRESHOLD) {
      // Queda revelado el botón de borrar
      setSnapping(true);
      setOffset(-REVEAL_THRESHOLD);
      setTimeout(() => setSnapping(false), 300);
    } else {
      // Vuelve al origen
      setSnapping(true);
      setOffset(0);
      setTimeout(() => setSnapping(false), 300);
    }
  }, [offset, notif.id, onDelete]);

  // Cerrar el botón si toca en otro sitio
  const closeReveal = useCallback(() => {
    if (offset < 0 && Math.abs(offset) <= REVEAL_THRESHOLD + 4) {
      setSnapping(true);
      setOffset(0);
      setTimeout(() => setSnapping(false), 300);
    }
  }, [offset]);

  const revealed = Math.abs(offset) >= REVEAL_THRESHOLD - 4;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        leaving && "transition-all duration-300 opacity-0 scale-y-0 max-h-0 mb-0"
      )}
      style={{ marginBottom: leaving ? 0 : undefined }}
    >
      {/* ── Fondo rojo (botón eliminar) ── */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end pr-5 rounded-2xl"
        style={{
          background:  "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
          width:       Math.max(0, Math.abs(offset) + 20),
          opacity:     Math.min(1, Math.abs(offset) / REVEAL_THRESHOLD),
          transition:  snapping ? "width 0.3s cubic-bezier(0.25,1,0.5,1)" : "none",
        }}
      >
        <button
          onPointerDown={(e) => { e.stopPropagation(); onDelete(notif.id); }}
          className="flex flex-col items-center gap-1 text-white"
          style={{ opacity: revealed ? 1 : 0, transition: "opacity 0.15s" }}
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-wide">BORRAR</span>
        </button>
      </div>

      {/* ── Tarjeta deslizable ── */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          if (Math.abs(offset) > 5) { closeReveal(); return; }
          if (!notif.leida) onMarkRead(notif.id);
        }}
        className={cn(
          "card p-4 flex items-start gap-3 text-left select-none touch-pan-y cursor-pointer",
          !notif.leida && "border-l-4 border-l-primary",
          "active:brightness-95"
        )}
        style={{
          transform:  `translateX(${offset}px)`,
          transition: snapping ? "transform 0.3s cubic-bezier(0.25,1,0.5,1)" : "none",
          willChange: "transform",
          userSelect: "none",
        }}
      >
        <span className="text-2xl flex-shrink-0 mt-0.5">
          {tipoIconos[notif.tipo] ?? "🔔"}
        </span>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium",
            notif.leida ? "text-content-secondary" : "text-content-primary"
          )}>
            {notif.titulo}
          </p>
          <p className="text-xs text-content-muted mt-0.5">{notif.mensaje}</p>
          <p className="text-xs text-content-muted mt-1">{formatRelative(notif.created_at)}</p>
        </div>
        {!notif.leida ? (
          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
        ) : (
          <Check className="w-4 h-4 text-content-muted flex-shrink-0 mt-1" />
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function NotificacionesPage() {
  const user = useAuthStore((s) => s.user);
  const { notificaciones, isLoading, fetchNotificaciones, marcarLeida, marcarTodas, eliminar } =
    useNotificacionesStore();

  useEffect(() => {
    if (user) fetchNotificaciones(user.id);
  }, [user]);

  const hayNoLeidas = notificaciones.some((n) => !n.leida);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Notificaciones"
        action={
          hayNoLeidas ? (
            <button onClick={() => user && marcarTodas(user.id)} className="btn-ghost text-sm">
              <CheckCheck className="w-4 h-4" /> Marcar todas leídas
            </button>
          ) : undefined
        }
      />

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
          {/* Hint swipe — solo se muestra si hay notificaciones */}
          <p className="text-xs text-content-muted text-right mb-2 pr-1 select-none">
            ← Desliza para borrar
          </p>
          <div className="space-y-2">
            {notificaciones.map((n) => (
              <SwipeCard
                key={n.id}
                notif={n}
                onDelete={eliminar}
                onMarkRead={marcarLeida}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
