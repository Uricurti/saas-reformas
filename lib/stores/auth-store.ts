"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";
import { signIn, signOut, getUserProfile, getAuthUser } from "@/lib/insforge/auth";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  initialize: () => void;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isInitialized: false,
      error: null,

      /**
       * Inicialización instantánea — nunca espera a la red.
       * - Si hay usuario en localStorage → app carga inmediatamente
       * - Si no hay usuario → muestra login inmediatamente
       * La verificación de sesión con InsForge ocurre en segundo plano
       * y solo desloguea si la sesión está realmente expirada.
       */
      initialize: () => {
        if (get().isInitialized) return;

        // Marcar como inicializado INMEDIATAMENTE con lo que hay en localStorage
        set({ isInitialized: true, isLoading: false });

        // Verificar y REFRESCAR la sesión en segundo plano (no bloquea la UI)
        const currentUser = get().user;
        if (currentUser) {
          getAuthUser()
            .then(async (authUser) => {
              if (!authUser?.id) {
                // Sesión expirada — limpiar para forzar login
                set({ user: null });
                return;
              }
              // Sesión válida — refrescar el perfil por si cambió algo
              const profile = await getUserProfile(authUser.id);
              if (profile) set({ user: profile });
            })
            .catch(() => {
              // Error de red → offline-first: mantenemos el usuario de localStorage
            });
        }
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await signIn(email, password);

          if (error || !data?.user) {
            const msg = (error as any)?.message ?? "Credenciales incorrectas";
            set({ error: msg, isLoading: false });
            return { error: msg };
          }

          const profile = await getUserProfile(data.user.id);
          if (!profile) {
            const msg = "No se encontró el perfil de usuario";
            set({ error: msg, isLoading: false });
            return { error: msg };
          }

          if (!profile.activo) {
            await signOut();
            const msg = "Esta cuenta está desactivada. Contacta con el administrador.";
            set({ error: msg, isLoading: false });
            return { error: msg };
          }

          set({ user: profile, isLoading: false, error: null });
          return { error: null };
        } catch (e: any) {
          const msg = e?.message ?? "Error al iniciar sesión";
          set({ error: msg, isLoading: false });
          return { error: msg };
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try { await signOut(); } catch { /* ignorar errores de red */ }
        set({ user: null, isLoading: false, isInitialized: true, error: null });
      },

      setUser: (user) => set({ user }),
      clearError: () => set({ error: null }),
    }),
    {
      name: "reformas-auth",
      partialize: (state) => ({ user: state.user }),
    }
  )
);

export const useUser     = () => useAuthStore((s) => s.user);
export const useIsAdmin  = () => useAuthStore((s) => s.user?.rol === "admin");
export const useIsLoading = () => useAuthStore((s) => s.isLoading);
export const useTenantId = () => useAuthStore((s) => s.user?.tenant_id);
