"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useIsAdmin } from "@/lib/stores/auth-store";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError, user } = useAuthStore();

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted]       = useState(false);

  function landingFor(rol?: string) {
    return rol === "admin" ? "/dashboard" : "/obras";
  }

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (user) router.replace(landingFor(user.rol)); }, [user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    const { error } = await login(email, password);
    if (!error) {
      const u = useAuthStore.getState().user;
      router.replace(landingFor(u?.rol));
    }
  }

  if (user) return null;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative"
      style={{ background: "linear-gradient(160deg, #f0ede8 0%, #e8eef6 50%, #e2f4fb 100%)" }}
    >
      {/* Orbes decorativos estilo Apple */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, #607eaa 0%, transparent 70%)",
            animation: "floatOrb 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, #26bbec 0%, transparent 70%)",
            animation: "floatOrb 10s ease-in-out infinite reverse",
          }}
        />
        <div
          className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full opacity-15"
          style={{
            background: "radial-gradient(circle, #1c3879 0%, transparent 70%)",
            animation: "floatOrb 12s ease-in-out infinite 3s",
          }}
        />
      </div>

      <div
        className="w-full max-w-sm relative z-10"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Logo ReforLife — img nativo para SVG complejo */}
        <div
          className="flex flex-col items-center mb-4"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(-16px)",
            transition: "opacity 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s, transform 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/4.svg"
            alt="ReforLife"
            style={{ width: 220, height: "auto" }}
          />
        </div>

        {/* Card login con glassmorphism */}
        <div
          style={{
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
          }}
        >
          <h2
            className="text-xl font-bold mb-1"
            style={{ color: "#1c3879" }}
          >
            Bienvenido
          </h2>
          <p className="text-sm mb-6" style={{ color: "#94A3B8" }}>
            Inicia sesión para continuar
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError(); }}
                className="input"
                placeholder="tu@email.com"
                style={{ transition: "all 0.2s ease" }}
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Contraseña</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  className="input pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "#94A3B8" }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="text-sm rounded-xl px-4 py-3 animate-fade-in"
                style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FECACA" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={cn("btn-primary w-full justify-center py-3 mt-2 relative overflow-hidden", isLoading && "opacity-70")}
            >
              {/* Shine effect */}
              <span
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)",
                  animation: "shine 3s ease-in-out infinite",
                }}
              />
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrando...</>
                : "Entrar"
              }
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#94A3B8" }}>
          Si olvidaste tu contraseña, contacta con el administrador.
        </p>
      </div>

      <style jsx global>{`
        @keyframes floatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(20px, -20px) scale(1.05); }
          66%       { transform: translate(-15px, 15px) scale(0.95); }
        }
        @keyframes shine {
          0%   { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(300%) skewX(-15deg); }
        }
      `}</style>
    </div>
  );
}
