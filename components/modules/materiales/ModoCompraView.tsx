"use client";

import { useState } from "react";
import type { MaterialConDetalles, TiendaCompra } from "@/types";
import { Check, ShoppingBag, X, ChevronDown, ChevronUp, MapPin, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  materiales: MaterialConDetalles[];
  onFinalizar: (idsComprados: string[]) => void;
  onCancelar: () => void;
}

// Obtener el pasillo de un material para la tienda seleccionada
function getPasillo(m: MaterialConDetalles, tienda: TiendaCompra): number | null {
  if (!m.maestro) return null;
  if (tienda === "sabadell") return m.maestro.sabadell_pasillo ?? null;
  if (tienda === "terrassa") return m.maestro.terrassa_pasillo ?? null;
  return null; // "otra" no usa pasillos
}

const TIENDAS: { id: TiendaCompra; label: string; icon: string }[] = [
  { id: "sabadell",  label: "Obramat Sabadell",  icon: "🟠" },
  { id: "terrassa",  label: "Obramat Terrassa",   icon: "🟠" },
  { id: "otra",      label: "Otra tienda",         icon: "🏪" },
];

export function ModoCompraView({ materiales, onFinalizar, onCancelar }: Props) {
  const [tienda, setTienda]   = useState<TiendaCompra | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [mostrarCompletados, setMostrarCompletados] = useState(false);

  // Estado local de pasillos (se actualiza en tiempo real al guardar)
  const [pasillosLocales, setPasillosLocales] = useState<Record<string, number>>({});

  // Modal para pedir pasillo
  const [pedirPasillo, setPedirPasillo] = useState<MaterialConDetalles | null>(null);
  const [inputPasillo, setInputPasillo]  = useState("");

  // ── Selección de tienda ─────────────────────────────────────────────────
  if (!tienda) {
    return (
      <div className="min-h-screen bg-app-bg flex flex-col">
        {/* Header */}
        <div className="bg-primary text-white px-4 py-4 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5" />
            <p className="font-bold text-base">Modo Compra</p>
          </div>
          <button onClick={onCancelar} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de tienda */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-content-primary mb-1">¿Dónde estás comprando?</h2>
            <p className="text-sm text-content-muted">La lista se ordenará según los pasillos de esa tienda</p>
          </div>

          <div className="w-full max-w-xs space-y-3">
            {TIENDAS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTienda(t.id)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border bg-white hover:border-primary hover:bg-primary/5 transition-all active:scale-[0.98] text-left"
              >
                <span className="text-2xl">{t.icon}</span>
                <span className="font-semibold text-content-primary text-base">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Lógica de lista ordenada ─────────────────────────────────────────────
  const pendientes  = materiales.filter((m) => !marcados.has(m.id));
  const completados = materiales.filter((m) =>  marcados.has(m.id));
  const tiendaLabel = TIENDAS.find((t) => t.id === tienda)?.label ?? "";

  // Para "otra tienda": sin orden de pasillo
  let conPasillo: MaterialConDetalles[] = [];
  let sinPasillo: MaterialConDetalles[] = [];

  if (tienda !== "otra") {
    conPasillo = pendientes
      .filter((m) => {
        const local = m.material_maestro_id ? pasillosLocales[m.material_maestro_id] : undefined;
        return local !== undefined || getPasillo(m, tienda) !== null;
      })
      .sort((a, b) => {
        const pA = (a.material_maestro_id && pasillosLocales[a.material_maestro_id]) ?? getPasillo(a, tienda) ?? 0;
        const pB = (b.material_maestro_id && pasillosLocales[b.material_maestro_id]) ?? getPasillo(b, tienda) ?? 0;
        return pB - pA; // descendente: pasillo más alto primero
      });

    sinPasillo = pendientes.filter((m) => {
      const local = m.material_maestro_id ? pasillosLocales[m.material_maestro_id] : undefined;
      return local === undefined && getPasillo(m, tienda) === null;
    });
  }

  // ── Marcar / desmarcar ───────────────────────────────────────────────────
  async function handleToggle(m: MaterialConDetalles) {
    // Desmarcar
    if (marcados.has(m.id)) {
      setMarcados((prev) => { const next = new Set(prev); next.delete(m.id); return next; });
      return;
    }

    // "Otra tienda" o ya tiene pasillo → marcar directamente
    const pasilloLocal  = m.material_maestro_id ? pasillosLocales[m.material_maestro_id] : undefined;
    const pasilloMaestro = getPasillo(m, tienda);
    if (tienda === "otra" || pasilloLocal !== undefined || pasilloMaestro !== null) {
      setMarcados((prev) => new Set([...prev, m.id]));
      return;
    }

    // Sin pasillo → abrir modal para pedirlo (solo si tiene maestro vinculado)
    if (m.material_maestro_id) {
      setPedirPasillo(m);
      setInputPasillo("");
    } else {
      // Sin maestro → marcar directamente sin preguntar
      setMarcados((prev) => new Set([...prev, m.id]));
    }
  }

  async function handleConfirmarPasillo(omitir: boolean) {
    if (!pedirPasillo) return;

    if (!omitir) {
      const num = parseInt(inputPasillo, 10);
      if (!isNaN(num) && num > 0 && pedirPasillo.material_maestro_id) {
        // Guardar en DB (no bloqueante — si falla, la compra sigue)
        fetch("/api/materiales/maestros", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maestroId: pedirPasillo.material_maestro_id,
            tienda,
            pasillo: num,
          }),
        }).catch(() => {});

        // Actualizar estado local para que la sesión actual sea coherente
        setPasillosLocales((prev) => ({
          ...prev,
          [pedirPasillo.material_maestro_id!]: num,
        }));
      }
    }

    // Marcar como comprado en todo caso
    setMarcados((prev) => new Set([...prev, pedirPasillo.id]));
    setPedirPasillo(null);
    setInputPasillo("");
  }

  function handleFinalizar() {
    if (marcados.size === 0) { onCancelar(); return; }
    onFinalizar(Array.from(marcados));
  }

  // ── Render de lista ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-app-bg flex flex-col">

      {/* Header */}
      <div className="bg-primary text-white px-4 py-4 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTienda(null)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="font-bold text-base">Modo Compra</p>
            <p className="text-xs text-white/70">
              {tiendaLabel} · {marcados.size}/{materiales.length} marcado{marcados.size !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button onClick={onCancelar} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">

        {tienda === "otra" ? (
          // Otra tienda: sin secciones, agrupado por obra
          <>
            {(() => {
              const porObra = pendientes.reduce<Record<string, MaterialConDetalles[]>>((acc, m) => {
                const nombre = m.obra?.nombre ?? "Sin obra";
                if (!acc[nombre]) acc[nombre] = [];
                acc[nombre].push(m);
                return acc;
              }, {});
              return Object.entries(porObra).map(([obraNombre, items]) => (
                <div key={obraNombre} className="mb-6">
                  <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3 px-1">{obraNombre}</p>
                  <div className="space-y-3">
                    {items.map((m) => (
                      <MaterialItemCompra
                        key={m.id} material={m} marcado={false}
                        pasillo={null} onToggle={() => handleToggle(m)}
                      />
                    ))}
                  </div>
                </div>
              ));
            })()}
          </>
        ) : (
          <>
            {/* Sección 1: Con pasillo registrado */}
            {conPasillo.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-success" />
                  Con pasillo registrado
                </p>
                <div className="space-y-3">
                  {conPasillo.map((m) => {
                    const pasillo = (m.material_maestro_id && pasillosLocales[m.material_maestro_id]) ?? getPasillo(m, tienda);
                    return (
                      <MaterialItemCompra
                        key={m.id} material={m} marcado={false}
                        pasillo={pasillo} onToggle={() => handleToggle(m)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sección 2: Sin pasillo */}
            {sinPasillo.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-warning" />
                  Sin pasillo registrado aún
                </p>
                <div className="space-y-3">
                  {sinPasillo.map((m) => (
                    <MaterialItemCompra
                      key={m.id} material={m} marcado={false}
                      pasillo={null} onToggle={() => handleToggle(m)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

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
                    key={m.id} material={m} marcado={true}
                    pasillo={tienda !== "otra" ? getPasillo(m, tienda) : null}
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

      {/* Modal: pedir pasillo ───────────────────────────────────────────── */}
      {pedirPasillo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl">
            <h3 className="font-bold text-content-primary text-base mb-1">¿En qué pasillo está?</h3>
            <p className="text-sm text-content-muted mb-4 capitalize">
              {pedirPasillo.descripcion} · {tiendaLabel}
            </p>

            <input
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="Nº de pasillo"
              value={inputPasillo}
              onChange={(e) => setInputPasillo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmarPasillo(false)}
              className="input w-full text-center text-2xl font-bold mb-4"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />

            <div className="flex gap-2">
              <button
                onClick={() => handleConfirmarPasillo(true)}
                className="btn-secondary flex-1 text-sm"
              >
                No lo sé
              </button>
              <button
                onClick={() => handleConfirmarPasillo(false)}
                disabled={!inputPasillo || parseInt(inputPasillo) <= 0}
                className="btn-primary flex-1 text-sm"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta individual ────────────────────────────────────────────────────
function MaterialItemCompra({
  material, marcado, pasillo, onToggle,
}: {
  material: MaterialConDetalles;
  marcado:  boolean;
  pasillo:  number | null;
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

      {/* Badge de pasillo */}
      {pasillo !== null && !marcado && (
        <div className="flex-shrink-0 bg-primary/10 text-primary rounded-lg px-2.5 py-1 text-center min-w-[48px]">
          <p className="text-[10px] font-medium leading-none mb-0.5">Pasillo</p>
          <p className="text-lg font-bold leading-none">{pasillo}</p>
        </div>
      )}
    </button>
  );
}
