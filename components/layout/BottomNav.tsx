"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Calendar, ShoppingCart, Camera, Bell, Calculator, Users, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin, useAuthStore } from "@/lib/stores/auth-store";
import { useNotificacionesStore } from "@/lib/stores/notificaciones-store";
import { useState } from "react";
import { initials } from "@/lib/utils/format";

const navEmpleado = [
  { href: "/obras",          label: "Obras",      icon: Building2 },
  { href: "/calendario",     label: "Calendario", icon: Calendar },
  { href: "/materiales",     label: "Material",   icon: ShoppingCart },
  { href: "/fotos",          label: "Fotos",      icon: Camera },
  { href: "/notificaciones", label: "Avisos",     icon: Bell },
];

const navAdmin = [
  { href: "/obras",          label: "Obras",      icon: Building2 },
  { href: "/calendario",     label: "Calendario", icon: Calendar },
  { href: "/jornales",       label: "Jornales",   icon: Calculator },
  { href: "/equipo",         label: "Equipo",     icon: Users },
  { href: "/notificaciones", label: "Avisos",     icon: Bell },
];

export function BottomNav() {
  const pathname  = usePathname();
  const isAdmin   = useIsAdmin();
  const noLeidas  = useNotificacionesStore((s) => s.noLeidas);
  const user      = useAuthStore((s) => s.user);
  const logout    = useAuthStore((s) => s.logout);
  const items     = isAdmin ? navAdmin : navEmpleado;

  const [showPerfil, setShowPerfil] = useState(false);

  return (
    <>
      <nav className="bottom-nav md:hidden">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const isBell   = item.icon === Bell;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(isActive ? "bottom-nav-item-active" : "bottom-nav-item")}
            >
              <div className="relative">
                <item.icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
                {isBell && noLeidas > 0 && (
                  <span
                    className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5"
                    style={{ background: "#EF4444" }}
                  >
                    {noLeidas > 9 ? "9+" : noLeidas}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
            </Link>
          );
        })}

        {/* Botón de perfil / cerrar sesión */}
        <button
          onClick={() => setShowPerfil(true)}
          className="bottom-nav-item"
        >
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[9px] font-bold leading-none">
              {initials(user?.nombre ?? "?")}
            </span>
          </div>
          <span className="text-[10px] font-medium mt-0.5">Cuenta</span>
        </button>
      </nav>

      {/* Panel de perfil */}
      {showPerfil && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setShowPerfil(false)}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-app-surface rounded-t-2xl p-6 pb-10 shadow-xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cerrar */}
            <button
              onClick={() => setShowPerfil(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-content-muted hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Info usuario */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg font-bold">
                  {initials(user?.nombre ?? "?")}
                </span>
              </div>
              <div>
                <p className="font-semibold text-content-primary text-lg leading-tight">
                  {user?.nombre}
                </p>
                <p className="text-sm text-content-muted">{user?.email}</p>
                <span className={cn(
                  "inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full",
                  isAdmin
                    ? "bg-primary-light text-primary"
                    : "bg-gray-100 text-content-secondary"
                )}>
                  {isAdmin ? "👑 Admin" : "👷 Empleado"}
                </span>
              </div>
            </div>

            {/* Botón cerrar sesión */}
            <button
              onClick={async () => { setShowPerfil(false); await logout(); }}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border-2 border-danger text-danger font-semibold text-base hover:bg-danger-light transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </>
  );
}
