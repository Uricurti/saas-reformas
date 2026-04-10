"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useIsAdmin } from "@/lib/stores/auth-store";
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2, Mail, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tipos de vista ────────────────────────────────────────────────────────────
type Vista = "login" | "reset-email" | "reset-code" | "reset-pass" | "reset-ok";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError, user } = useAuthStore();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted]           = useState(false);

  // Reset flow
  const [vista, setVista]               = useState<Vista>("login");
  const [resetEmail, setResetEmail]     = useState("");
  const [resetCode, setResetCode]       = useState("");
  const [resetToken, setResetToken]     = useState("");
  const [newPass, setNewPass]           = useState("");
  const [showNewPass, setShowNewPass]   = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError]     = useState<string | null>(null);

  function landingFor(rol?: string) { return rol === "admin" ? "/dashboard" : "/obras"; }

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (user) router.replace(landingFor(user.rol)); }, [user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    const { error } = await login(email, password);
    if (!error) router.replace(landingFor(useAuthStore.getState().user?.rol));
  }

  // ── Helpers reset ─────────────────────────────────────────────────────────
  async function callReset(body: object) {
    setResetLoading(true);
    setResetError(null);
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setResetError(json.error ?? "Error desconocido."); return null; }
      return json;
    } catch { setResetError("Error de conexión."); return null; }
    finally   { setResetLoading(false); }
  }

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    const ok = await callReset({ step: "send", email: resetEmail });
    if (ok) setVista("reset-code");
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    const data = await callReset({ step: "verify", email: resetEmail, code: resetCode.trim() });
    if (data?.token) { setResetToken(data.token); setVista("reset-pass"); }
  }

  async function handleConfirmPass(e: FormEvent) {
    e.preventDefault();
    const ok = await callReset({ step: "confirm", email: resetEmail, token: resetToken, newPassword: newPass });
    if (ok) setVista("reset-ok");
  }

  function volverAlLogin() {
    setVista("login"); setResetEmail(""); setResetCode("");
    setResetToken(""); setNewPass(""); setResetError(null);
  }

  if (user) return null;

  // ── Contenido de la card según vista ─────────────────────────────────────
  const cardContent = (() => {
    // ─ Login normal ──────────────────────────────────────────────────────────
    if (vista === "login") return (
      <>
        <h2 className="text-xl font-bold mb-1" style={{ color: "#1c3879" }}>Bienvenido</h2>
        <p className="text-sm mb-6" style={{ color: "#94A3B8" }}>Inicia sesión para continuar</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => { setEmail(e.target.value); clearError(); }}
              className="input" placeholder="tu@email.com" />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <div className="relative">
              <input id="password" type={showPassword ? "text" : "password"}
                autoComplete="current-password" required value={password}
                onChange={(e) => { setPassword(e.target.value); clearError(); }}
                className="input pr-10" placeholder="••••••••" />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "#94A3B8" }} tabIndex={-1}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm rounded-xl px-4 py-3 animate-fade-in"
              style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={isLoading}
            className={cn("btn-primary w-full justify-center py-3 mt-2 relative overflow-hidden", isLoading && "opacity-70")}>
            <span className="absolute inset-0 pointer-events-none" style={{
              background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)",
              animation: "shine 3s ease-in-out infinite",
            }} />
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrando…</> : "Entrar"}
          </button>
        </form>

        <button onClick={() => { setResetEmail(email); setVista("reset-email"); clearError(); }}
          className="w-full mt-4 text-sm text-center transition-colors"
          style={{ color: "#94A3B8" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#607eaa")}
          onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}>
          ¿Olvidaste tu contraseña?
        </button>
      </>
    );

    // ─ Paso 1: introducir email ───────────────────────────────────────────────
    if (vista === "reset-email") return (
      <>
        <button onClick={volverAlLogin} className="flex items-center gap-1.5 text-sm mb-5 transition-colors"
          style={{ color: "#94A3B8" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#607eaa")}
          onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}>
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#1c3879,#607eaa)" }}>
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "#1c3879" }}>Restablecer contraseña</h2>
            <p className="text-xs" style={{ color: "#94A3B8" }}>Te enviaremos un código a tu email</p>
          </div>
        </div>

        <form onSubmit={handleSendCode} className="space-y-4">
          <div>
            <label className="label">Tu email</label>
            <input type="email" required value={resetEmail}
              onChange={e => { setResetEmail(e.target.value); setResetError(null); }}
              className="input" placeholder="tu@gmail.com" autoFocus />
          </div>
          {resetError && (
            <div className="text-sm rounded-xl px-4 py-3" style={{ background: "#FEE2E2", color: "#991B1B" }}>
              {resetError}
            </div>
          )}
          <button type="submit" disabled={resetLoading} className="btn-primary w-full justify-center py-3">
            {resetLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : "Enviar código"}
          </button>
        </form>
      </>
    );

    // ─ Paso 2: introducir código ──────────────────────────────────────────────
    if (vista === "reset-code") return (
      <>
        <button onClick={() => { setVista("reset-email"); setResetError(null); }}
          className="flex items-center gap-1.5 text-sm mb-5 transition-colors"
          style={{ color: "#94A3B8" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#607eaa")}
          onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}>
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <h2 className="text-lg font-bold mb-1" style={{ color: "#1c3879" }}>Introduce el código</h2>
        <p className="text-sm mb-5" style={{ color: "#94A3B8" }}>
          Hemos enviado un código de 6 dígitos a<br />
          <strong style={{ color: "#1c3879" }}>{resetEmail}</strong>
        </p>

        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <label className="label">Código</label>
            <input type="text" inputMode="numeric" maxLength={6} required value={resetCode}
              onChange={e => { setResetCode(e.target.value.replace(/\D/g, "")); setResetError(null); }}
              className="input text-center text-2xl tracking-[0.5em] font-mono"
              placeholder="000000" autoFocus />
          </div>
          {resetError && (
            <div className="text-sm rounded-xl px-4 py-3" style={{ background: "#FEE2E2", color: "#991B1B" }}>
              {resetError}
            </div>
          )}
          <button type="submit" disabled={resetLoading || resetCode.length < 6}
            className="btn-primary w-full justify-center py-3">
            {resetLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando…</> : "Verificar código"}
          </button>
          <button type="button" onClick={() => callReset({ step: "send", email: resetEmail })}
            className="w-full text-sm text-center" style={{ color: "#94A3B8" }}>
            Reenviar código
          </button>
        </form>
      </>
    );

    // ─ Paso 3: nueva contraseña ───────────────────────────────────────────────
    if (vista === "reset-pass") return (
      <>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#1c3879,#607eaa)" }}>
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "#1c3879" }}>Nueva contraseña</h2>
            <p className="text-xs" style={{ color: "#94A3B8" }}>Mínimo 6 caracteres</p>
          </div>
        </div>

        <form onSubmit={handleConfirmPass} className="space-y-4">
          <div>
            <label className="label">Nueva contraseña</label>
            <div className="relative">
              <input type={showNewPass ? "text" : "password"} required minLength={6} value={newPass}
                onChange={e => { setNewPass(e.target.value); setResetError(null); }}
                className="input pr-10" placeholder="Mínimo 6 caracteres" autoFocus />
              <button type="button" onClick={() => setShowNewPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} tabIndex={-1}>
                {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {resetError && (
            <div className="text-sm rounded-xl px-4 py-3" style={{ background: "#FEE2E2", color: "#991B1B" }}>
              {resetError}
            </div>
          )}
          <button type="submit" disabled={resetLoading || newPass.length < 6}
            className="btn-primary w-full justify-center py-3">
            {resetLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : "Guardar contraseña"}
          </button>
        </form>
      </>
    );

    // ─ Éxito ──────────────────────────────────────────────────────────────────
    if (vista === "reset-ok") return (
      <div className="flex flex-col items-center text-center gap-4 py-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#10B981,#34D399)" }}>
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold mb-1" style={{ color: "#1c3879" }}>¡Contraseña actualizada!</h2>
          <p className="text-sm" style={{ color: "#94A3B8" }}>Ya puedes entrar con tu nueva contraseña.</p>
        </div>
        <button onClick={volverAlLogin} className="btn-primary w-full justify-center py-3 mt-2">
          Entrar ahora
        </button>
      </div>
    );
  })();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative"
      style={{ background: "linear-gradient(160deg, #f0ede8 0%, #e8eef6 50%, #e2f4fb 100%)" }}>

      {/* Orbes decorativos */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #607eaa 0%, transparent 70%)", animation: "floatOrb 8s ease-in-out infinite" }} />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #26bbec 0%, transparent 70%)", animation: "floatOrb 10s ease-in-out infinite reverse" }} />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #1c3879 0%, transparent 70%)", animation: "floatOrb 12s ease-in-out infinite 3s" }} />
      </div>

      <div className="w-full max-w-sm relative z-10" style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)",
      }}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-4" style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(-16px)",
          transition: "opacity 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s, transform 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/4.svg" alt="ReforLife" style={{ width: 220, height: "auto" }} />
        </div>

        {/* Card con glassmorphism */}
        <div style={{
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderRadius: "24px",
          border: "1px solid rgba(255,255,255,0.9)",
          boxShadow: "0 8px 40px rgba(96,126,170,0.15), 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(255,255,255,0.6) inset",
          padding: "32px",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0) scale(1)" : "translateY(12px) scale(0.98)",
          transition: "opacity 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s, transform 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s",
        }}>
          {cardContent}
        </div>
      </div>

      <style jsx global>{`
        @keyframes floatOrb {
          0%, 100% { transform: translate(0,0) scale(1); }
          33%       { transform: translate(20px,-20px) scale(1.05); }
          66%       { transform: translate(-15px,15px) scale(0.95); }
        }
        @keyframes shine {
          0%   { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(300%) skewX(-15deg); }
        }
      `}</style>
    </div>
  );
}
