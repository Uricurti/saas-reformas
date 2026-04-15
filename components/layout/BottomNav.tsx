"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Calendar, ShoppingCart, Bell, Calculator, TrendingUp, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin, useAuthStore } from "@/lib/stores/auth-store";
import { useNotificacionesStore } from "@/lib/stores/notificaciones-store";
import { initials } from "@/lib/utils/format";

const navEmpleado = [
  { href: "/obras",          label: "Obras",      icon: Building2 },
  { href: "/calendario",     label: "Calendario", icon: Calendar },
  { href: "/materiales",     label: "Material",   icon: ShoppingCart },
  { href: "/notificaciones", label: "Avisos",     icon: Bell },
];

const navAdmin = [
  { href: "/dashboard",   label: "Dashboard",  icon: LayoutDashboard },
  { href: "/obras",       label: "Obras",      icon: Building2 },
  { href: "/calendario",  label: "Calendario", icon: Calendar },
  { href: "/jornales",    label: "Jornales",   icon: Calculator },
  { href: "/facturacion", label: "Finanzas",   icon: TrendingUp },
];

export function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const isAdmin  = useIsAdmin();
  const noLeidas = useNotificacionesStore((s) => s.noLeidas);
  const user     = useAuthStore((s) => s.user);
  const items    = isAdmin ? navAdmin : navEmpleado;

  const isAjustesActive = pathname === "/ajustes";

  return (
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
              <item.icon
                className={cn(
                  "w-[22px] h-[22px] transition-transform duration-200",
                  isActive ? "stroke-[2.5] scale-110" : "scale-100"
                )}
              />
              {isBell && noLeidas > 0 && (
                <span
                  className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5"
                  style={{ background: "#EF4444" }}
                >
                  {noLeidas > 9 ? "9+" : noLeidas}
                </span>
              )}
            </div>
            <span className={cn(
              "text-[10px] mt-0.5 transition-all duration-200",
              isActive ? "font-bold" : "font-medium"
            )}>
              {item.label}
            </span>
          </Link>
        );
      })}

      {/* Avatar → navega a /ajustes */}
      <button
        onClick={() => router.push("/ajustes")}
        className={cn(isAjustesActive ? "bottom-nav-item-active" : "bottom-nav-item")}
      >
        <div
          className="w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #1c3879 0%, #607eaa 100%)",
            transform: isAjustesActive ? "scale(1.1)" : "scale(1)",
            transition: "transform 0.2s ease",
          }}
        >
          <span className="text-white text-[10px] font-bold leading-none">
            {initials(user?.nombre ?? "?")}
          </span>
        </div>
        <span className={cn("text-[10px] mt-0.5", isAjustesActive ? "font-bold" : "font-medium")}>
          Cuenta
        </span>
      </button>
    </nav>
  );
}
