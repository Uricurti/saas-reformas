"use client";

import { useState } from "react";
import type { MaterialConDetalles } from "@/types";
import { Check, ShoppingBag, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tenantId: string;
  materiales: MaterialConDetalles[];
  onFinalizar: (idsComprados: string[]) => void;
  onCancelar: () => void;
}

export function ModoCompraView({ tenantId: _tenantId, materiales, onFinalizar, onCancelar }: Props) {
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [mostrarCompletados, setMostrarCompletados] = useState(false);

  const pendientes  = materiales.filter((m) => !marcados.has(m.id));
  const completados = materiales.filter((m) =>  marcados.has(m.id));

  function handleToggle(m: MaterialConDetalles) {
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(m.id)) next.delete(m.id);
      else next.add(m.id);
      return next;
    });
  }

  function handleFinalizar() {
    if (marcados.size === 0) { onCancelar(); return; }
    onFinalizar(Array.from(marcados));
  }

  // Agrupar pendientes por obra
  const porObra = pendientes.reduce<Record<string, MaterialConDetalles[]>>((acc, m) => {
    const nombre = m.obra?.nombre ?? "Sin obra";
    if (!acc[nombre]) acc[nombre] = [];
    acc[nombre].push(m);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-app-bg flex flex-col">

      {/* Header */}
      <div className="bg-primary text-white px-4 py-4 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-5 h-5" />
          <div>
            <p className="font-bold text-base">Modo Compra</p>
            <p className="text-xs text-white/70">
              {marcados.size}/{materiales.length} marcado{marcados.size !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button onClick={onCancelar} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">

        {/* Materiales pendientes agrupados por obra */}
        {Object.entries(porObra).map(([obraNombre, items]) => (
          <div key={obraNombre} className="mb-6">
            <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3 px-1">
              {obraNombre}
            </p>
            <div className="space-y-3">
              {items.map((m) => (
                <MaterialItemCompra
                  key={m.id}
                  material={m}
                  marcado={false}
                  onToggle={() => handleToggle(m)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Todo comprado */}
        {pendientes.length === 0 && (
          <div className="flex flex-col items-center text-center py-10 gap-3">
            <div className="w-16 h-16 bg-success-light rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-success" />
            </div>
            <p className="font-bold text-content-primary text-lg">¡Todo comprado!</p>
          </div>
        )}

        {/* Completados colapsables */}
        {completados.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setMostrarCompletados((v) => !v)}
              className="flex items-center gap-2 text-sm text-content-muted mb-3 px-1"
            >
              {mostrarCompletados ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Completados ({completados.length})
            </button>
            {mostrarCompletados && (
              <div className="space-y-3 opacity-60">
                {completados.map((m) => (
                  <MaterialItemCompra
                    key={m.id}
                    material={m}
                    marcado={true}
                    onToggle={() => handleToggle(m)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer fijo */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-4 pb-safe">
        <button onClick={handleFinalizar} className="btn-primary w-full justify-center py-4 text-base">
          <Check className="w-5 h-5" />
          {marcados.size > 0
            ? `Finalizar — ${marcados.size} ítem${marcados.size !== 1 ? "s" : ""} comprado${marcados.size !== 1 ? "s" : ""}`
            : "Salir del modo compra"}
        </button>
      </div>
    </div>
  );
}

// ── Tarjeta individual ────────────────────────────────────────────────────
function MaterialItemCompra({
  material, marcado, onToggle,
}: {
  material: MaterialConDetalles;
  marcado:  boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98]",
        marcado
          ? "border-success bg-success-light"
          : "border-border bg-white hover:border-primary/40"
      )}
    >
      {/* Checkbox XL */}
      <div className={cn(
        "w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors",
        marcado ? "bg-success border-success" : "border-gray-300"
      )}>
        {marcado && <Check className="w-4 h-4 text-white" />}
      </div>

      {/* Info: cantidad + descripción */}
      <div className={cn("flex-1 min-w-0", marcado && "line-through opacity-60")}>
        <p className="leading-snug">
          {material.cantidad != null && material.cantidad !== 1 && (
            <span className="text-xl font-bold text-content-primary">{material.cantidad} </span>
          )}
          <span className="text-lg font-light text-content-primary">{material.descripcion}</span>
        </p>
        {material.obra?.nombre && (
          <p className="text-xs text-content-muted mt-0.5">{material.obra.nombre}</p>
        )}
      </div>
    </button>
  );
}
