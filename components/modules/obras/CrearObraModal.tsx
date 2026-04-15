"use client";

import { useState, FormEvent } from "react";
import { createObra } from "@/lib/insforge/database";
import type { ObraFormData, ObraEstado } from "@/types";
import { X, Loader2, Building2, User, MapPin, Clock, Zap, CalendarClock } from "lucide-react";
import { DireccionInput } from "@/components/ui/DireccionInput";

interface Props {
  tenantId: string;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}

export function CrearObraModal({ tenantId, userId, onClose, onCreated }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [esProxima, setEsProxima] = useState(false);
  const [form, setForm] = useState<ObraFormData>({
    nombre: "",
    direccion: "",
    codigo_postal: "",
    poblacion: "",
    cliente_nombre: "",
    cliente_telefono: "",
    cliente_dni_nie_cif: "",
    fecha_inicio: new Date().toISOString().split("T")[0],
    fecha_fin_estimada: "",
    notas_internas: "",
  });

  function set(field: keyof ObraFormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Validación de campos obligatorios
    if (!form.nombre.trim()) { setError("El nombre de la obra es obligatorio."); return; }
    if (!form.direccion.trim()) { setError("La dirección de la obra es obligatoria."); return; }
    if (!form.codigo_postal?.trim()) { setError("El código postal es obligatorio."); return; }
    if (!form.poblacion?.trim()) { setError("La población es obligatoria."); return; }
    if (!form.cliente_nombre?.trim()) { setError("El nombre y apellidos del cliente son obligatorios."); return; }
    if (!form.cliente_telefono?.trim()) { setError("El teléfono del cliente es obligatorio."); return; }
    if (!form.cliente_dni_nie_cif?.trim()) { setError("El DNI/NIE/CIF del cliente es obligatorio."); return; }

    setIsLoading(true);
    const { error } = await createObra(tenantId, userId, {
      ...form,
      cliente_nombre:      form.cliente_nombre || undefined,
      cliente_telefono:    form.cliente_telefono || undefined,
      cliente_dni_nie_cif: form.cliente_dni_nie_cif || undefined,
      codigo_postal:       form.codigo_postal || undefined,
      poblacion:           form.poblacion || undefined,
      fecha_fin_estimada:  form.fecha_fin_estimada || undefined,
      notas_internas:      form.notas_internas || undefined,
    }, esProxima ? "proxima" : "activa");
    setIsLoading(false);
    if (error) {
      setError((error as any)?.message ?? "Error al crear la obra");
    } else {
      onCreated();
    }
  }

  // Sección de cabecera de sección
  function SectionHeader({ icon: Icon, label }: { icon: any; label: string }) {
    return (
      <div className="flex items-center gap-2 pt-2 pb-1" style={{ borderBottom: "1.5px solid #EEF2F8" }}>
        <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: "#EEF2F8" }}>
          <Icon className="w-3.5 h-3.5" style={{ color: "#607eaa" }} />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#607eaa" }}>{label}</span>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="icon-container w-9 h-9">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-content-primary">Nueva obra</h2>
              <p className="text-xs" style={{ color: "#9CA3AF" }}>Todos los campos marcados con * son obligatorios</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-4 h-4" /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* ── Datos de la obra ── */}
          <SectionHeader icon={Building2} label="Datos de la obra" />

          <div>
            <label className="label">Nombre / alias *</label>
            <input
              className="input"
              placeholder="Reforma Baño Principal"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Dirección completa *</label>
            <DireccionInput
              value={form.direccion}
              onChange={(v) => set("direccion", v)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Código postal *</label>
              <input
                className="input"
                placeholder="08001"
                maxLength={10}
                value={form.codigo_postal}
                onChange={(e) => set("codigo_postal", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Población *</label>
              <input
                className="input"
                placeholder="Barcelona"
                value={form.poblacion}
                onChange={(e) => set("poblacion", e.target.value)}
              />
            </div>
          </div>

          {/* ── Datos del cliente ── */}
          <SectionHeader icon={User} label="Datos del cliente" />

          <div>
            <label className="label">Nombre y apellidos *</label>
            <input
              className="input"
              placeholder="Juan García López"
              value={form.cliente_nombre}
              onChange={(e) => set("cliente_nombre", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">DNI / NIE / CIF *</label>
              <input
                className="input"
                placeholder="12345678A"
                value={form.cliente_dni_nie_cif}
                onChange={(e) => set("cliente_dni_nie_cif", e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="label">Teléfono *</label>
              <input
                className="input"
                type="tel"
                placeholder="612 345 678"
                value={form.cliente_telefono}
                onChange={(e) => set("cliente_telefono", e.target.value)}
              />
            </div>
          </div>

          {/* ── Fechas ── */}
          <SectionHeader icon={MapPin} label="Planificación" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha inicio *</label>
              <input className="input" type="date" value={form.fecha_inicio} onChange={(e) => set("fecha_inicio", e.target.value)} required />
            </div>
            <div>
              <label className="label">Fin estimado</label>
              <input className="input" type="date" value={form.fecha_fin_estimada} onChange={(e) => set("fecha_fin_estimada", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Notas internas (solo admin)</label>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="Instrucciones, accesos, observaciones..."
              value={form.notas_internas}
              onChange={(e) => set("notas_internas", e.target.value)}
            />
          </div>

          {/* ── Tipo de obra ── */}
          <SectionHeader icon={Clock} label="¿Cuándo empieza esta obra?" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* Opción: Activa ahora */}
            <button
              type="button"
              onClick={() => setEsProxima(false)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 10, padding: "16px 12px",
                borderRadius: 14, cursor: "pointer",
                border: `2px solid ${!esProxima ? "#607eaa" : "#e5e7eb"}`,
                background: !esProxima ? "#EEF2F8" : "#fafafa",
                transition: "all 0.15s ease",
                minHeight: 100,
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: !esProxima ? "#607eaa" : "#e5e7eb",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s ease",
              }}>
                <Zap style={{ width: 20, height: 20, color: !esProxima ? "#fff" : "#9ca3af" }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: !esProxima ? "#1c3879" : "#374151" }}>
                  Activa ahora
                </div>
                <div style={{ fontSize: 11, color: !esProxima ? "#607eaa" : "#9ca3af", marginTop: 2, lineHeight: 1.3 }}>
                  Ya está en marcha,<br />se puede fichar
                </div>
              </div>
              {!esProxima && (
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#607eaa", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>
                </div>
              )}
            </button>

            {/* Opción: Próxima */}
            <button
              type="button"
              onClick={() => setEsProxima(true)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 10, padding: "16px 12px",
                borderRadius: 14, cursor: "pointer",
                border: `2px solid ${esProxima ? "#7c3aed" : "#e5e7eb"}`,
                background: esProxima ? "#EDE9FE" : "#fafafa",
                transition: "all 0.15s ease",
                minHeight: 100,
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: esProxima ? "#7c3aed" : "#e5e7eb",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s ease",
              }}>
                <CalendarClock style={{ width: 20, height: 20, color: esProxima ? "#fff" : "#9ca3af" }} />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: esProxima ? "#5B21B6" : "#374151" }}>
                  Próxima obra
                </div>
                <div style={{ fontSize: 11, color: esProxima ? "#7c3aed" : "#9ca3af", marginTop: 2, lineHeight: 1.3 }}>
                  Aún no ha empezado,<br />para planificar
                </div>
              </div>
              {esProxima && (
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>
                </div>
              )}
            </button>
          </div>

          {error && (
            <div className="bg-danger-light text-danger-foreground text-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-border flex-shrink-0 flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={handleSubmit as any}
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando...</> : "Crear obra"}
          </button>
        </div>
      </div>
    </div>
  );
}
