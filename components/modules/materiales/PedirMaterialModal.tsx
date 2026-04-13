"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { pedirMaterial, getObrasActivas } from "@/lib/insforge/database";
import type { Obra, MaterialMaestro } from "@/types";
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
  cantidad:    string;
  descripcion: string;
  maestroId:   string | null; // ID del material maestro seleccionado via autocomplete
}

let _nextId = 1;
function nuevaLinea(): LineaPedido {
  return { id: _nextId++, cantidad: "", descripcion: "", maestroId: null };
}

export function PedirMaterialModal({ tenantId, userId, obraIdInicial, onClose, onCreated }: Props) {
  const [obras,     setObras]     = useState<Obra[]>([]);
  const [obraId,    setObraId]    = useState(obraIdInicial ?? "");
  const [lineas,    setLineas]    = useState<LineaPedido[]>([nuevaLinea()]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Autocomplete
  const [sugerencias, setSugerencias] = useState<{ lineaId: number; items: MaterialMaestro[] } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref para el campo cantidad de la ÚLTIMA línea (para foco al añadir)
  const lastCantidadRef  = useRef<HTMLInputElement>(null);
  const initialFocusDone = useRef(false);

  useEffect(() => {
    getObrasActivas(tenantId).then(({ data }) => {
      const lista = (data as Obra[]) ?? [];
      setObras(lista);
      if (!obraId && lista.length > 0) setObraId(lista[0].id);
    });
  }, []);

  // Foco al añadir línea nueva
  useEffect(() => {
    if (!initialFocusDone.current) { initialFocusDone.current = true; return; }
    requestAnimationFrame(() => lastCantidadRef.current?.focus());
  }, [lineas.length]);

  // Cerrar sugerencias al tocar fuera (pointerdown cubre móvil y desktop)
  useEffect(() => {
    function handleClickOutside() { setSugerencias(null); }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  // Buscar sugerencias con debounce
  const buscarSugerencias = useCallback((lineaId: number, query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setSugerencias(null); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/materiales/maestros?tenantId=${tenantId}&q=${encodeURIComponent(query)}`
        );
        const items: MaterialMaestro[] = await res.json();
        if (items.length > 0) {
          setSugerencias({ lineaId, items });
        } else {
          setSugerencias(null);
        }
      } catch {
        setSugerencias(null);
      }
    }, 320);
  }, [tenantId]);

  function updateLinea(id: number, field: keyof LineaPedido, value: string) {
    setError(null);
    setLineas((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
    // Si edita la descripción manualmente, resetear el maestroId
    if (field === "descripcion") {
      setLineas((prev) => prev.map((l) => l.id === id ? { ...l, descripcion: value, maestroId: null } : l));
      buscarSugerencias(id, value);
    }
  }

  function seleccionarSugerencia(lineaId: number, maestro: MaterialMaestro) {
    setSugerencias(null);
    setLineas((prev) => prev.map((l) =>
      l.id === lineaId ? { ...l, descripcion: maestro.nombre, maestroId: maestro.id } : l
    ));
  }

  function addLinea() { setLineas((prev) => [...prev, nuevaLinea()]); }

  function removeLinea(id: number) {
    setSugerencias(null);
    setLineas((prev) => prev.length > 1 ? prev.filter((l) => l.id !== id) : prev);
  }

  async function handleSubmit() {
    if (!obraId) { setError("Selecciona una obra."); return; }
    const validas = lineas.filter((l) => l.descripcion.trim());
    if (validas.length === 0) { setError("Escribe al menos un material."); return; }

    setIsLoading(true);
    setError(null);

    // Para cada línea: asegurar que existe el material maestro
    const lineasConMaestro = await Promise.all(
      validas.map(async (l) => {
        // Si el usuario seleccionó una sugerencia ya tiene maestroId
        if (l.maestroId) return { ...l, maestroId: l.maestroId };

        // Si no, crear/encontrar el maestro por nombre
        try {
          const res = await fetch("/api/materiales/maestros", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenantId, nombre: l.descripcion.trim() }),
          });
          const maestro: MaterialMaestro = await res.json();
          return { ...l, maestroId: maestro?.id ?? null };
        } catch {
          return { ...l, maestroId: null };
        }
      })
    );

    const resultados = await Promise.all(
      lineasConMaestro.map((l) =>
        pedirMaterial(tenantId, obraId, userId, {
          descripcion: l.descripcion.trim(),
          categoria:   "otro",
          cantidad:    parseFloat(l.cantidad) || 1,
          unidad:      "ud",
          urgencia:    "normal",
        }, l.maestroId)
      )
    );

    setIsLoading(false);
    if (resultados.some((r) => r.error)) {
      setError("Hubo un error al enviar alguna petición. Inténtalo de nuevo.");
    } else {
      onCreated();
    }
  }

  const nValidas = lineas.filter((l) => l.descripcion.trim()).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center px-4 pt-4 sm:pt-0 animate-fade-in bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-panel w-full max-w-md flex flex-col max-h-[88vh] sm:max-h-[85vh] overflow-hidden" style={{ borderRadius: "1rem" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="icon-container w-9 h-9"><ShoppingCart className="w-4 h-4" /></div>
            <h2 className="text-lg font-semibold text-content-primary">Pedir material</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-2"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">

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
            <label className="label mb-3">¿Qué necesitas? *</label>
            <div className="space-y-2.5">
              {lineas.map((linea, idx) => (
                <div key={linea.id} className="flex items-center gap-2">

                  {/* Cantidad */}
                  <input
                    ref={idx === lineas.length - 1 ? lastCantidadRef : undefined}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus={idx === 0 && lineas.length === 1}
                    type="number"
                    inputMode="decimal"
                    min="0.1"
                    step="any"
                    placeholder="1"
                    value={linea.cantidad}
                    onChange={(e) => updateLinea(linea.id, "cantidad", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const row  = e.currentTarget.closest(".flex") as HTMLElement | null;
                        const desc = row?.querySelectorAll("input")[1] as HTMLInputElement | null;
                        desc?.focus();
                      }
                    }}
                    className="input text-center"
                    style={{ width: 64, flexShrink: 0 }}
                  />

                  {/* Descripción con autocomplete */}
                  <div className="relative flex-1 min-w-0">
                    <input
                      type="text"
                      placeholder="cemento, cable 2.5mm…"
                      value={linea.descripcion}
                      onChange={(e) => updateLinea(linea.id, "descripcion", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") { setSugerencias(null); }
                        if (e.key === "Enter" && idx === lineas.length - 1) {
                          e.preventDefault();
                          setSugerencias(null);
                          if (linea.descripcion.trim()) addLinea();
                        }
                      }}
                      onFocus={() => {
                        if (linea.descripcion.trim().length >= 2) {
                          buscarSugerencias(linea.id, linea.descripcion);
                        }
                      }}
                      className="input w-full"
                      autoComplete="off"
                    />

                    {/* Dropdown de sugerencias */}
                    {sugerencias?.lineaId === linea.id && sugerencias.items.length > 0 && (
                      <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                        {sugerencias.items.map((m) => (
                          <li
                            key={m.id}
                            // onPointerDown + preventDefault: evita que el input pierda el foco
                            // antes de procesar la selección (funciona en móvil y desktop)
                            onPointerDown={(e) => {
                              e.preventDefault();
                              seleccionarSugerencia(linea.id, m);
                            }}
                            className="flex items-center justify-between px-3 py-3 active:bg-gray-100 hover:bg-gray-50 cursor-pointer border-b border-border/50 last:border-0"
                          >
                            <span className="text-sm font-medium text-content-primary capitalize">
                              {m.nombre}
                            </span>
                            {(m.sabadell_pasillo || m.terrassa_pasillo) && (
                              <span className="text-xs text-content-muted ml-2 flex-shrink-0">
                                {m.sabadell_pasillo ? `S·${m.sabadell_pasillo}` : ""}
                                {m.sabadell_pasillo && m.terrassa_pasillo ? " · " : ""}
                                {m.terrassa_pasillo ? `T·${m.terrassa_pasillo}` : ""}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Borrar fila */}
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
        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSubmit} disabled={isLoading} className="btn-primary">
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
              : <>Enviar petición{nValidas > 1 ? ` (${nValidas})` : ""}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
