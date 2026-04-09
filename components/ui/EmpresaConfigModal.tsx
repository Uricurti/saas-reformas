"use client";

import { useState, useEffect } from "react";
import { upsertTenantConfig, type TenantConfig, getNotificacionConfig, upsertNotificacionConfig, type NotificacionConfig } from "@/lib/insforge/database";
import { X, Building2, Check, Loader2, Bell } from "lucide-react";

interface Props {
  tenantId: string;
  config: TenantConfig | null;
  onClose: () => void;
  onSaved?: (c: TenantConfig) => void;
}

export function EmpresaConfigModal({ tenantId, config, onClose, onSaved }: Props) {
  const [nombre,  setNombre]  = useState(config?.empresa_nombre ?? "");
  const [cif,     setCif]     = useState(config?.empresa_cif ?? "");
  const [dir,     setDir]     = useState(config?.empresa_direccion ?? "");
  const [tel,     setTel]     = useState(config?.empresa_telefono ?? "");
  const [email,   setEmail]   = useState(config?.empresa_email ?? "");
  const [cuenta,  setCuenta]  = useState(config?.numero_cuenta ?? "");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  // Notificaciones
  const [notifConfig, setNotifConfig] = useState<NotificacionConfig | null>(null);
  const [notifAsig,   setNotifAsig]   = useState(true);
  const [notifFich,   setNotifFich]   = useState(true);
  const [notifManana, setNotifManana] = useState(true);

  useEffect(() => {
    getNotificacionConfig(tenantId).then((c) => {
      setNotifConfig(c);
      setNotifAsig(c.notif_asignacion);
      setNotifFich(c.notif_fichaje);
      setNotifManana(c.notif_obra_manana);
    });
  }, [tenantId]);

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    const [{ data }] = await Promise.all([
      upsertTenantConfig(tenantId, {
        empresa_nombre:    nombre || null,
        empresa_cif:       cif || null,
        empresa_direccion: dir || null,
        empresa_telefono:  tel || null,
        empresa_email:     email || null,
        numero_cuenta:     cuenta || null,
      }),
      upsertNotificacionConfig(tenantId, {
        notif_asignacion:  notifAsig,
        notif_fichaje:     notifFich,
        notif_obra_manana: notifManana,
      }),
    ]);
    setSaving(false);
    if (data) {
      onSaved?.(data as TenantConfig);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 800);
    }
  }

  const inputStyle = {
    width: "100%",
    border: "1.5px solid #e5e7eb",
    borderRadius: 9,
    padding: "9px 13px",
    fontSize: 14,
    boxSizing: "border-box" as const,
    outline: "none",
    transition: "border-color 0.15s",
    color: "#111827",
  };

  const focusBorder = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#607eaa";
  };
  const blurBorder = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#e5e7eb";
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} onClick={onClose} />
      <div style={{
        position: "relative",
        background: "#fff",
        borderRadius: 20,
        padding: "28px 28px 24px",
        width: "100%",
        maxWidth: 460,
        boxShadow: "0 32px 80px rgba(0,0,0,0.22)",
        maxHeight: "90vh",
        overflowY: "auto",
      }}>
        {/* Cerrar */}
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, border: "none", background: "#f3f4f6", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X style={{ width: 14, height: 14, color: "#6b7280" }} />
        </button>

        {/* Título */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "#EEF2F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Building2 style={{ width: 20, height: 20, color: "#607eaa" }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Datos de empresa</h3>
            <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>Aparecerán en la cabecera de todas las facturas</p>
          </div>
        </div>

        {/* Campos */}
        {[
          { label: "Nombre de la empresa *", value: nombre, set: setNombre, placeholder: "Reformas García S.L." },
          { label: "CIF / NIF",              value: cif,    set: setCif,    placeholder: "B12345678" },
          { label: "Dirección",              value: dir,    set: setDir,    placeholder: "C/ Mayor 10, 08001 Barcelona" },
          { label: "Teléfono",               value: tel,    set: setTel,    placeholder: "+34 600 000 000" },
          { label: "Email",                  value: email,  set: setEmail,  placeholder: "info@reformas.com" },
        ].map((f) => (
          <div key={f.label} style={{ marginBottom: 13 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{f.label}</label>
            <input
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              placeholder={f.placeholder}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>
        ))}

        {/* Separador + Número de cuenta */}
        <div style={{ borderTop: "1.5px dashed #e5e7eb", paddingTop: 14, marginTop: 4, marginBottom: 13 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
            Número de cuenta (IBAN)
          </label>
          <input
            value={cuenta}
            onChange={(e) => setCuenta(e.target.value.toUpperCase())}
            placeholder="ES12 1234 5678 9012 3456 7890"
            style={{ ...inputStyle }}
            onFocus={focusBorder}
            onBlur={blurBorder}
          />
          <p style={{ margin: "5px 0 0", fontSize: 11, color: "#9ca3af" }}>
            Aparecerá al pie de cada factura como instrucción de pago por transferencia.
          </p>
        </div>

        {/* ── Notificaciones por email ── */}
        <div style={{ borderTop: "1.5px dashed #e5e7eb", paddingTop: 18, marginTop: 4, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "#EEF2F8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell style={{ width: 16, height: 16, color: "#607eaa" }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111827" }}>Notificaciones por email</p>
              <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>Activa o desactiva cada tipo de aviso</p>
            </div>
          </div>

          {[
            { label: "Nueva obra asignada",      desc: "Email al empleado al asignarle una obra",         val: notifAsig,   set: setNotifAsig },
            { label: "Recordatorio de fichaje",  desc: "Si no ha fichado a las 8pm, recibe un aviso",     val: notifFich,   set: setNotifFich },
            { label: "Obra de mañana",           desc: "Dirección y hora de la obra del día siguiente",   val: notifManana, set: setNotifManana },
          ].map((item) => (
            <div
              key={item.label}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: 11, border: "1.5px solid #f0f0f4", marginBottom: 8, background: item.val ? "#f8faff" : "#fafafa" }}
            >
              <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{item.label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>{item.desc}</p>
              </div>
              {/* Toggle switch */}
              <button
                onClick={() => item.set(!item.val)}
                style={{
                  width: 44, height: 24, borderRadius: 99, border: "none", cursor: "pointer",
                  background: item.val ? "#607eaa" : "#d1d5db",
                  position: "relative", flexShrink: 0, transition: "background 0.2s",
                }}
              >
                <span style={{
                  position: "absolute", top: 3,
                  left: item.val ? "calc(100% - 21px)" : 3,
                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                  transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </button>
            </div>
          ))}
        </div>

        {/* Guardar */}
        <button
          onClick={handleSave}
          disabled={saving || !nombre.trim()}
          style={{
            width: "100%",
            marginTop: 4,
            background: saved ? "#16a34a" : (saving || !nombre.trim() ? "#94a3b8" : "#607eaa"),
            color: "#fff",
            border: "none",
            borderRadius: 11,
            padding: "12px 0",
            fontWeight: 700,
            fontSize: 15,
            cursor: saving || !nombre.trim() ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "background 0.2s",
          }}
        >
          {saving ? (
            <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
          ) : saved ? (
            <Check style={{ width: 16, height: 16 }} />
          ) : (
            <Check style={{ width: 16, height: 16 }} />
          )}
          {saved ? "¡Guardado!" : saving ? "Guardando..." : "Guardar datos"}
        </button>
      </div>
    </div>
  );
}
