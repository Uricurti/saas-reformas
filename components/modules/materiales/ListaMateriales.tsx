"use client";

import type { MaterialConDetalles } from "@/types";
import { deleteMaterial } from "@/lib/insforge/database";
import { Trash2, Building2, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/utils/format";
import { useState } from "react";

interface Props {
  isAdmin: boolean;
  materiales: MaterialConDetalles[];
  onUpdate: () => void;
}

export function ListaMateriales({ isAdmin, materiales, onUpdate }: Props) {
  const [mostrarComprados, setMostrarComprados] = useState(false);

  const pendientes  = materiales.filter((m) => m.estado === "pendiente");
  const comprados   = materiales.filter((m) => m.estado === "comprado");

  async function handleEliminar(id: string) {
    if (!confirm("¿Eliminar este material?")) return;
    await deleteMaterial(id);
    onUpdate();
  }

  // Agrupa una lista de materiales por nombre de obra
  function agruparPorObra(items: MaterialConDetalles[]) {
    return items.reduce<Record<string, MaterialConDetalles[]>>((acc, m) => {
      const nombre = m.obra?.nombre ?? "Sin obra";
      if (!acc[nombre]) acc[nombre] = [];
      acc[nombre].push(m);
      return acc;
    }, {});
  }

  const pendientesPorObra = agruparPorObra(pendientes);
  const compradosPorObra  = agruparPorObra(comprados);

  return (
    <div className="space-y-8">

      {/* ── Sección pendientes ────────────────────────────────────── */}
      {pendientes.length === 0 ? (
        <div className="card p-8 flex flex-col items-center text-center gap-3">
          <CheckCircle2 className="w-10 h-10 text-success" />
          <p className="font-semibold text-content-primary">Todo comprado</p>
          <p className="text-sm text-content-secondary">No quedan materiales pendientes.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(pendientesPorObra).map(([obraNombre, items]) => (
            <div key={obraNombre}>
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span>
                          {m.cantidad != null && (
                            <span className="font-bold text-content-primary">{m.cantidad} </span>
                          )}
                          <span className="font-light text-content-primary">{m.descripcion}</span>
                        </span>
                        {m.urgencia === "urgente" && <span className="badge badge-warning">Urgente</span>}
                      </div>
                      {m.nota && <p className="text-sm text-content-secondary">{m.nota}</p>}
                      <div className="flex items-center gap-1 mt-1 text-xs text-content-muted">
                        <Clock className="w-3 h-3" />
                        <span>Pedido {formatRelative(m.created_at)}</span>
                        {m.solicitante && <span>· {m.solicitante.nombre}</span>}
                      </div>
                    </div>

                    {/* Papelera (solo admin) */}
                    {isAdmin && (
                      <button
                        onClick={() => handleEliminar(m.id)}
                        title="Eliminar"
                        className="p-2 rounded-lg text-content-muted hover:bg-danger-light hover:text-danger transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Sección comprados (colapsable) ───────────────────────── */}
      {comprados.length > 0 && (
        <div>
          <button
            onClick={() => setMostrarComprados((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-content-muted mb-3 hover:text-content-secondary transition-colors"
          >
            <CheckCircle2 className="w-4 h-4 text-success" />
            Comprado ({comprados.length})
            <span className="text-xs">{mostrarComprados ? "▲" : "▼"}</span>
          </button>

          {mostrarComprados && (
            <div className="space-y-6 opacity-60">
              {Object.entries(compradosPorObra).map(([obraNombre, items]) => (
                <div key={obraNombre}>
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-content-muted" />
                    <h3 className="text-sm font-semibold text-content-secondary">{obraNombre}</h3>
                    <span className="badge badge-gray">{items.length}</span>
                  </div>

                  <div className="space-y-2">
                    {items.map((m) => (
                      <div
                        key={m.id}
                        className="card p-4 flex items-start gap-3 bg-gray-50"
                      >
                        {/* Icono check */}
                        <div className="flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="line-through text-content-secondary">
                              {m.cantidad != null && (
                                <span className="font-bold">{m.cantidad} </span>
                              )}
                              <span className="font-light">{m.descripcion}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-xs text-content-muted">
                            <Clock className="w-3 h-3" />
                            <span>Comprado {m.comprado_at ? formatRelative(m.comprado_at) : ""}</span>
                          </div>
                        </div>

                        {/* Papelera solo para admin */}
                        {isAdmin && (
                          <button
                            onClick={() => handleEliminar(m.id)}
                            title="Eliminar"
                            className="p-2 rounded-lg text-content-muted hover:bg-danger-light hover:text-danger transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
