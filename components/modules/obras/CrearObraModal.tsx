"use client";

import { useState, FormEvent } from "react";
import { createObra } from "@/lib/insforge/database";
import type { ObraFormData } from "@/types";
import { X, Loader2, Building2 } from "lucide-react";
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
  const [form, setForm] = useState<ObraFormData>({
    nombre: "",
    direccion: "",
    cliente_nombre: "",
    cliente_telefono: "",
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
    if (!form.nombre.trim() || !form.direccion.trim()) {
      setError("El nombre y la dirección son obligatorios.");
      return;
    }
    setIsLoading(true);
    const { error } = await createObra(tenantId, userId, {
      ...form,
      cliente_nombre: form.cliente_nombre || undefined,
      cliente_telefono: form.cliente_telefono || undefined,
      fecha_fin_estimada: form.fecha_fin_estimada || undefined,
      notas_internas: form.notas_internas || undefined,
    });
    setIsLoading(false);
    if (error) {
      setError((error as any)?.message ?? "Error al crear la obra");
    } else {
      onCreated();
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="icon-container w-9 h-9">
              <Building2 className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-semibold text-content-primary">Nueva obra</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-4 h-4" /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className="label">Nombre / alias *</label>
            <input className="input" placeholder="Reforma Balmes 42" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} required />
          </div>
          <div>
            <label className="label">Dirección completa *</label>
            <DireccionInput
              value={form.direccion}
              onChange={(v) => set("direccion", v)}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Cliente (nombre)</label>
              <input className="input" placeholder="Nombre cliente" value={form.cliente_nombre} onChange={(e) => set("cliente_nombre", e.target.value)} />
            </div>
            <div>
              <label className="label">Teléfono cliente</label>
              <input className="input" type="tel" placeholder="612 345 678" value={form.cliente_telefono} onChange={(e) => set("cliente_telefono", e.target.value)} />
            </div>
          </div>
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
            <textarea className="input resize-none" rows={3} placeholder="Instrucciones, accesos, observaciones..." value={form.notas_internas} onChange={(e) => set("notas_internas", e.target.value)} />
          </div>

          {error && <div className="bg-danger-light text-danger-foreground text-sm rounded-lg px-4 py-3">{error}</div>}
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
