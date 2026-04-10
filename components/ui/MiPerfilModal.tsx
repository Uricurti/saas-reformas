"use client";

import { useState } from "react";
import { X, UserIcon, Mail, KeyRound, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { User } from "@/types";

interface Props {
  user: User;
  onClose: () => void;
}

export function MiPerfilModal({ user, onClose }: Props) {
  const setUser = useAuthStore((s) => s.setUser);

  const [nombre,    setNombre]    = useState(user.nombre);
  const [email,     setEmail]     = useState(user.email);
  const [password,  setPassword]  = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [guardado,  setGuardado]  = useState(false);

  const cambioEmail    = email.trim().toLowerCase() !== user.email.toLowerCase();
  const cambioPassword = password.length > 0;
  const hayeCambios    = nombre.trim() !== user.nombre || cambioEmail || cambioPassword;

  async function handleGuardar() {
    if (!nombre.trim() || !email.trim()) {
      setError("El nombre y el email son obligatorios.");
      return;
    }
    if (password && password.length < 6) {
      setError("La contraseña debe tener mínimo 6 caracteres.");
      return;
    }
    setError(null);
    setIsLoading(true);

    // Recuperar el accessToken guardado en localStorage para poder actualizar
    // las credenciales de acceso (email/contraseña) en InsForge
    let accessToken: string | undefined;
    try {
      const raw = localStorage.getItem("insforge_session_v1");
      if (raw) accessToken = JSON.parse(raw)?.accessToken;
    } catch { /* ignorar */ }

    const res = await fetch("/api/auth/update-me", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        userId:      user.id,
        nombre:      nombre.trim(),
        email:       email.trim().toLowerCase(),
        emailActual: user.email,
        password:    password || undefined,
        accessToken,
      }),
    });

    const json = await res.json();
    setIsLoading(false);

    if (json.error) {
      setError(json.error);
      return;
    }

    // Actualizar el store con los nuevos datos
    setUser({ ...user, nombre: nombre.trim(), email: email.trim().toLowerCase() });
    setGuardado(true);
  }

  // ── Vista de confirmación ──────────────────────────────────────────────────
  if (guardado) {
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal-panel">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-success-light flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
              <h2 className="text-lg font-semibold">Datos actualizados</h2>
            </div>
            <button onClick={onClose} className="btn-ghost p-2"><X className="w-4 h-4" /></button>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-sm text-content-secondary">
              Tus datos han sido actualizados correctamente. A partir de ahora usa:
            </p>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-border">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-content-muted flex-shrink-0" />
                <div>
                  <p className="text-xs text-content-muted uppercase font-semibold tracking-wide">Email</p>
                  <p className="font-mono text-sm font-semibold text-content-primary">{email.trim().toLowerCase()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <KeyRound className="w-4 h-4 text-content-muted flex-shrink-0" />
                <div>
                  <p className="text-xs text-content-muted uppercase font-semibold tracking-wide">Contraseña</p>
                  <p className="font-mono text-sm font-semibold text-content-primary">
                    {cambioPassword
                      ? password
                      : <span className="text-content-muted font-sans font-normal">Sin cambios</span>}
                  </p>
                </div>
              </div>
            </div>

            {cambioEmail && (
              <div className="flex items-start gap-2 bg-warning-light rounded-lg px-3 py-2.5 text-sm text-warning-foreground">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>La próxima vez que entres a la app tendrás que usar el nuevo email.</p>
              </div>
            )}
          </div>

          <div className="p-5 border-t border-border flex justify-end">
            <button onClick={onClose} className="btn-primary px-8">Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario de edición ──────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
              style={{ background: "linear-gradient(135deg, #1c3879 0%, #607eaa 100%)" }}
            >
              {user.nombre.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div>
              <h2 className="text-lg font-semibold">Mis datos</h2>
              <p className="text-xs text-content-muted">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Nombre */}
          <div>
            <label className="label flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-content-muted" /> Nombre completo
            </label>
            <input
              className="input"
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); setError(null); }}
              placeholder="Tu nombre"
            />
          </div>

          {/* Email */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-content-muted" /> Email de acceso
            </label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="tu@email.com"
            />
            {cambioEmail && (
              <p className="text-xs text-warning-foreground bg-warning-light rounded-lg px-3 py-2 mt-2">
                ⚠️ Cuando cambies el email, la próxima vez tendrás que entrar con el nuevo.
              </p>
            )}
          </div>

          {/* Contraseña */}
          <div>
            <label className="label flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-content-muted" /> Nueva contraseña
              <span className="text-content-muted font-normal text-xs ml-1">— dejar vacío para no cambiarla</span>
            </label>
            <input
              className="input"
              type="text"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {/* Resumen cambios */}
          {hayeCambios && !error && (
            <div className="bg-primary-light border border-primary/20 rounded-xl px-4 py-3 text-sm text-content-primary space-y-1">
              <p className="font-semibold text-primary text-xs uppercase tracking-wide">Cambios pendientes</p>
              {nombre.trim() !== user.nombre && <p>👤 Nombre: <strong>{nombre.trim()}</strong></p>}
              {cambioEmail    && <p>📧 Email: <strong>{email.trim().toLowerCase()}</strong></p>}
              {cambioPassword && <p>🔑 Contraseña: <strong>{password}</strong></p>}
            </div>
          )}

          {error && (
            <div className="bg-danger-light text-danger-foreground text-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={handleGuardar}
            disabled={isLoading || !hayeCambios}
            className="btn-primary"
          >
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
              : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
