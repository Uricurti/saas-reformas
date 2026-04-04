"use client";

import type { MaterialConDetalles } from "@/types";
import { deleteMaterial, marcarMaterialComprado } from "@/lib/insforge/database";
import { ShoppingCart, Trash2, Check, Building2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils/format";

interface Props {
  materiales: MaterialConDetalles[];
  onUpdate: () => void;
}

const categoriasEmoji: Record<string, string> = {
  electricidad: "⚡",
  fontaneria: "🔧",
  albanileria: "🧱",
  pintura: "🎨",
  carpinteria: "🪵",
  otro: "📦",
};

export function ListaMateriales({ materiales, onUpdate }: Props) {
  // Agrupar por obra
  const porObra = materiales.reduce<Record<string, MaterialConDetalles[]>>((acc, m) => {
    const nombre = m.obra?.nombre ?? "Sin obra";
    if (!acc[nombre]) acc[nombre] = [];
    acc[nombre].push(m);
    return acc;
  }, {});

  async function handleMarcarComprado(id: string) {
    await marcarMaterialComprado(id);
    onUpdate();
  }

  async function handleEliminar(id: string) {
    if (!confirm("¿Eliminar este material?")) return;
    await deleteMaterial(id);
    onUpdate();
  }

  return (
    <div className="space-y-6">
      {Object.entries(porObra).map(([obraNombre, items]) => (
        <div key={obraNombre}>
          {/* Cabecera de obra */}
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-content-muted" />
            <h3 className="text-sm font-semibold text-content-primary">{obraNombre}</h3>
            <span className="badge badge-gray">{items.length}</span>
          </div>

          <div className="space-y-2">
            {items.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "card p-4 flex items-start gap-3",
                  m.urgencia === "urgente" && "border-l-4 border-l-warning"
                )}
              >
                {/* Emoji categoría */}
                <span className="text-xl mt-0.5 flex-shrink-0">
                  {categoriasEmoji[m.categoria]}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-medium text-content-primary">{m.descripcion}</span>
                    {m.urgencia === "urgente" && <span className="badge badge-warning">Urgente</span>}
                  </div>
                  <p className="text-sm text-content-secondary">
                    {m.cantidad} {m.unidad}
                    {m.nota && ` · ${m.nota}`}
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-content-muted">
                    <Clock className="w-3 h-3" />
                    <span>Pedido {formatRelative(m.created_at)}</span>
                    {m.solicitante && <span>· {m.solicitante.nombre}</span>}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleMarcarComprado(m.id)}
                    title="Marcar como comprado"
                    className="p-2 rounded-lg text-success hover:bg-success-light transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEliminar(m.id)}
                    title="Eliminar"
                    className="p-2 rounded-lg text-content-muted hover:bg-danger-light hover:text-danger transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
