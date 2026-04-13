"use client";

import { useState, useEffect, useRef } from "react";
import type { MaterialMaestro } from "@/types";
import { X, Search, Pencil, Check, Trash2, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tenantId: string;
  onClose: () => void;
}

type Tienda = "sabadell" | "terrassa";

interface FilaEdicion {
  maestroId: string;
  tienda: Tienda;
  valor: string;
}

export function GestorPasillos({ tenantId, onClose }: Props) {
  const [materiales, setMateriales]   = useState<MaterialMaestro[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [busqueda, setBusqueda]       = useState("");
  const [editando, setEditando]       = useState<FilaEdicion | null>(null);
  const [guardando, setGuardando]     = useState(false);
  const [eliminando, setEliminando]   = useState<string | null>(null);
  const inputEditRef = useRef<HTMLInputElement>(null);

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (editando) requestAnimationFrame(() => inputEditRef.current?.focus());
  }, [editando?.maestroId, editando?.tienda]);

  async function cargar() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/materiales/maestros?tenantId=${tenantId}&q=%20&limit=200`);
      // Si no devuelve resultados con q=' ', cargamos todos con un endpoint de lista
      const res2 = await fetch(`/api/materiales/maestros/lista?tenantId=${tenantId}`);
      if (res2.ok) {
        const data = await res2.json();
        setMateriales(Array.isArray(data) ? data : []);
      } else {
        setMateriales([]);
      }
    } catch {
      setMateriales([]);
    } finally {
      setIsLoading(false);
    }
  }

  const filtrados = materiales.filter((m) =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase().trim())
  );

  function iniciarEdicion(maestroId: string, tienda: Tienda, valorActual: number | null) {
    setEditando({ maestroId, tienda, valor: valorActual?.toString() ?? "" });
  }

  async function guardarEdicion() {
    if (!editando) return;
    const num = parseInt(editando.valor, 10);
    const pasillo = !isNaN(num) && num > 0 ? num : null;

    setGuardando(true);
    try {
      if (pasillo !== null) {
        await fetch("/api/materiales/maestros", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maestroId: editando.maestroId, tienda: editando.tienda, pasillo }),
        });
      } else {
        // Si se borra el valor → limpiar el pasillo
        await fetch("/api/materiales/maestros", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maestroId: editando.maestroId, tienda: editando.tienda, pasillo: null }),
        });
      }

      // Actualizar estado local
      setMateriales((prev) => prev.map((m) => {
        if (m.id !== editando.maestroId) return m;
        return {
          ...m,
          sabadell_pasillo:  editando.tienda === "sabadell"  ? pasillo : m.sabadell_pasillo,
          terrassa_pasillo:  editando.tienda === "terrassa"  ? pasillo : m.terrassa_pasillo,
        };
      }));
    } catch {
      // silencioso
    } finally {
      setGuardando(false);
      setEditando(null);
    }
  }

  async function eliminarMaterial(id: string) {
    setEliminando(id);
    try {
      await fetch(`/api/materiales/maestros?id=${id}`, { method: "DELETE" });
      setMateriales((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // silencioso
    } finally {
      setEliminando(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-app-bg animate-fade-in">

      {/* Header */}
      <div className="bg-white border-b border-border px-4 py-4 flex items-center gap-3 flex-shrink-0 sticky top-0 z-10">
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <X className="w-5 h-5 text-content-secondary" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <MapPin className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-content-primary">Gestionar pasillos</h1>
        </div>
      </div>

      {/* Buscador */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          <input
            type="text"
            placeholder="Buscar material…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <p className="text-xs text-content-muted mt-2 px-1">
          Toca el número de pasillo para editarlo. Bórralo y guarda para quitarlo.
        </p>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 gap-2">
            <MapPin className="w-8 h-8 text-content-muted" />
            <p className="text-content-secondary text-sm">
              {busqueda ? "No hay materiales con ese nombre" : "Aún no hay materiales en el catálogo"}
            </p>
          </div>
        ) : (
          <>
            {/* Cabecera columnas */}
            <div className="grid grid-cols-[1fr_80px_80px_36px] gap-2 px-3 mb-2 mt-2">
              <span className="text-xs font-bold text-content-muted uppercase tracking-wider">Material</span>
              <span className="text-xs font-bold text-content-muted uppercase tracking-wider text-center">Sabadell</span>
              <span className="text-xs font-bold text-content-muted uppercase tracking-wider text-center">Terrassa</span>
              <span />
            </div>

            <div className="space-y-1.5">
              {filtrados.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-xl border border-border px-3 py-3 grid grid-cols-[1fr_80px_80px_36px] gap-2 items-center"
                >
                  {/* Nombre */}
                  <span className="text-sm font-medium text-content-primary capitalize truncate">
                    {m.nombre}
                  </span>

                  {/* Pasillo Sabadell */}
                  <CeldaPasillo
                    maestroId={m.id}
                    tienda="sabadell"
                    valor={m.sabadell_pasillo}
                    editando={editando}
                    inputRef={inputEditRef}
                    guardando={guardando}
                    onIniciar={() => iniciarEdicion(m.id, "sabadell", m.sabadell_pasillo)}
                    onCambiar={(v) => setEditando((e) => e ? { ...e, valor: v } : null)}
                    onGuardar={guardarEdicion}
                    onCancelar={() => setEditando(null)}
                  />

                  {/* Pasillo Terrassa */}
                  <CeldaPasillo
                    maestroId={m.id}
                    tienda="terrassa"
                    valor={m.terrassa_pasillo}
                    editando={editando}
                    inputRef={inputEditRef}
                    guardando={guardando}
                    onIniciar={() => iniciarEdicion(m.id, "terrassa", m.terrassa_pasillo)}
                    onCambiar={(v) => setEditando((e) => e ? { ...e, valor: v } : null)}
                    onGuardar={guardarEdicion}
                    onCancelar={() => setEditando(null)}
                  />

                  {/* Eliminar del catálogo */}
                  <button
                    onClick={() => eliminarMaterial(m.id)}
                    disabled={eliminando === m.id}
                    className="p-1.5 rounded-lg text-content-muted hover:text-danger hover:bg-danger-light transition-colors disabled:opacity-40 flex items-center justify-center"
                    title="Eliminar del catálogo"
                  >
                    {eliminando === m.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Celda de pasillo (editable inline) ───────────────────────────────────
function CeldaPasillo({
  maestroId, tienda, valor, editando, inputRef, guardando,
  onIniciar, onCambiar, onGuardar, onCancelar,
}: {
  maestroId: string;
  tienda: Tienda;
  valor: number | null;
  editando: FilaEdicion | null;
  inputRef: React.RefObject<HTMLInputElement>;
  guardando: boolean;
  onIniciar: () => void;
  onCambiar: (v: string) => void;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  const estaEditando = editando?.maestroId === maestroId && editando?.tienda === tienda;

  if (estaEditando) {
    return (
      <div className="flex items-center gap-1 justify-center">
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min="1"
          value={editando.valor}
          onChange={(e) => onCambiar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onGuardar();
            if (e.key === "Escape") onCancelar();
          }}
          className="w-12 text-center text-sm font-bold border-2 border-primary rounded-lg px-1 py-1 outline-none"
        />
        <button
          onClick={onGuardar}
          disabled={guardando}
          className="p-1 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onIniciar}
      className={cn(
        "flex items-center justify-center gap-1 rounded-lg py-1.5 px-2 transition-colors group w-full",
        valor !== null
          ? "bg-primary/10 hover:bg-primary/20"
          : "bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300"
      )}
    >
      {valor !== null ? (
        <>
          <span className="text-sm font-bold text-primary">{valor}</span>
          <Pencil className="w-2.5 h-2.5 text-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" />
        </>
      ) : (
        <span className="text-xs text-content-muted">—</span>
      )}
    </button>
  );
}
