"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { FichajeModal } from "@/components/modules/fichaje/FichajeModal";
import { initOneSignal, identificarUsuario } from "@/lib/onesignal";
import { NotificationPermissionModal } from "@/components/layout/NotificationPermissionModal";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  // Redirigir a login si no hay sesión
  useEffect(() => {
    if (isInitialized && !user) {
      router.replace("/login");
    }
  }, [user, isInitialized, router]);

  // Inicializar OneSignal y vincular usuario (sin pedir permiso aquí — lo hace el modal)
  useEffect(() => {
    if (!user?.id) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return; // algunos navegadores no soportan Notification API

    // Si ya tiene permiso concedido, solo inicializar y vincular sin mostrar modal
    if (Notification.permission === "granted") {
      initOneSignal().then(() => identificarUsuario(user.id));
    }
  }, [user?.id]);

  if (!user) return null;

  return (
    <div
      className="flex bg-app-bg"
      style={{
        height: "100dvh",
        // Fallback para Safari antiguo que no soporta dvh
        // @ts-ignore
        "--height-fallback": "-webkit-fill-available",
      }}
    >
      {/* Sidebar — visible solo en desktop (md+) */}
      <aside className="hidden md:flex flex-col w-sidebar flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Contenido principal — flex column que ocupa toda la altura */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Área de scroll — crece para llenar el espacio disponible */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>

        {/* Bottom nav — visible solo en móvil (md:hidden está en el propio componente)
            Al estar aquí en el flujo normal (no fixed) nunca se corta en iOS Safari */}
        <BottomNav />
      </main>

      {/* Modal de fichaje bloqueante (aparece automáticamente si aplica) */}
      <FichajeModal />

      {/* Modal de permisos de notificaciones (aparece si aún no ha dado permiso) */}
      <NotificationPermissionModal userId={user.id} />
    </div>
  );
}
