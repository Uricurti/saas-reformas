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
    <div className="flex min-h-screen bg-app-bg">
      {/* Sidebar — visible solo en desktop (md+) */}
      <aside className="hidden md:flex flex-col w-sidebar flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-auto md:pb-0" style={{ paddingBottom: "calc(110px + env(safe-area-inset-bottom))" }}>
          {children}
        </div>
      </main>

      {/* Bottom nav — visible solo en móvil */}
      <BottomNav />

      {/* Modal de fichaje bloqueante (aparece automáticamente si aplica) */}
      <FichajeModal />

      {/* Modal de permisos de notificaciones (aparece si aún no ha dado permiso) */}
      <NotificationPermissionModal userId={user.id} />
    </div>
  );
}
