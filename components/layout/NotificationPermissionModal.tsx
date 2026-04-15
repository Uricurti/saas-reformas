"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { initOneSignal, identificarUsuario } from "@/lib/onesignal";

interface Props {
  userId: string;
}

export function NotificationPermissionModal({ userId }: Props) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Solo mostrar si el navegador soporta notificaciones y aún no se ha decidido
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    // Pequeño delay para no interrumpir la carga inicial
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  async function handleAceptar() {
    setLoading(true);
    try {
      await initOneSignal();
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await identificarUsuario(userId);
      }
    } catch (e) {
      console.error("Error activando notificaciones:", e);
    } finally {
      setVisible(false);
    }
  }

  return (
    // Fondo oscuro bloqueante — igual que el modal de fichaje
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl mx-4 overflow-hidden"
        style={{ maxWidth: 360, width: "100%" }}
      >
        {/* Header azul */}
        <div
          className="flex flex-col items-center justify-center px-6 pt-8 pb-6"
          style={{ background: "linear-gradient(135deg, #607eaa 0%, #4a6896 100%)" }}
        >
          <div
            className="flex items-center justify-center rounded-full mb-4"
            style={{ width: 64, height: 64, backgroundColor: "rgba(255,255,255,0.2)" }}
          >
            <Bell size={32} color="white" />
          </div>
          <h2 className="text-white text-xl font-bold text-center">
            Activa las notificaciones
          </h2>
          <p className="text-white text-sm text-center mt-2 opacity-90">
            Para recibir recordatorios de fichaje y avisos importantes
          </p>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-5">
          <ul className="space-y-3 mb-6">
            <li className="flex items-start gap-3">
              <span className="text-lg">⏰</span>
              <span className="text-sm text-gray-700">
                Recordatorio diario si no has fichado
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-lg">📋</span>
              <span className="text-sm text-gray-700">
                Avisos cuando cambie tu asignación de obra
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-lg">🔔</span>
              <span className="text-sm text-gray-700">
                Notificaciones importantes del equipo
              </span>
            </li>
          </ul>

          {/* Botón único — solo Aceptar */}
          <button
            onClick={handleAceptar}
            disabled={loading}
            className="w-full py-4 rounded-xl text-white font-bold text-base transition-opacity"
            style={{
              backgroundColor: "#607eaa",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Activando..." : "Activar notificaciones"}
          </button>

          <p className="text-center text-xs text-gray-400 mt-3">
            Puedes desactivarlas desde los ajustes del navegador
          </p>
        </div>
      </div>
    </div>
  );
}
