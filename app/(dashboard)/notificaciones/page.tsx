"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useNotificacionesStore } from "@/lib/stores/notificaciones-store";
import { PageHeader } from "@/components/ui/PageHeader";
import { Bell, Check, CheckCheck } from "lucide-react";
import { formatRelative } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const tipoIconos: Record<string, string> = {
  asignacion_nueva: "📍",
  asignacion_cambio: "🔀",
  material_pedido: "🛒",
  fichaje_pendiente: "⏰",
  foto_subida: "📷",
};

export default function NotificacionesPage() {
  const user = useAuthStore((s) => s.user);
  const { notificaciones, isLoading, fetchNotificaciones, marcarLeida, marcarTodas } =
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
        <div className="space-y-2">
          {notificaciones.map((n) => (
            <button
              key={n.id}
              onClick={() => !n.leida && marcarLeida(n.id)}
              className={cn(
                "w-full card p-4 flex items-start gap-3 text-left hover:shadow-md transition-all",
                !n.leida && "border-l-4 border-l-primary"
              )}
            >
              <span className="text-2xl flex-shrink-0 mt-0.5">{tipoIconos[n.tipo] ?? "🔔"}</span>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", n.leida ? "text-content-secondary" : "text-content-primary")}>
                  {n.titulo}
                </p>
                <p className="text-xs text-content-muted mt-0.5">{n.mensaje}</p>
                <p className="text-xs text-content-muted mt-1">{formatRelative(n.created_at)}</p>
              </div>
              {!n.leida && (
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
              )}
              {n.leida && (
                <Check className="w-4 h-4 text-content-muted flex-shrink-0 mt-1" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
