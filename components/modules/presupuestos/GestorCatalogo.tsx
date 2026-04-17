"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Loader2, RefreshCw } from "lucide-react";
import {
  getCatalogoPresupuesto,
  upsertCatalogoPartida,
  deleteCatalogoPartida,
} from "@/lib/insforge/database";
import type { PresupuestoTipo, CatalogoPartida } from "@/types";

const TABS: { key: PresupuestoTipo; label: string; emoji: string }[] = [
  { key: "bano",   label: "Baño",    emoji: "🛁" },
  { key: "cocina", label: "Cocina",  emoji: "🍳" },
  { key: "otros",  label: "Otros",   emoji: "🏗️" },
];

const CATALOGO_BANO_DEFAULT = [
  // BASE
  {
    nombre_partida: "Paletería dentro del baño (20-25 m²)",
    descripcion: "Trabajos de paletería en el interior del baño para una superficie orientativa de 20-25 m², incluyendo preparación de soportes, albañilería, colocación de revestimientos y pavimentos, ayudas a instalaciones y remates habituales de la zona de baño.",
    precio: 2268.20,
    es_base: true,
    orden: 1,
  },
  {
    nombre_partida: "Lampistería dentro del baño",
    descripcion: "Trabajos de lampistería en el interior del baño, incluyendo adaptación y ejecución de instalaciones necesarias de fontanería para los elementos previstos en la reforma del baño.",
    precio: 1232.00,
    es_base: true,
    orden: 2,
  },
  {
    nombre_partida: "Techo de pladur baño",
    descripcion: "Suministro y colocación de falso techo de pladur en baño, con estructura metálica y placa estándar, totalmente instalado.",
    precio: 269.50,
    es_base: true,
    orden: 3,
  },
  {
    nombre_partida: "Pintar techo de pladur baño hasta 10 m²",
    descripcion: "Trabajos de pintura en techo de pladur del baño, hasta una superficie aproximada de 10 m², incluyendo preparación básica y acabado final.",
    precio: 165.00,
    es_base: true,
    orden: 4,
  },
  {
    nombre_partida: "Sacas",
    descripcion: "Suministro, retirada y gestión de saca de runa derivada de la obra.",
    precio: 60.00,
    es_base: true,
    orden: 5,
  },
  // EXTRAS
  {
    nombre_partida: "WC suspendido mano de obra + materiales",
    descripcion: "Instalación de WC suspendido, incluyendo trabajos de lampistería, trabajos de paletería asociados a su colocación y materiales necesarios para el conjunto. El extra se compone de 79,20 € de instalación de lampistería, 173,80 € de instalación de paletería y 700,00 € de materiales.",
    precio: 953.00,
    es_base: false,
    orden: 1,
  },
  {
    nombre_partida: "Grifería ducha/lavabo empotrada",
    descripcion: "Trabajos de instalación de grifería empotrada para ducha o lavabo, con adaptación de conexiones necesarias.",
    precio: 96.80,
    es_base: false,
    orden: 2,
  },
  {
    nombre_partida: "Ayudas lampista grifería empotrada",
    descripcion: "Trabajos auxiliares de paletería necesarios para la correcta instalación de grifería empotrada.",
    precio: 52.80,
    es_base: false,
    orden: 3,
  },
  {
    nombre_partida: "Instalación led hornacina",
    descripcion: "Instalación de tira led en hornacina, incluyendo conexiones básicas y montaje.",
    precio: 52.80,
    es_base: false,
    orden: 4,
  },
  {
    nombre_partida: "Murete separador ducha",
    descripcion: "Formación de murete separador de obra en zona de ducha, con remate e integración en el conjunto del baño.",
    precio: 253.00,
    es_base: false,
    orden: 5,
  },
  {
    nombre_partida: "Hornacina estándar",
    descripcion: "Creación de hornacina estándar en zona de ducha o pared de baño, totalmente ejecutada y rematada.",
    precio: 264.00,
    es_base: false,
    orden: 6,
  },
  {
    nombre_partida: "Hornacina especial / más trabajo",
    descripcion: "Creación de hornacina en zona de baño con mayor trabajo de ejecución o adaptación especial.",
    precio: 364.00,
    es_base: false,
    orden: 7,
  },
  {
    nombre_partida: "Planché baño para sanear/igualar niveles",
    descripcion: "Formación de planché en baño para sanear base de suelo o igualar niveles antes de la colocación del nuevo pavimento.",
    precio: 275.00,
    es_base: false,
    orden: 8,
  },
  {
    nombre_partida: "Trabajos extra de pintura/paletería",
    descripcion: "Trabajos extra de paletería, ajustes de obra y pintura en zonas afectadas fuera del alcance estándar del baño.",
    precio: 450.00,
    es_base: false,
    orden: 9,
  },
  {
    nombre_partida: "Mueble de baño + espejo",
    descripcion: "Suministro y colocación de mueble de baño con espejo, en modelo estándar.",
    precio: 750.00,
    es_base: false,
    orden: 10,
  },
];

function fmtE(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

interface NuevaPartida {
  nombre_partida: string;
  descripcion: string;
  precio: string;
  es_base: boolean;
}

interface PartidaFila extends CatalogoPartida {
  editandoPrecio?: boolean;
  precioTemp?: string;
  guardando?: boolean;
}

export function GestorCatalogo({
  tenantId,
  onClose,
}: {
  tenantId: string;
  onClose: () => void;
}) {
  const [tab, setTab]           = useState<PresupuestoTipo>("bano");
  const [partidas, setPartidas] = useState<PartidaFila[]>([]);
  const [loading, setLoading]   = useState(true);
  const [inicializando, setInicializando] = useState(false);
  const [nuevaPartida, setNuevaPartida]   = useState<NuevaPartida | null>(null);
  const [guardandoNueva, setGuardandoNueva] = useState(false);

  useEffect(() => { cargar(); }, [tab]);

  async function cargar() {
    setLoading(true);
    const data = await getCatalogoPresupuesto(tenantId, tab);
    setPartidas(data as PartidaFila[]);
    // Auto-initialize bano catalog if empty on first load
    if (tab === "bano" && data.length === 0) {
      await insertarBanoDefault();
    }
    setLoading(false);
  }

  async function insertarBanoDefault() {
    setInicializando(true);
    let errorCount = 0;
    for (const p of CATALOGO_BANO_DEFAULT) {
      try {
        const result = await upsertCatalogoPartida(tenantId, {
          tipo: "bano",
          nombre_partida: p.nombre_partida,
          descripcion: p.descripcion,
          precio: p.precio,
          es_base: p.es_base,
          orden: p.orden,
          activo: true,
        });
        if (!result) errorCount++;
      } catch (e) {
        console.error("[GestorCatalogo] error insertando partida:", p.nombre_partida, e);
        errorCount++;
      }
    }
    if (errorCount > 0) {
      alert(`Error: ${errorCount} partidas no se pudieron guardar. Abre la consola del navegador (F12) para ver el detalle.`);
    }
    const fresh = await getCatalogoPresupuesto(tenantId, "bano");
    setPartidas(fresh as PartidaFila[]);
    setInicializando(false);
  }

  async function inicializarBano() {
    if (!confirm("¿Inicializar el catálogo de baño con las partidas predefinidas? Se añadirán a las existentes.")) return;
    await insertarBanoDefault();
  }

  async function handleGuardarPrecio(id: string, precioStr: string) {
    const precio = parseFloat(precioStr.replace(",", "."));
    if (isNaN(precio) || precio < 0) return;
    setPartidas((prev) => prev.map((p) => p.id === id ? { ...p, guardando: true } : p));
    await upsertCatalogoPartida(tenantId, {
      id,
      tipo: tab,
      nombre_partida: partidas.find((p) => p.id === id)?.nombre_partida ?? "",
      descripcion: partidas.find((p) => p.id === id)?.descripcion ?? null,
      precio,
      es_base: partidas.find((p) => p.id === id)?.es_base ?? true,
      orden: partidas.find((p) => p.id === id)?.orden ?? 99,
      activo: true,
    });
    await cargar();
  }

  async function handleEliminar(id: string) {
    if (!confirm("¿Eliminar esta partida del catálogo?")) return;
    await deleteCatalogoPartida(id);
    setPartidas((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleGuardarNueva() {
    if (!nuevaPartida || !nuevaPartida.nombre_partida.trim()) return;
    const precio = parseFloat(nuevaPartida.precio.replace(",", "."));
    if (isNaN(precio) || precio < 0) return;
    setGuardandoNueva(true);
    const maxOrden = partidas.filter((p) => p.es_base === nuevaPartida.es_base).length + 1;
    await upsertCatalogoPartida(tenantId, {
      tipo: tab, nombre_partida: nuevaPartida.nombre_partida.trim(),
      descripcion: nuevaPartida.descripcion.trim() || null,
      precio, es_base: nuevaPartida.es_base, orden: maxOrden, activo: true,
    });
    setNuevaPartida(null);
    setGuardandoNueva(false);
    await cargar();
  }

  const base   = partidas.filter((p) => p.es_base);
  const extras = partidas.filter((p) => !p.es_base);

  return (
    <div className="modal-overlay" style={{ zIndex: 9100 }}>
      <div className="modal-panel" style={{ maxWidth: 700, width: "100%", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-content-primary">Catálogo de partidas</h2>
            <p className="text-sm text-content-secondary">Gestiona los precios por tipo de reforma</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-content-muted" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-4 border-b border-gray-100 flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                tab === t.key ? "bg-primary text-white" : "bg-gray-100 text-content-secondary hover:bg-gray-200"
              }`}
            >
              <span>{t.emoji}</span> {t.label}
            </button>
          ))}
          {tab === "bano" && (
            <button
              onClick={inicializarBano}
              disabled={inicializando}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-content-secondary hover:bg-gray-100 transition-colors"
            >
              {inicializando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Inicializar catálogo
            </button>
          )}
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : partidas.length === 0 ? (
            <div className="text-center py-10 text-content-secondary">
              <p className="text-sm">Sin partidas en este catálogo.</p>
              {tab === "bano" && (
                <button onClick={inicializarBano} className="btn-primary mt-3 text-sm">
                  Inicializar catálogo de baño
                </button>
              )}
            </div>
          ) : (
            <>
              {/* BASE */}
              {base.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2">Partidas base</p>
                  <div className="space-y-1">
                    {base.map((p) => (
                      <PartidaRow key={p.id} partida={p} onGuardar={handleGuardarPrecio} onEliminar={handleEliminar} />
                    ))}
                  </div>
                </div>
              )}

              {/* EXTRAS */}
              {extras.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2">Extras y opcionales</p>
                  <div className="space-y-1">
                    {extras.map((p) => (
                      <PartidaRow key={p.id} partida={p} onGuardar={handleGuardarPrecio} onEliminar={handleEliminar} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Form nueva partida */}
          {nuevaPartida ? (
            <div className="card p-4 space-y-3 border-2 border-primary-light">
              <p className="text-sm font-semibold text-content-primary">Nueva partida</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Nombre *</label>
                  <input
                    className="input text-sm"
                    placeholder="Ej: Albañilería"
                    value={nuevaPartida.nombre_partida}
                    onChange={(e) => setNuevaPartida({ ...nuevaPartida, nombre_partida: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label text-xs">Precio (€) *</label>
                  <input
                    className="input text-sm"
                    type="number"
                    placeholder="0"
                    value={nuevaPartida.precio}
                    onChange={(e) => setNuevaPartida({ ...nuevaPartida, precio: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label text-xs">Descripción (opcional)</label>
                <input
                  className="input text-sm"
                  placeholder="Descripción breve..."
                  value={nuevaPartida.descripcion}
                  onChange={(e) => setNuevaPartida({ ...nuevaPartida, descripcion: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nuevaPartida.es_base}
                    onChange={(e) => setNuevaPartida({ ...nuevaPartida, es_base: e.target.checked })}
                  />
                  Partida base (no extra)
                </label>
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => setNuevaPartida(null)} className="btn-ghost text-sm">Cancelar</button>
                  <button onClick={handleGuardarNueva} disabled={guardandoNueva} className="btn-primary text-sm">
                    {guardandoNueva ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setNuevaPartida({ nombre_partida: "", descripcion: "", precio: "", es_base: false })}
              className="btn-ghost text-sm w-full"
            >
              <Plus className="w-4 h-4" /> Añadir partida
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="btn-primary w-full">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function PartidaRow({
  partida, onGuardar, onEliminar,
}: {
  partida: PartidaFila;
  onGuardar: (id: string, precio: string) => void;
  onEliminar: (id: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [precioTemp, setPrecioTemp] = useState(String(partida.precio));

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-content-primary truncate">{partida.nombre_partida}</p>
        {partida.descripcion && (
          <p className="text-xs text-content-muted truncate">{partida.descripcion}</p>
        )}
      </div>
      {editando ? (
        <div className="flex items-center gap-1.5">
          <input
            className="input text-sm w-24 py-1"
            type="number"
            value={precioTemp}
            onChange={(e) => setPrecioTemp(e.target.value)}
            onBlur={() => {
              onGuardar(partida.id, precioTemp);
              setEditando(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onGuardar(partida.id, precioTemp); setEditando(false); }
              if (e.key === "Escape") setEditando(false);
            }}
            autoFocus
          />
          <span className="text-xs text-content-muted">€</span>
        </div>
      ) : (
        <button
          onClick={() => { setPrecioTemp(String(partida.precio)); setEditando(true); }}
          className="text-sm font-bold text-content-primary hover:text-primary transition-colors min-w-[60px] text-right"
          title="Clic para editar precio"
        >
          {fmtE(partida.precio)}
        </button>
      )}
      <button
        onClick={() => onEliminar(partida.id)}
        className="p-1.5 rounded text-content-muted hover:bg-danger-light hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
