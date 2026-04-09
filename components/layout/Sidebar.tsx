"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, Calendar, ShoppingCart,
  Calculator, Users, LogOut, Bell, TrendingUp, Settings, Pencil, LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore, useIsAdmin } from "@/lib/stores/auth-store";
import { useNotificacionesStore } from "@/lib/stores/notificaciones-store";
import { initials } from "@/lib/utils/format";
import { getTenantConfig, type TenantConfig } from "@/lib/insforge/database";
import { EmpresaConfigModal } from "@/components/ui/EmpresaConfigModal";
import { MiPerfilModal } from "@/components/ui/MiPerfilModal";

const navItemsEmpleado = [
  { href: "/obras",      label: "Mis obras",  icon: Building2 },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/materiales", label: "Materiales", icon: ShoppingCart },
];

const navItemsAdmin = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard, group: "operativa" },
  { href: "/obras",      label: "Obras",      icon: Building2,       group: "operativa" },
  { href: "/calendario", label: "Calendario", icon: Calendar,        group: "operativa" },
  { href: "/materiales", label: "Materiales", icon: ShoppingCart,    group: "operativa" },
  { href: "/jornales",   label: "Jornales",   icon: Calculator,      group: "operativa" },
  { href: "/equipo",     label: "Equipo",     icon: Users,           group: "operativa" },
  { href: "/facturacion",label: "Finanzas",   icon: TrendingUp,      group: "finanzas"  },
];

export function Sidebar() {
  const pathname  = usePathname();
  const isAdmin   = useIsAdmin();
  const user      = useAuthStore((s) => s.user);
  const logout    = useAuthStore((s) => s.logout);
  const noLeidas  = useNotificacionesStore((s) => s.noLeidas);

  const [showEmpresa, setShowEmpresa] = useState(false);
  const [empresaConfig, setEmpresaConfig] = useState<TenantConfig | null>(null);
  const [showMiPerfil, setShowMiPerfil] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Cargamos la config de empresa al montar (solo admins)
  useEffect(() => {
    if (isAdmin && user?.tenant_id) {
      getTenantConfig(user.tenant_id).then(setEmpresaConfig);
    }
  }, [isAdmin, user?.tenant_id]);

  const navItems = isAdmin ? navItemsAdmin : navItemsEmpleado;

  return (
    <>
    <div
      className="h-screen flex flex-col sticky top-0"
      style={{
        width: "260px",
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(232,232,236,0.8)",
        boxShadow: "2px 0 20px rgba(96,126,170,0.06)",
      }}
    >
      {/* Logo ReforLife — horizontal completo */}
      <div
        className="flex items-center justify-center px-4 flex-shrink-0"
        style={{ height: "80px", borderBottom: "1px solid #F0F0F4" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/4.svg"
          alt="ReforLife"
          style={{ width: "180px", height: "56px", objectFit: "contain" }}
        />
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Sección operativa */}
        <div className="space-y-0.5">
          {navItems.filter((i: any) => i.group !== "finanzas").map((item: any, idx: number) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(isActive ? "nav-item-active" : "nav-item")}
                style={{
                  animationDelay: `${idx * 40}ms`,
                  animation: "slideInLeft 0.3s cubic-bezier(0.16,1,0.3,1) both",
                }}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "#607eaa" }} />
                )}
              </Link>
            );
          })}
        </div>

        <div className="divider" />

        {/* Sección Finanzas — solo admin */}
        {isAdmin && (() => {
          const finItem = navItems.find((i: any) => i.group === "finanzas");
          if (!finItem) return null;
          const isActive = pathname.startsWith(finItem.href);
          return (
            <div className="space-y-0.5 mb-1">
              <p className="px-3 text-[10px] font-700 uppercase tracking-widest mb-1" style={{ color: "#94A3B8" }}>
                Finanzas
              </p>
              <Link
                href={finItem.href}
                className={cn(isActive ? "nav-item-active" : "nav-item")}
                style={{
                  background: isActive
                    ? "linear-gradient(135deg, #607eaa18 0%, #26bbec10 100%)"
                    : undefined,
                  border: isActive ? "1px solid #607eaa22" : "1px solid transparent",
                }}
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: isActive ? "#607eaa" : "#EEF2F8" }}
                >
                  <TrendingUp
                    className="w-3.5 h-3.5"
                    style={{ color: isActive ? "#fff" : "#607eaa" }}
                  />
                </div>
                <span style={{ fontWeight: isActive ? 700 : 500 }}>{finItem.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "#607eaa" }} />
                )}
              </Link>
            </div>
          );
        })()}

        <div className="divider" />

        <Link
          href="/notificaciones"
          className={cn(pathname === "/notificaciones" ? "nav-item-active" : "nav-item", "relative")}
        >
          <Bell className="w-4 h-4 flex-shrink-0" />
          <span>Notificaciones</span>
          {noLeidas > 0 && (
            <span
              className="ml-auto min-w-[20px] h-5 text-white text-xs font-bold rounded-full flex items-center justify-center px-1"
              style={{ background: "#EF4444", animation: "pulse 2s ease-in-out infinite" }}
            >
              {noLeidas > 99 ? "99+" : noLeidas}
            </span>
          )}
        </Link>
      </nav>

      {/* Perfil */}
      <div
        className="px-3 py-4 flex-shrink-0"
        style={{ borderTop: "1px solid #F0F0F4" }}
      >
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
          style={{ background: "#F8F8FB" }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1c3879 0%, #607eaa 100%)" }}
          >
            <span className="text-xs font-bold text-white">
              {user ? initials(user.nombre) : "??"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "#1A1A2E" }}>{user?.nombre}</p>
            <p className="text-xs capitalize" style={{ color: "#9CA3AF" }}>{user?.rol}</p>
          </div>
          {/* Editar mis datos — todos */}
          <button
            onClick={() => setShowMiPerfil(true)}
            className="p-1.5 rounded-lg transition-all hover:scale-110"
            style={{ color: "#94A3B8" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#607eaa", (e.currentTarget.style.background = "#EEF2F8"))}
            onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8", (e.currentTarget.style.background = "transparent"))}
            title="Editar mis datos"
          >
            <Pencil className="w-4 h-4" />
          </button>

          {/* Datos de empresa — solo admin */}
          {isAdmin && (
            <button
              onClick={() => setShowEmpresa(true)}
              className="p-1.5 rounded-lg transition-all hover:scale-110"
              style={{ color: "#94A3B8" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#607eaa", (e.currentTarget.style.background = "#EEF2F8"))}
              onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8", (e.currentTarget.style.background = "transparent"))}
              title="Datos de empresa"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={logout}
            className="p-1.5 rounded-lg transition-all hover:bg-red-50 hover:scale-110"
            style={{ color: "#94A3B8" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#EF4444")}
            onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>

    {/* Modales fuera del sidebar para evitar el bug de backdrop-filter con position:fixed */}
    {mounted && showEmpresa && user?.tenant_id && createPortal(
      <EmpresaConfigModal
        tenantId={user.tenant_id}
        config={empresaConfig}
        onClose={() => setShowEmpresa(false)}
        onSaved={(c) => setEmpresaConfig(c)}
      />,
      document.body
    )}

    {mounted && showMiPerfil && user && createPortal(
      <MiPerfilModal
        user={user}
        onClose={() => setShowMiPerfil(false)}
      />,
      document.body
    )}
  </>
  );
}
