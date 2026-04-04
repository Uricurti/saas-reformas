"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // initialize() es síncrono y se ejecuta en el primer useEffect.
  // Mientras tanto (primer render SSR/hidratación) mostramos un spinner mínimo.
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
