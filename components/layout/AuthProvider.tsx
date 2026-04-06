"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { restoreSession, loadSession, saveSession } from "@/lib/insforge/auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize    = useAuthStore((s) => s.initialize);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const setUser       = useAuthStore((s) => s.setUser);
  const user          = useAuthStore((s) => s.user);

  // Inicialización al montar
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Cuando el usuario vuelve a la pestaña después de estar en otra app/pestaña,
  // refrescamos el token si expiró. Así las queries usan siempre un token válido.
  useEffect(() => {
    if (!user) return;

    async function checkTokenOnVisible() {
      if (document.visibilityState !== "visible") return;

      const stored = loadSession();
      if (!stored?.accessToken || stored.accessToken === "sdk-session") return;

      // Leer la expiración del JWT sin llamada de red
      try {
        const payload = JSON.parse(atob(stored.accessToken.split(".")[1]));
        const expired = payload.exp && payload.exp < Math.floor(Date.now() / 1000);
        if (!expired) return; // Token aún válido, nada que hacer
      } catch { return; }

      // Token expirado → refresh silencioso
      const authUser = await restoreSession();
      if (!authUser) {
        // Refresh falló — desloguear
        useAuthStore.getState().logout();
      }
      // Si el refresh fue bien, saveSession ya actualizó localStorage
      // y getLiveClient() usará el nuevo token en la siguiente query
    }

    document.addEventListener("visibilitychange", checkTokenOnVisible);
    return () => document.removeEventListener("visibilitychange", checkTokenOnVisible);
  }, [user]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
