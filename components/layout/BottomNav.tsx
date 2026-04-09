"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Calendar, ShoppingCart, Bell, Calculator, LogOut, X, TrendingUp, Settings, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin, useAuthStore } from "@/lib/stores/auth-store";
import { useNotificacionesStore } from "@/lib/stores/notificaciones-store";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { initials } from "@/lib/utils/format";
import { getTenantConfig, type TenantConfig } from "@/lib/insforge/database";
import { EmpresaConfigModal } from "@/components/ui/EmpresaConfigModal";
import { MiPerfilModal } from "@/components/ui/MiPerfilModal";

const navEmpleado = [
  { href: "/obras",          label: "Obras",      icon: Building2 },
  { href: "/calendario",     label: "Calendario", icon: Calendar },
  { href: "/materiales",     label: "Material",   icon: ShoppingCart },
  { href: "/notificaciones", label: "Avisos",     icon: Bell },
];

const navAdmin = [
  { href: "/obras",          label: "Obras",        icon: Building2 },
  { href: "/calendario",     label: "Calendario",   icon: Calendar },
  { href: "/jornales",       label: "Jornales",     icon: Calculator },
  { href: "/facturacion",    label: "Finanzas",     icon: TrendingUp },
  { href: "/notificaciones", label: "Avisos",       icon: Bell },
];

function PerfilSheet({
  open,
  onClose,
  user,
  isAdmin,
  logout,
  tenantId,
}: {
  open: boolean;
  onClose: () => void;
  user: { nombre?: string; email?: string } | null;
  isAdmin: boolean;
  logout: () => Promise<void>;
  tenantId: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [showEmpresa, setShowEmpresa] = useState(false);
  const [empresaConfig, setEmpresaConfig] = useState<TenantConfig | null>(null);
  const [showMiPerfil, setShowMiPerfil] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open && isAdmin && tenantId) {
      getTenantConfig(tenantId).then(setEmpresaConfig);
    }
  }, [open, isAdmin, tenantId]);

  if (!mounted) return null;

  const sheet = open ? createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.55)" }} />
      <div
        style={{ position: "relative", backgroundColor: "#ffffff", borderRadius: "20px 20px 0 0", padding: "24px 24px 48px", boxShadow: "0 -4px 30px rgba(0,0,0,0.2)", zIndex: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 4, backgroundColor: "#e5e7eb", borderRadius: 99, margin: "0 auto 20px" }} />

        {/* Cerrar */}
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: "50%", backgroundColor: "#f3f4f6", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X style={{ width: 16, height: 16, color: "#6b7280" }} />
        </button>

        {/* Info usuario */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #1c3879 0%, #607eaa 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#ffffff", fontSize: 20, fontWeight: 700 }}>{initials(user?.nombre ?? "?")}</span>
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: 18, color: "#111827", margin: 0 }}>{user?.nombre}</p>
            <p style={{ fontSize: 14, color: "#9ca3af", margin: "2px 0 6px" }}>{user?.email}</p>
            <span style={{ fontSize: 12, fontWeight: 500, padding: "2px 10px", borderRadius: 99, backgroundColor: isAdmin ? "#dbeafe" : "#f3f4f6", color: isAdmin ? "#2563eb" : "#6b7280" }}>
              {isAdmin ? "👑 Admin" : "👷 Empleado"}
            </span>
          </div>
        </div>

        {/* Editar mis datos — todos los usuarios */}
        <button
          onClick={() => { onClose(); setTimeout(() => setShowMiPerfil(true), 200); }}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 12, border: "1.5px solid #EEF2F8", backgroundColor: "#f9fafb", cursor: "pointer", marginBottom: 10 }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#EEF2F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Pencil style={{ width: 18, height: 18, color: "#607eaa" }} />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Editar mis datos</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>Nombre, email, contraseña</div>
          </div>
        </button>

        {/* Datos de empresa — solo admin */}
        {isAdmin && (
          <button
            onClick={() => { onClose(); setTimeout(() => setShowEmpresa(true), 200); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 12, border: "1.5px solid #EEF2F8", backgroundColor: "#f9fafb", cursor: "pointer", marginBottom: 10 }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "#EEF2F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Settings style={{ width: 18, height: 18, color: "#607eaa" }} />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Datos de empresa</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Facturas, CIF, IBAN…</div>
            </div>
          </button>
        )}

        {/* Cerrar sesión */}
        <button
          onClick={async () => { onClose(); await logout(); }}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px 0", borderRadius: 12, border: "2px solid #ef4444", backgroundColor: "#ffffff", color: "#ef4444", fontWeight: 600, fontSize: 16, cursor: "pointer" }}
        >
          <LogOut style={{ width: 20, height: 20 }} />
          Cerrar sesión
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  const empresaModal = showEmpresa && tenantId ? (
    <EmpresaConfigModal
      tenantId={tenantId}
      config={empresaConfig}
      onClose={() => setShowEmpresa(false)}
      onSaved={(c) => setEmpresaConfig(c)}
    />
  ) : null;

  const perfilModal = showMiPerfil && user ? (
    <MiPerfilModal
      user={user as any}
      onClose={() => setShowMiPerfil(false)}
    />
  ) : null;

  return <>{sheet}{empresaModal}{perfilModal}</>;
}

export function BottomNav() {
  const pathname  = usePathname();
  const isAdmin   = useIsAdmin();
  const noLeidas  = useNotificacionesStore((s) => s.noLeidas);
  const user      = useAuthStore((s) => s.user);
  const logout    = useAuthStore((s) => s.logout);
  const items     = isAdmin ? navAdmin : navEmpleado;
  const tenantId  = user?.tenant_id ?? null;

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

        {/* Botón perfil */}
        <button
          onClick={() => setShowPerfil(true)}
          className="bottom-nav-item"
        >
          <div
            className="w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-200"
            style={{ background: "#607eaa" }}
          >
            <span className="text-white text-[10px] font-bold leading-none">
              {initials(user?.nombre ?? "?")}
            </span>
          </div>
          <span className="text-[10px] font-medium mt-0.5">Cuenta</span>
        </button>
      </nav>

      <PerfilSheet
        open={showPerfil}
        onClose={() => setShowPerfil(false)}
        user={user}
        isAdmin={isAdmin}
        logout={logout}
        tenantId={tenantId}
      />
    </>
  );
}
