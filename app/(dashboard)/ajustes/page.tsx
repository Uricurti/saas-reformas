"use client";

import { useState, useEffect } from "react";
import {
  User, Building2, Bell, BellOff, Smartphone, Mail,
  ChevronRight, LogOut, Check, Loader2, Shield, KeyRound
} from "lucide-react";
import { useAuthStore, useIsAdmin } from "@/lib/stores/auth-store";
import { useRouter } from "next/navigation";
import {
  getTenantConfig, upsertTenantConfig, type TenantConfig,
  getNotificacionConfig, upsertNotificacionConfig, type NotificacionConfig,
} from "@/lib/insforge/database";
import { MiPerfilModal } from "@/components/ui/MiPerfilModal";
import { EmpresaConfigModal } from "@/components/ui/EmpresaConfigModal";
import { initials } from "@/lib/utils/format";

// ─── Definición de notificaciones disponibles ──────────────────────────────
// Para añadir una nueva push: añade un objeto aquí y ya aparecerá en la UI
const PUSH_NOTIFICATIONS = [
  {
    key: "push_fichaje",
    label: "Recordatorio de fichaje",
    desc: "A las 9am si no has fichado todavía",
    icon: "⏰",
  },
  {
    key: "push_asignacion",
    label: "Cambio de asignación",
    desc: "Cuando el admin te cambia la obra",
    icon: "📋",
  },
];

const EMAIL_NOTIFICATIONS = [
  {
    key: "notif_fichaje",
    label: "Recordatorio de fichaje",
    desc: "Aviso in-app si no has fichado",
    icon: "⏰",
  },
  {
    key: "notif_asignacion",
    label: "Nueva asignación",
    desc: "Cuando te asignan a una obra",
    icon: "🏗️",
  },
  {
    key: "notif_obra_manana",
    label: "Recordatorio obra de mañana",
    desc: "La tarde anterior a tu próxima obra",
    icon: "🌙",
  },
];

// ─── Toggle component ──────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative flex-shrink-0 transition-all duration-200"
      style={{
        width: 44, height: 24, borderRadius: 99,
        backgroundColor: value ? "#607eaa" : "#D1D5DB",
        border: "none", cursor: "pointer", padding: 0,
      }}
    >
      <span
        className="absolute top-0.5 transition-all duration-200"
        style={{
          left: value ? "calc(100% - 22px)" : 2,
          width: 20, height: 20, borderRadius: "50%",
          backgroundColor: "white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

// ─── Row de notificación ───────────────────────────────────────────────────
function NotifRow({
  icon, label, desc, value, onChange, saving,
}: {
  icon: string; label: string; desc: string;
  value: boolean; onChange: (v: boolean) => void; saving?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "#111827" }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{desc}</p>
      </div>
      {saving ? (
        <Loader2 size={18} className="animate-spin flex-shrink-0" style={{ color: "#607eaa" }} />
      ) : (
        <Toggle value={value} onChange={onChange} />
      )}
    </div>
  );
}

// ─── Section card ──────────────────────────────────────────────────────────
function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{ backgroundColor: "white", border: "1.5px solid #EEF2F8", boxShadow: "0 1px 4px rgba(96,126,170,0.06)" }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-5 pb-2">
      <Icon size={16} style={{ color: "#607eaa" }} />
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#607eaa" }}>
        {label}
      </span>
    </div>
  );
}

function ActionRow({
  icon: Icon, label, sub, onClick, danger = false,
}: {
  icon: any; label: string; sub?: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left"
      style={{ backgroundColor: "transparent", border: "none", cursor: "pointer" }}
      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.backgroundColor = "#F9FAFB")}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: danger ? "#FEE2E2" : "#EEF2F8" }}
      >
        <Icon size={18} style={{ color: danger ? "#EF4444" : "#607eaa" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: danger ? "#EF4444" : "#111827" }}>{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{sub}</p>}
      </div>
      {!danger && <ChevronRight size={16} style={{ color: "#D1D5DB", flexShrink: 0 }} />}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, backgroundColor: "#F3F4F6", margin: "0 16px" }} />;
}

// ─── Página principal ──────────────────────────────────────────────────────
export default function AjustesPage() {
  const user     = useAuthStore(s => s.user);
  const logout   = useAuthStore(s => s.logout);
  const isAdmin  = useIsAdmin();
  const router   = useRouter();

  const [showPerfil,  setShowPerfil]  = useState(false);
  const [showEmpresa, setShowEmpresa] = useState(false);

  const [tenantConfig,  setTenantConfig]  = useState<TenantConfig | null>(null);
  const [notifConfig,   setNotifConfig]   = useState<NotificacionConfig | null>(null);
  const [savingNotif,   setSavingNotif]   = useState<string | null>(null);

  // Push prefs → localStorage (por dispositivo)
  const [pushPrefs, setPushPrefs] = useState<Record<string, boolean>>({});
  const [savingPush, setSavingPush] = useState<string | null>(null);

  // Cargar configuración
  useEffect(() => {
    if (!user?.tenant_id) return;
    if (isAdmin) getTenantConfig(user.tenant_id).then(setTenantConfig);
    getNotificacionConfig(user.tenant_id).then(setNotifConfig);

    // Cargar prefs push desde localStorage
    try {
      const stored = localStorage.getItem(`push_prefs_${user.id}`);
      if (stored) {
        setPushPrefs(JSON.parse(stored));
      } else {
        // Por defecto todo activado
        const defaults: Record<string, boolean> = {};
        PUSH_NOTIFICATIONS.forEach(n => { defaults[n.key] = true; });
        setPushPrefs(defaults);
      }
    } catch { /* ignorar */ }
  }, [user?.tenant_id, user?.id, isAdmin]);

  // Guardar prefs push
  async function handlePushToggle(key: string, value: boolean) {
    if (!user?.id) return;
    setSavingPush(key);
    const updated = { ...pushPrefs, [key]: value };
    setPushPrefs(updated);
    try {
      localStorage.setItem(`push_prefs_${user.id}`, JSON.stringify(updated));
      // Actualizar tag en OneSignal para que el cron filtre correctamente
      if (typeof window !== "undefined" && (window as any).OneSignal) {
        const tag = { [key]: value ? "1" : "0" };
        await (window as any).OneSignal.User.addTags(tag);
      }
    } catch { /* ignorar */ }
    await new Promise(r => setTimeout(r, 400)); // feedback visual
    setSavingPush(null);
  }

  // Guardar notif in-app
  async function handleNotifToggle(key: keyof NotificacionConfig, value: boolean) {
    if (!user?.tenant_id || !notifConfig) return;
    setSavingNotif(key);
    const updated = { ...notifConfig, [key]: value };
    setNotifConfig(updated as NotificacionConfig);
    try {
      await upsertNotificacionConfig(user.tenant_id, { [key]: value } as any);
    } catch { /* ignorar */ }
    setSavingNotif(null);
  }

  if (!user) return null;

  const pushPermission = typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "default";

  return (
    <div className="max-w-xl mx-auto px-4 py-6 pb-28 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1c3879 0%, #607eaa 100%)" }}
        >
          <span className="text-white text-xl font-bold">{initials(user.nombre)}</span>
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#111827" }}>{user.nombre}</h1>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>{user.email}</p>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: isAdmin ? "#DBEAFE" : "#F3F4F6",
              color: isAdmin ? "#2563EB" : "#6B7280",
            }}
          >
            {isAdmin ? "👑 Admin" : "👷 Empleado"}
          </span>
        </div>
      </div>

      {/* ── Sección: Mi cuenta ─────────────────────────────────────────── */}
      <SectionCard>
        <SectionTitle icon={User} label="Mi cuenta" />
        <ActionRow
          icon={User}
          label="Editar mis datos"
          sub="Nombre, email"
          onClick={() => setShowPerfil(true)}
        />
        <Divider />
        <ActionRow
          icon={KeyRound}
          label="Cambiar contraseña"
          sub="Actualiza tu contraseña de acceso"
          onClick={() => setShowPerfil(true)}
        />
      </SectionCard>

      {/* ── Sección: Empresa (solo admin) ──────────────────────────────── */}
      {isAdmin && (
        <SectionCard>
          <SectionTitle icon={Building2} label="Empresa" />
          <ActionRow
            icon={Building2}
            label="Datos de empresa"
            sub={tenantConfig?.empresa_nombre ?? "CIF, IBAN, dirección fiscal…"}
            onClick={() => setShowEmpresa(true)}
          />
        </SectionCard>
      )}

      {/* ── Sección: Notificaciones Push ───────────────────────────────── */}
      <SectionCard>
        <SectionTitle icon={Smartphone} label="Notificaciones Push" />

        {/* Aviso si no tiene permiso */}
        {pushPermission !== "granted" && (
          <div
            className="mx-4 mb-3 px-3 py-2.5 rounded-xl flex items-center gap-2"
            style={{ backgroundColor: "#FEF3C7", border: "1px solid #FCD34D" }}
          >
            <BellOff size={16} style={{ color: "#D97706", flexShrink: 0 }} />
            <p className="text-xs" style={{ color: "#92400E" }}>
              {pushPermission === "denied"
                ? "Las notificaciones están bloqueadas en tu navegador. Actívalas desde la configuración del navegador."
                : "Activa los permisos de notificaciones para recibir avisos en tu móvil."}
            </p>
          </div>
        )}

        <div className="px-4 divide-y" style={{ borderColor: "#F3F4F6" }}>
          {PUSH_NOTIFICATIONS.map(n => (
            <NotifRow
              key={n.key}
              icon={n.icon}
              label={n.label}
              desc={n.desc}
              value={pushPrefs[n.key] ?? true}
              onChange={v => handlePushToggle(n.key, v)}
              saving={savingPush === n.key}
            />
          ))}
        </div>
        <div className="px-4 pb-4 pt-1">
          <p className="text-xs" style={{ color: "#9CA3AF" }}>
            Las notificaciones push se reciben en el móvil aunque la app esté cerrada.
          </p>
        </div>
      </SectionCard>

      {/* ── Sección: Notificaciones in-app ─────────────────────────────── */}
      <SectionCard>
        <SectionTitle icon={Bell} label="Notificaciones en la app" />
        <div className="px-4 divide-y" style={{ borderColor: "#F3F4F6" }}>
          {notifConfig ? EMAIL_NOTIFICATIONS.map(n => (
            <NotifRow
              key={n.key}
              icon={n.icon}
              label={n.label}
              desc={n.desc}
              value={(notifConfig as any)[n.key] ?? true}
              onChange={v => handleNotifToggle(n.key as any, v)}
              saving={savingNotif === n.key}
            />
          )) : (
            <div className="py-4 flex justify-center">
              <Loader2 size={20} className="animate-spin" style={{ color: "#607eaa" }} />
            </div>
          )}
        </div>
        <div className="px-4 pb-4 pt-1">
          <p className="text-xs" style={{ color: "#9CA3AF" }}>
            Estas notificaciones aparecen en la campana 🔔 dentro de la app.
          </p>
        </div>
      </SectionCard>

      {/* ── Sección: Sesión ────────────────────────────────────────────── */}
      <SectionCard>
        <SectionTitle icon={Shield} label="Sesión" />
        <ActionRow
          icon={LogOut}
          label="Cerrar sesión"
          onClick={async () => { await logout(); router.replace("/login"); }}
          danger
        />
      </SectionCard>

      {/* Versión */}
      <p className="text-center text-xs pb-4" style={{ color: "#D1D5DB" }}>
        ReforLife · v1.0
      </p>

      {/* Modales */}
      {showPerfil && (
        <MiPerfilModal user={user as any} onClose={() => setShowPerfil(false)} />
      )}
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
