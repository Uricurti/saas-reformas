"use client";

import { useState, useEffect } from "react";
import {
  User, Building2, Bell, BellOff, Smartphone,
  ChevronRight, LogOut, Loader2, Shield, KeyRound, SlidersHorizontal
} from "lucide-react";
import { useAuthStore, useIsAdmin } from "@/lib/stores/auth-store";
import { useRouter } from "next/navigation";
import {
  getTenantConfig, type TenantConfig,
  getNotificacionConfig, upsertNotificacionConfig, type NotificacionConfig,
} from "@/lib/insforge/database";
import { MiPerfilModal } from "@/components/ui/MiPerfilModal";
import { EmpresaConfigModal } from "@/components/ui/EmpresaConfigModal";
import { initials } from "@/lib/utils/format";

// ─── Notificaciones disponibles ─────────────────────────────────────────────
const PUSH_NOTIFICATIONS = [
  { key: "push_fichaje",    label: "Recordatorio de fichaje", desc: "A las 9am si aún no has fichado", icon: "⏰" },
  { key: "push_asignacion", label: "Cambio de asignación",    desc: "Cuando te cambian la obra asignada", icon: "📋" },
];

const INAPP_NOTIFICATIONS = [
  { key: "notif_fichaje" as keyof NotificacionConfig,      label: "Recordatorio de fichaje",    desc: "Aviso en la campana si no has fichado", icon: "⏰" },
  { key: "notif_asignacion" as keyof NotificacionConfig,   label: "Nueva asignación",           desc: "Cuando te asignan a una nueva obra", icon: "🏗️" },
  { key: "notif_obra_manana" as keyof NotificacionConfig,  label: "Recordatorio obra de mañana",desc: "La tarde anterior a tu próxima obra", icon: "🌙" },
];

// ─── Toggle ──────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      role="switch"
      aria-checked={value}
      style={{
        width: 48, height: 26, borderRadius: 99, padding: 0, border: "none",
        backgroundColor: value ? "#607eaa" : "#D1D5DB",
        cursor: disabled ? "default" : "pointer", flexShrink: 0, position: "relative",
        transition: "background-color 0.2s", opacity: disabled ? 0.5 : 1,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{
        position: "absolute", top: 3,
        left: value ? "calc(100% - 23px)" : 3,
        width: 20, height: 20, borderRadius: "50%",
        backgroundColor: "white", boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

// ─── Fila notificación ────────────────────────────────────────────────────────
function NotifRow({ icon, label, desc, value, onChange, saving }: {
  icon: string; label: string; desc: string;
  value: boolean; onChange: (v: boolean) => void; saving?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <span style={{ fontSize: 20, width: 26, textAlign: "center", flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>{desc}</p>
      </div>
      {saving
        ? <Loader2 size={18} className="animate-spin" style={{ color: "#607eaa", flexShrink: 0 }} />
        : <Toggle value={value} onChange={onChange} />
      }
    </div>
  );
}

// ─── Card con título ──────────────────────────────────────────────────────────
function Card({ icon: Icon, title, children, footer }: {
  icon: any; title: string; children: React.ReactNode; footer?: string;
}) {
  return (
    <div style={{
      backgroundColor: "white", borderRadius: 16,
      border: "1.5px solid #EEF2F8", boxShadow: "0 1px 6px rgba(96,126,170,0.07)",
      overflow: "hidden",
    }}>
      {/* Header de la card */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 18px 12px",
        borderBottom: "1px solid #F3F4F6",
        backgroundColor: "#FAFBFD",
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          backgroundColor: "#EEF2F8",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={14} style={{ color: "#607eaa" }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{title}</span>
      </div>
      <div style={{ padding: "4px 18px 8px" }}>
        {children}
      </div>
      {footer && (
        <p style={{ fontSize: 11, color: "#9CA3AF", padding: "0 18px 14px", margin: 0 }}>{footer}</p>
      )}
    </div>
  );
}

// ─── Botón de acción ──────────────────────────────────────────────────────────
function ActionRow({ icon: Icon, label, sub, onClick, danger = false, last = false }: {
  icon: any; label: string; sub?: string; onClick: () => void; danger?: boolean; last?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <>
      <button
        onClick={onClick}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        style={{
          width: "100%", border: "none", cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 0", backgroundColor: "transparent",
          transition: "opacity 0.1s", opacity: pressed ? 0.6 : 1,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          backgroundColor: danger ? "#FEE2E2" : "#EEF2F8",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={17} style={{ color: danger ? "#EF4444" : "#607eaa" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: danger ? "#EF4444" : "#111827", margin: 0 }}>{label}</p>
          {sub && <p style={{ fontSize: 12, color: "#9CA3AF", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</p>}
        </div>
        {!danger && <ChevronRight size={16} style={{ color: "#D1D5DB", flexShrink: 0 }} />}
      </button>
      {!last && <div style={{ height: 1, backgroundColor: "#F3F4F6", margin: "0" }} />}
    </>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function AjustesPage() {
  const user    = useAuthStore(s => s.user);
  const logout  = useAuthStore(s => s.logout);
  const isAdmin = useIsAdmin();
  const router  = useRouter();

  const [showPerfil,  setShowPerfil]  = useState(false);
  const [showEmpresa, setShowEmpresa] = useState(false);
  const [tenantConfig,  setTenantConfig]  = useState<TenantConfig | null>(null);
  const [notifConfig,   setNotifConfig]   = useState<NotificacionConfig | null>(null);
  const [savingNotif,   setSavingNotif]   = useState<string | null>(null);
  const [pushPrefs,     setPushPrefs]     = useState<Record<string, boolean>>({});
  const [savingPush,    setSavingPush]    = useState<string | null>(null);

  useEffect(() => {
    if (!user?.tenant_id) return;
    if (isAdmin) getTenantConfig(user.tenant_id).then(setTenantConfig);
    getNotificacionConfig(user.tenant_id).then(setNotifConfig);
    try {
      const stored = localStorage.getItem(`push_prefs_${user.id}`);
      if (stored) {
        setPushPrefs(JSON.parse(stored));
      } else {
        const d: Record<string, boolean> = {};
        PUSH_NOTIFICATIONS.forEach(n => { d[n.key] = true; });
        setPushPrefs(d);
      }
    } catch { /**/ }
  }, [user?.tenant_id, user?.id, isAdmin]);

  async function handlePushToggle(key: string, value: boolean) {
    if (!user?.id) return;
    setSavingPush(key);
    const updated = { ...pushPrefs, [key]: value };
    setPushPrefs(updated);
    try {
      localStorage.setItem(`push_prefs_${user.id}`, JSON.stringify(updated));
      if (typeof window !== "undefined" && (window as any).OneSignal) {
        await (window as any).OneSignal.User.addTags({ [key]: value ? "1" : "0" });
      }
    } catch { /**/ }
    await new Promise(r => setTimeout(r, 350));
    setSavingPush(null);
  }

  async function handleNotifToggle(key: keyof NotificacionConfig, value: boolean) {
    if (!user?.tenant_id || !notifConfig) return;
    setSavingNotif(String(key));
    setNotifConfig({ ...notifConfig, [key]: value } as NotificacionConfig);
    try { await upsertNotificacionConfig(user.tenant_id, { [key]: value } as any); } catch { /**/ }
    setSavingNotif(null);
  }

  if (!user) return null;

  const pushPermission = typeof window !== "undefined" && "Notification" in window
    ? Notification.permission : "default";

  return (
    <div style={{ padding: "28px 28px 80px", maxWidth: 1100, margin: "0 auto" }}>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <SlidersHorizontal size={22} style={{ color: "#607eaa" }} />
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>Ajustes</h1>
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>Gestiona tu cuenta, empresa y notificaciones</p>
        </div>
      </div>

      {/* ── Layout principal: 2 columnas en desktop, 1 en móvil ─────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 20,
        alignItems: "start",
      }}>

        {/* ── COLUMNA IZQUIERDA ──────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Perfil usuario */}
          <div style={{
            backgroundColor: "white", borderRadius: 16,
            border: "1.5px solid #EEF2F8", boxShadow: "0 1px 6px rgba(96,126,170,0.07)",
            padding: "20px",
          }}>
            {/* Avatar + info */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid #F3F4F6" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                background: "linear-gradient(135deg, #1c3879 0%, #607eaa 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ color: "white", fontSize: 20, fontWeight: 700 }}>{initials(user.nombre)}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>{user.nombre}</p>
                <p style={{ fontSize: 13, color: "#9CA3AF", margin: "2px 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99,
                  backgroundColor: isAdmin ? "#DBEAFE" : "#F3F4F6",
                  color: isAdmin ? "#2563EB" : "#6B7280",
                }}>
                  {isAdmin ? "👑 Admin" : "👷 Empleado"}
                </span>
              </div>
            </div>

            {/* Acciones cuenta */}
            <ActionRow icon={User}     label="Editar mis datos"   sub="Nombre y email"                   onClick={() => setShowPerfil(true)} />
            <ActionRow icon={KeyRound} label="Cambiar contraseña" sub="Actualiza tu contraseña de acceso" onClick={() => setShowPerfil(true)} last />
          </div>

          {/* Empresa — solo admin */}
          {isAdmin && (
            <Card icon={Building2} title="Empresa">
              <ActionRow
                icon={Building2}
                label="Datos de empresa"
                sub={tenantConfig?.empresa_nombre ?? "CIF, IBAN, dirección fiscal…"}
                onClick={() => setShowEmpresa(true)}
                last
              />
            </Card>
          )}

          {/* Sesión */}
          <Card icon={Shield} title="Sesión">
            <ActionRow
              icon={LogOut}
              label="Cerrar sesión"
              onClick={async () => { await logout(); router.replace("/login"); }}
              danger
              last
            />
          </Card>

        </div>

        {/* ── COLUMNA DERECHA ────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Notificaciones Push */}
          <Card
            icon={Smartphone}
            title="Notificaciones Push"
            footer="Se reciben en el móvil aunque la app esté cerrada."
          >
            {/* Aviso permisos */}
            {pushPermission !== "granted" && (
              <div style={{
                margin: "10px 0 4px",
                padding: "10px 12px", borderRadius: 10,
                backgroundColor: pushPermission === "denied" ? "#FEF2F2" : "#FEF9C3",
                border: `1px solid ${pushPermission === "denied" ? "#FECACA" : "#FDE68A"}`,
                display: "flex", alignItems: "flex-start", gap: 8,
              }}>
                <BellOff size={15} style={{ color: pushPermission === "denied" ? "#EF4444" : "#D97706", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: pushPermission === "denied" ? "#991B1B" : "#92400E", margin: 0, lineHeight: 1.5 }}>
                  {pushPermission === "denied"
                    ? "Notificaciones bloqueadas. Actívalas desde los ajustes de tu navegador."
                    : "Activa los permisos para recibir notificaciones en tu dispositivo."}
                </p>
              </div>
            )}
            <div style={{ marginTop: 4 }}>
              {PUSH_NOTIFICATIONS.map((n, i) => (
                <div key={n.key}>
                  <NotifRow
                    icon={n.icon} label={n.label} desc={n.desc}
                    value={pushPrefs[n.key] ?? true}
                    onChange={v => handlePushToggle(n.key, v)}
                    saving={savingPush === n.key}
                  />
                  {i < PUSH_NOTIFICATIONS.length - 1 && <div style={{ height: 1, backgroundColor: "#F3F4F6" }} />}
                </div>
              ))}
            </div>
          </Card>

          {/* Notificaciones in-app */}
          <Card
            icon={Bell}
            title="Notificaciones en la app"
            footer="Aparecen en la campana 🔔 dentro de la app."
          >
            <div style={{ marginTop: 4 }}>
              {notifConfig ? (
                INAPP_NOTIFICATIONS.map((n, i) => (
                  <div key={n.key as string}>
                    <NotifRow
                      icon={n.icon} label={n.label} desc={n.desc}
                      value={(notifConfig as any)[n.key] ?? true}
                      onChange={v => handleNotifToggle(n.key, v)}
                      saving={savingNotif === String(n.key)}
                    />
                    {i < INAPP_NOTIFICATIONS.length - 1 && <div style={{ height: 1, backgroundColor: "#F3F4F6" }} />}
                  </div>
                ))
              ) : (
                <div style={{ padding: "20px 0", display: "flex", justifyContent: "center" }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: "#607eaa" }} />
                </div>
              )}
            </div>
          </Card>

        </div>
      </div>

      <p style={{ textAlign: "center", fontSize: 12, color: "#D1D5DB", marginTop: 28 }}>
        ReforLife · v1.0
      </p>

      {/* Modales */}
      {showPerfil && <MiPerfilModal user={user as any} onClose={() => setShowPerfil(false)} />}
      {showEmpresa && user?.tenant_id && (
        <EmpresaConfigModal
          tenantId={user.tenant_id}
          config={tenantConfig}
          onClose={() => setShowEmpresa(false)}
          onSaved={c => setTenantConfig(c)}
        />
      )}
    </div>
  );
}
