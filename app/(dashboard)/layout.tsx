"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { FichajeModal } from "@/components/modules/fichaje/FichajeModal";

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
    </div>
  );
}
