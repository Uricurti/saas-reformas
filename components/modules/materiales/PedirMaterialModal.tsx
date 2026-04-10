"use client";

import { useState, useEffect, useRef } from "react";
import { pedirMaterial, getObrasActivas } from "@/lib/insforge/database";
import type { Obra } from "@/types";
import { X, Loader2, ShoppingCart, Plus, Trash2 } from "lucide-react";

interface Props {
  tenantId: string;
  userId: string;
  obraIdInicial?: string | null;
  onClose: () => void;
  onCreated: () => void;
}

interface LineaPedido {
  id:          number;
  cantidad:    string;  // string para input libre, se parsea al enviar
  unidad:      string;
  descripcion: string;
}

const UNIDADES = ["ud", "sacos", "m", "m²", "m³", "kg", "litros", "caja", "rollo", "paquete", "bote", "tubo", "plancha"];

let _nextId = 1;
function nuevaLinea(): LineaPedido {
  return { id: _nextId++, cantidad: "", unidad: "ud", descripcion: "" };
}

export function PedirMaterialModal({ tenantId, userId, obraIdInicial, onClose, onCreated }: Props) {
  const [obras,     setObras]     = useState<Obra[]>([]);
  const [obraId,    setObraId]    = useState(obraIdInicial ?? "");
  const [lineas,    setLineas]    = useState<LineaPedido[]>([nuevaLinea()]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const lastInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getObrasActivas(tenantId).then(({ data }) => {
      const lista = (data as Obra[]) ?? [];
      setObras(lista);
      if (!obraId && lista.length > 0) setObraId(lista[0].id);
    });
  }, []);

  // Foco automático al añadir línea
  useEffect(() => {
    lastInputRef.current?.focus();
  }, [lineas.length]);

  function updateLinea(id: number, field: keyof LineaPedido, value: string) {
    setError(null);
    setLineas((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  function addLinea() {
    setLineas((prev) => [...prev, nuevaLinea()]);
  }

  function removeLinea(id: number) {
    setLineas((prev) => prev.length > 1 ? prev.filter((l) => l.id !== id) : prev);
  }

  async function handleSubmit() {
    if (!obraId) { setError("Selecciona una obra."); return; }

    const validas = lineas.filter((l) => l.descripcion.trim());
    if (validas.length === 0) { setError("Escribe al menos un material."); return; }

    setIsLoading(true);
    setError(null);

    // Enviamos una petición por línea (en paralelo)
    const resultados = await Promise.all(
      validas.map((l) =>
        pedirMaterial(tenantId, obraId, userId, {
          descripcion: l.descripcion.trim(),
          categoria:   "otro",
          cantidad:    parseFloat(l.cantidad) || 1,
          unidad:      l.unidad,
          urgencia:    "normal",
        })
      )
    );

    setIsLoading(false);
    const hayError = resultados.some((r) => r.error);
    if (hayError) {
      setError("Hubo un error al enviar alguna petición. Inténtalo de nuevo.");
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
            <div className="icon-container w-9 h-9"><ShoppingCart className="w-4 h-4" /></div>
            <h2 className="text-lg font-semibold text-content-primary">Pedir material</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Obra */}
          <div>
            <label className="label">Obra *</label>
            <select
              className="select"
              value={obraId}
              onChange={(e) => { setObraId(e.target.value); setError(null); }}
            >
              <option value="">Selecciona una obra</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </div>

          {/* Líneas de pedido */}
          <div>
            <label className="label mb-2">¿Qué necesitas? *</label>
            <div className="space-y-2">
              {lineas.map((linea, idx) => (
                <div key={linea.id} className="flex items-center gap-2">

                  {/* Cantidad */}
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    placeholder="1"
                    value={linea.cantidad}
                    onChange={(e) => updateLinea(linea.id, "cantidad", e.target.value)}
                    className="input text-center"
                    style={{ width: 64, flexShrink: 0 }}
                  />

                  {/* Unidad */}
                  <select
                    value={linea.unidad}
                    onChange={(e) => updateLinea(linea.id, "unidad", e.target.value)}
                    className="select"
                    style={{ width: 88, flexShrink: 0 }}
                  >
                    {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>

                  {/* Descripción */}
                  <input
                    ref={idx === lineas.length - 1 ? lastInputRef : undefined}
                    type="text"
                    placeholder="cemento, cable 2.5mm…"
                    value={linea.descripcion}
                    onChange={(e) => updateLinea(linea.id, "descripcion", e.target.value)}
                    onKeyDown={(e) => {
                      // Enter en la última línea → añade nueva
                      if (e.key === "Enter" && idx === lineas.length - 1) {
                        e.preventDefault();
                        if (linea.descripcion.trim()) addLinea();
                      }
                    }}
                    className="input flex-1 min-w-0"
                  />

                  {/* Borrar línea */}
                  <button
                    type="button"
                    onClick={() => removeLinea(linea.id)}
                    disabled={lineas.length === 1}
                    className="flex-shrink-0 p-2 rounded-lg text-content-muted hover:text-danger hover:bg-danger-light transition-colors disabled:opacity-20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Añadir línea */}
            <button
              type="button"
              onClick={addLinea}
              className="mt-3 flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Añadir otro material
            </button>
          </div>

          {error && (
            <div className="bg-danger-light text-danger-foreground text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex-shrink-0 flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSubmit} disabled={isLoading} className="btn-primary">
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              : <>Enviar petición {lineas.filter(l => l.descripcion.trim()).length > 1 && `(${lineas.filter(l => l.descripcion.trim()).length})`}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
