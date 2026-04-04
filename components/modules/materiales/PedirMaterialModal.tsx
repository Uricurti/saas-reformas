"use client";

import { useState, useEffect, FormEvent } from "react";
import { pedirMaterial } from "@/lib/insforge/database";
import { getObrasActivas } from "@/lib/insforge/database";
import type { MaterialFormData, MaterialCategoria, MaterialUrgencia, Obra } from "@/types";
import { X, Loader2, ShoppingCart } from "lucide-react";

interface Props {
  tenantId: string;
  userId: string;
  obraIdInicial?: string | null;
  onClose: () => void;
  onCreated: () => void;
}

const categorias: { value: MaterialCategoria; label: string; emoji: string }[] = [
  { value: "electricidad", label: "Electricidad", emoji: "⚡" },
  { value: "fontaneria", label: "Fontanería", emoji: "🔧" },
  { value: "albanileria", label: "Albañilería", emoji: "🧱" },
  { value: "pintura", label: "Pintura", emoji: "🎨" },
  { value: "carpinteria", label: "Carpintería", emoji: "🪵" },
  { value: "otro", label: "Otro", emoji: "📦" },
];

const unidadesComunes = ["unidad", "sacos", "metros", "litros", "kg", "caja", "rollo", "paquete"];

export function PedirMaterialModal({ tenantId, userId, obraIdInicial, onClose, onCreated }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [obras, setObras] = useState<Obra[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<MaterialFormData & { obra_id: string }>({
    obra_id: obraIdInicial ?? "",
    descripcion: "",
    categoria: "otro",
    cantidad: 1,
    unidad: "unidad",
    urgencia: "normal",
    nota: "",
  });

  useEffect(() => {
    cargarObras();
  }, []);

  async function cargarObras() {
    const { data } = await getObrasActivas(tenantId);
    setObras((data as Obra[]) ?? []);
    if (!form.obra_id && data && data.length > 0) {
      setForm((f) => ({ ...f, obra_id: (data[0] as Obra).id }));
    }
  }

  function set<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.descripcion.trim()) { setError("Indica qué material necesitas."); return; }
    if (!form.obra_id) { setError("Selecciona la obra."); return; }
    setIsLoading(true);
    const { error } = await pedirMaterial(tenantId, form.obra_id, userId, {
      descripcion: form.descripcion,
      categoria: form.categoria,
      cantidad: form.cantidad,
      unidad: form.unidad,
      urgencia: form.urgencia,
      nota: form.nota || undefined,
    });
    setIsLoading(false);
    if (error) {
      setError((error as any)?.message ?? "Error al enviar la petición");
    } else {
      onCreated();
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="icon-container w-9 h-9"><ShoppingCart className="w-4 h-4" /></div>
            <h2 className="text-lg font-semibold text-content-primary">Pedir material</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Obra */}
          <div>
            <label className="label">Obra *</label>
            <select className="select" value={form.obra_id} onChange={(e) => set("obra_id", e.target.value)} required>
              <option value="">Selecciona una obra</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label className="label">¿Qué necesitas? *</label>
            <input className="input" placeholder="Ej: cemento portland, cable 2.5mm, pintura blanca..." value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} required />
          </div>

          {/* Categoría */}
          <div>
            <label className="label">Categoría</label>
            <div className="grid grid-cols-3 gap-2">
              {categorias.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => set("categoria", c.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs font-medium transition-all ${
                    form.categoria === c.value
                      ? "border-primary bg-primary-light text-primary"
                      : "border-border text-content-secondary hover:border-gray-300"
                  }`}
                >
                  <span className="text-lg">{c.emoji}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cantidad y unidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cantidad *</label>
              <input className="input" type="number" min="0.1" step="0.1" value={form.cantidad} onChange={(e) => set("cantidad", parseFloat(e.target.value) || 1)} required />
            </div>
            <div>
              <label className="label">Unidad</label>
              <select className="select" value={form.unidad} onChange={(e) => set("unidad", e.target.value)}>
                {unidadesComunes.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Urgencia */}
          <div>
            <label className="label">Urgencia</label>
            <div className="grid grid-cols-2 gap-3">
              {(["normal", "urgente"] as MaterialUrgencia[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => set("urgencia", u)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    form.urgencia === u
                      ? u === "urgente"
                        ? "border-warning bg-warning-light text-warning-foreground"
                        : "border-primary bg-primary-light text-primary"
                      : "border-border text-content-secondary hover:border-gray-300"
                  }`}
                >
                  {u === "urgente" ? "⚡ Urgente" : "📋 Normal"}
                </button>
              ))}
            </div>
          </div>

          {/* Nota */}
          <div>
            <label className="label">Nota adicional (opcional)</label>
            <textarea className="input resize-none" rows={2} placeholder="Marca, referencia, observaciones..." value={form.nota} onChange={(e) => set("nota", e.target.value)} />
          </div>

          {error && <div className="bg-danger-light text-danger-foreground text-sm rounded-lg px-4 py-3">{error}</div>}
        </form>

        <div className="p-5 border-t border-border flex-shrink-0 flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSubmit as any} disabled={isLoading} className="btn-primary">
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : "Enviar petición"}
          </button>
        </div>
      </div>
    </div>
  );
}
