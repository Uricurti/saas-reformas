"use client";

import { create } from "zustand";
import type { Notificacion } from "@/types";
import { getNotificaciones, marcarNotificacionLeida, marcarTodasLeidas } from "@/lib/insforge/database";

interface NotificacionesState {
  notificaciones: Notificacion[];
  noLeidas: number;
  isLoading: boolean;

  fetchNotificaciones: (userId: string) => Promise<void>;
  marcarLeida: (id: string) => Promise<void>;
  marcarTodas: (userId: string) => Promise<void>;
  addNotificacion: (n: Notificacion) => void;
}

export const useNotificacionesStore = create<NotificacionesState>((set, get) => ({
  notificaciones: [],
  noLeidas: 0,
  isLoading: false,

  fetchNotificaciones: async (userId) => {
    set({ isLoading: true });
    const { data } = await getNotificaciones(userId);
    const notifs = (data as Notificacion[]) ?? [];
    set({
      notificaciones: notifs,
      noLeidas: notifs.filter((n) => !n.leida).length,
      isLoading: false,
    });
  },

  marcarLeida: async (id) => {
    await marcarNotificacionLeida(id);
    set((s) => ({
      notificaciones: s.notificaciones.map((n) =>
        n.id === id ? { ...n, leida: true } : n
      ),
      noLeidas: Math.max(0, s.noLeidas - 1),
    }));
  },

  marcarTodas: async (userId) => {
    await marcarTodasLeidas(userId);
    set((s) => ({
      notificaciones: s.notificaciones.map((n) => ({ ...n, leida: true })),
      noLeidas: 0,
    }));
  },

  addNotificacion: (n) =>
    set((s) => ({
      notificaciones: [n, ...s.notificaciones],
      noLeidas: s.noLeidas + (n.leida ? 0 : 1),
    })),
}));
