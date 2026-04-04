"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Calendar, ShoppingCart, Camera, Bell, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/lib/stores/auth-store";
import { useNotificacionesStore } from "@/lib/stores/notificaciones-store";

const navEmpleado = [
  { href: "/obras",          label: "Obras",    icon: Building2 },
  { href: "/calendario",     label: "Equipo",   icon: Calendar },
  { href: "/materiales",     label: "Material", icon: ShoppingCart },
  { href: "/fotos",          label: "Fotos",    icon: Camera },
  { href: "/notificaciones", label: "Avisos",   icon: Bell },
];

const navAdmin = [
  { href: "/obras",          label: "Obras",    icon: Building2 },
  { href: "/materiales",     label: "Material", icon: ShoppingCart },
  { href: "/calendario",     label: "Equipo",   icon: Calendar },
  { href: "/jornales",       label: "Jornales", icon: Calculator },
  { href: "/notificaciones", label: "Avisos",   icon: Bell },
];

export function BottomNav() {
  const pathname = usePathname();
  const isAdmin  = useIsAdmin();
  const noLeidas = useNotificacionesStore((s) => s.noLeidas);
  const items    = isAdmin ? navAdmin : navEmpleado;

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
    </nav>
  );
}
