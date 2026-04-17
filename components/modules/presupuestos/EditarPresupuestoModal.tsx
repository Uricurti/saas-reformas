"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Loader2, ChevronRight, ChevronLeft, AlertTriangle } from "lucide-react";
import {
  updatePresupuesto,
  getCatalogoPresupuesto,
  createNuevaVersionPresupuesto,
  getPresupuestoById,
} from "@/lib/insforge/database";
import type { PresupuestoTipo, PresupuestoConLineas, LineaPresupuesto, CatalogoPartida } from "@/types";

const TIPO_OPTS: { key: PresupuestoTipo; label: string; emoji: string; desc: string }[] = [
  { key: "bano",   label: "Baño",   emoji: "🛁", desc: "Reforma de baño completa o parcial" },
  { key: "cocina", label: "Cocina", emoji: "🍳", desc: "Reforma de cocina" },
  { key: "otros",  label: "Otros",  emoji: "🏗️", desc: "Reforma integral u otros trabajos" },
];

function fmtE(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

type LineaLocal = Omit<LineaPresupuesto, "id" | "created_at" | "tenant_id" | "presupuesto_id"> & {
  cantidad: number;
  precioUnitario: number;
};

export function EditarPresupuestoModal({
  presupuestoId,
  tenantId,
  onClose,
  onUpdated,
}: {
  presupuestoId: string;
  tenantId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [paso, setPaso]             = useState(1);
  const [guardando, setGuardando]   = useState(false);
  const [cargando, setCargando]     = useState(true);
  const [pres, setPres]             = useState<PresupuestoConLineas | null>(null);
  const [confirmVersion, setConfirmVersion] = useState(false);

  // Paso 1 — datos
  const [tipo, setTipo]             = useState<PresupuestoTipo>("bano");
  const [numero, setNumero]         = useState("");
  const [nombre, setNombre]         = useState("");
  const [apellidos, setApellidos]   = useState("");
  const [nif, setNif]               = useState("");
  const [email, setEmail]           = useState("");
  const [telefono, setTelefono]     = useState("");
  const [direccion, setDireccion]   = useState("");
  const [cp, setCp]                 = useState("");
  const [ciudad, setCiudad]         = useState("");
  const [iva, setIva]               = useState<10 | 21>(21);
  const [formaPago, setFormaPago]   = useState<{ concepto: string; porcentaje: number }[]>([]);

  // Paso 2 — líneas
  const [catalogo, setCatalogo]     = useState<CatalogoPartida[]>([]);
  const [lineas, setLineas]         = useState<LineaLocal[]>([]);
  const [loadingCat, setLoadingCat] = useState(false);
  const [nuevaLinea, setNuevaLinea] = useState<{ nombre: string; desc: string; precio: string; es_base: boolean } | null>(null);

  // Carga inicial
  useEffect(() => {
    (async () => {
      const data = await getPresupuestoById(presupuestoId);
      if (!data) { onClose(); return; }
      setPres(data);
      setTipo(data.tipo);
      setNumero(data.numero);
      setNombre(data.cliente_nombre);
      setApellidos(data.cliente_apellidos ?? "");
      setNif(data.cliente_nif ?? "");
      setEmail(data.cliente_email ?? "");
      setTelefono(data.cliente_telefono ?? "");
      setDireccion(data.cliente_direccion ?? "");
      setCp(data.cliente_cp ?? "");
      setCiudad(data.cliente_ciudad ?? "");
      setIva((data.porcentaje_iva as 10 | 21) ?? 21);
      setFormaPago(data.forma_pago ?? []);
      setLineas(data.lineas.map((l) => ({
        nombre_partida: l.nombre_partida,
        descripcion:    l.descripcion,
        precio:         l.precio,
        precioUnitario: l.precio,
        cantidad:       1,
        orden:          l.orden,
        es_base:        l.es_base,
      })));
      setCargando(false);
    })();
  }, [presupuestoId]);

  const esEnviado = pres?.estado === "enviado";

  async function irAPaso2() {
    if (!nombre.trim()) return alert("El nombre del cliente es obligatorio.");
    const sumaPct = formaPago.reduce((s, f) => s + f.porcentaje, 0);
    if (sumaPct !== 100) return alert(`Los porcentajes de forma de pago deben sumar 100% (ahora suman ${sumaPct}%).`);

    if (esEnviado && !confirmVersion) {
      setConfirmVersion(true);
      return;
    }

    setLoadingCat(true);
    const cat = await getCatalogoPresupuesto(tenantId, tipo);
    setCatalogo(cat);
    setLoadingCat(false);
    setConfirmVersion(false);
    setPaso(2);
  }

  function toggleCatalogo(partida: CatalogoPartida) {
    const existe = lineas.find((l) => l.nombre_partida === partida.nombre_partida);
    if (existe) {
      setLineas((prev) => prev.filter((l) => l.nombre_partida !== partida.nombre_partida));
    } else {
      setLineas((prev) => [
        ...prev,
        { nombre_partida: partida.nombre_partida, descripcion: partida.descripcion, precio: partida.precio, precioUnitario: partida.precio, cantidad: 1, orden: prev.length + 1, es_base: partida.es_base },
      ]);
    }
  }

  function actualizarPrecioLinea(nombre_partida: string, nuevoPrecioUnit: number) {
    setLineas((prev) => prev.map((l) =>
      l.nombre_partida === nombre_partida
        ? { ...l, precioUnitario: nuevoPrecioUnit, precio: l.cantidad * nuevoPrecioUnit }
        : l
    ));
  }

  function actualizarCantidadLinea(nombre_partida: string, cantidad: number) {
    if (cantidad < 1) return;
    setLineas((prev) => prev.map((l) =>
      l.nombre_partida === nombre_partida
        ? { ...l, cantidad, precio: cantidad * l.precioUnitario }
        : l
    ));
  }

  function eliminarLinea(nombre_partida: string) {
    setLineas((prev) => prev.filter((l) => l.nombre_partida !== nombre_partida));
  }

  function agregarLineaPersonalizada() {
    if (!nuevaLinea || !nuevaLinea.nombre.trim()) return;
    const precio = parseFloat(nuevaLinea.precio.replace(",", "."));
    if (isNaN(precio) || precio < 0) return alert("Precio inválido");
    setLineas((prev) => [...prev, {
      nombre_partida: nuevaLinea.nombre.trim(),
      descripcion: nuevaLinea.desc.trim() || null,
      precio,
      precioUnitario: precio,
      cantidad: 1,
      orden: prev.length + 1,
      es_base: nuevaLinea.es_base,
    }]);
    setNuevaLinea(null);
  }

  const importeBase  = lineas.reduce((s, l) => s + l.precio, 0);
  const importeIva   = Math.round(importeBase * iva / 100 * 100) / 100;
  const importeTotal = Math.round((importeBase + importeIva) * 100) / 100;

  async function handleGuardar() {
    if (lineas.length === 0) return alert("Añade al menos una partida al presupuesto.");
    if (!pres) return;
    setGuardando(true);

    let targetId = pres.id;

    if (esEnviado) {
      // Crear nueva versión
      const nueva = await createNuevaVersionPresupuesto(pres.id);
      if (!nueva) { alert("Error al crear nueva versión."); setGuardando(false); return; }
      targetId = nueva.id;
    }

    const updated = await updatePresupuesto(targetId, {
      tipo,
      numero,
      clienteNombre:    nombre.trim(),
      clienteApellidos: apellidos.trim() || null,
      clienteNif:       nif.trim() || null,
      clienteEmail:     email.trim() || null,
      clienteTelefono:  telefono.trim() || null,
      clienteDireccion: direccion.trim() || null,
      clienteCp:        cp.trim() || null,
      clienteCiudad:    ciudad.trim() || null,
      porcentajeIva:    iva,
      importeBase,
      formaPago,
      tenantId,
      lineas: lineas.map((l, i) => ({ ...l, orden: i + 1 })),
    });

    setGuardando(false);

    if (!updated) {
      alert("Error al guardar el presupuesto. Inténtalo de nuevo.");
      return;
    }
    onUpdated();
  }

  const catBase   = catalogo.filter((c) => c.es_base);
  const catExtras = catalogo.filter((c) => !c.es_base);

  if (cargando) {
    return (
      <div className="modal-overlay" style={{ zIndex: 9050 }}>
        <div className="modal-panel flex items-center justify-center" style={{ maxWidth: 480, minHeight: 200 }}>
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 9050 }}>
      <div className="modal-panel" style={{ maxWidth: 680, width: "100%", maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-content-primary">
              Editar presupuesto
              {pres && <span className="ml-2 text-sm font-normal text-content-muted">{pres.numero} v{pres.version}</span>}
            </h2>
            <p className="text-sm text-content-secondary">
              Paso {paso} de 2 — {paso === 1 ? "Datos del cliente" : "Partidas del presupuesto"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-content-muted" />
          </button>
        </div>

        {/* Aviso versión nueva (estado enviado) */}
        {esEnviado && paso === 1 && !confirmVersion && (
          <div className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Este presupuesto está en estado <strong>Enviado</strong>. Al guardar los cambios se creará una
              <strong> nueva versión v{(pres?.version ?? 1) + 1}</strong> en borrador.
              El original quedará como histórico.
            </p>
          </div>
        )}

        {/* PASO 1 */}
        {paso === 1 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Tipo */}
            <div>
              <label className="label">Tipo de reforma *</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {TIPO_OPTS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTipo(t.key)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      tipo === t.key
                        ? "border-primary bg-primary-light"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="text-2xl mb-1">{t.emoji}</div>
                    <div className="text-sm font-bold text-content-primary">{t.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Número */}
            <div>
              <label className="label">Número de presupuesto</label>
              <input
                className="input"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>

            {/* Cliente */}
            <div>
              <p className="text-sm font-semibold text-content-primary mb-2">Datos del cliente</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Nombre *</label>
                  <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" />
                </div>
                <div>
                  <label className="label text-xs">Apellidos</label>
                  <input className="input" value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Apellidos" />
                </div>
                <div>
                  <label className="label text-xs">NIF / CIF</label>
                  <input className="input" value={nif} onChange={(e) => setNif(e.target.value)} placeholder="12345678A" />
                </div>
                <div>
                  <label className="label text-xs">Teléfono</label>
                  <input className="input" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="6XX XXX XXX" />
                </div>
                <div className="col-span-2">
                  <label className="label text-xs">Email</label>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
                </div>
                <div className="col-span-2">
                  <label className="label text-xs">Dirección de la obra</label>
                  <input className="input" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número, piso..." />
                </div>
                <div>
                  <label className="label text-xs">Código postal</label>
                  <input className="input" value={cp} onChange={(e) => setCp(e.target.value)} placeholder="08001" />
                </div>
                <div>
                  <label className="label text-xs">Ciudad</label>
                  <input className="input" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Barcelona" />
                </div>
              </div>
            </div>

            {/* IVA */}
            <div>
              <label className="label">IVA aplicable</label>
              <div className="flex gap-2 mt-1">
                {([21, 10] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setIva(v)}
                    className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-bold transition-all ${
                      iva === v ? "border-primary bg-primary-light text-primary" : "border-gray-200 text-content-secondary hover:border-gray-300"
                    }`}
                  >
                    {v}% IVA {v === 21 ? "(general)" : "(reducido)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Forma de pago */}
            <div>
              <label className="label">Forma de pago</label>
              <div className="space-y-2 mt-1">
                {formaPago.map((fp, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="input flex-1 text-sm"
                      value={fp.concepto}
                      onChange={(e) => setFormaPago((prev) => prev.map((f, j) => j === i ? { ...f, concepto: e.target.value } : f))}
                      placeholder="Concepto"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        className="input w-16 text-sm text-center"
                        type="number"
                        min={0} max={100}
                        value={fp.porcentaje}
                        onChange={(e) => setFormaPago((prev) => prev.map((f, j) => j === i ? { ...f, porcentaje: parseInt(e.target.value) || 0 } : f))}
                      />
                      <span className="text-sm text-content-muted">%</span>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-content-muted">
                  Total: {formaPago.reduce((s, f) => s + f.porcentaje, 0)}%{" "}
                  {formaPago.reduce((s, f) => s + f.porcentaje, 0) !== 100 && (
                    <span className="text-danger font-semibold">(debe ser 100%)</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PASO 2 */}
        {paso === 2 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {loadingCat ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Catálogo */}
                {catalogo.length > 0 ? (
                  <div className="space-y-4">
                    {catBase.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2">Partidas base</p>
                        <div className="space-y-1">
                          {catBase.map((c) => {
                            const sel = lineas.some((l) => l.nombre_partida === c.nombre_partida);
                            const linea = lineas.find((l) => l.nombre_partida === c.nombre_partida);
                            return (
                              <CatalogoItem
                                key={c.id} partida={c} seleccionada={sel}
                                linea={linea}
                                onToggle={() => toggleCatalogo(c)}
                                onPrecioChange={(p) => actualizarPrecioLinea(c.nombre_partida, p)}
                                onCantidadChange={(q) => actualizarCantidadLinea(c.nombre_partida, q)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {catExtras.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2">Extras y opcionales</p>
                        <div className="space-y-1">
                          {catExtras.map((c) => {
                            const sel = lineas.some((l) => l.nombre_partida === c.nombre_partida);
                            const linea = lineas.find((l) => l.nombre_partida === c.nombre_partida);
                            return (
                              <CatalogoItem
                                key={c.id} partida={c} seleccionada={sel}
                                linea={linea}
                                onToggle={() => toggleCatalogo(c)}
                                onPrecioChange={(p) => actualizarPrecioLinea(c.nombre_partida, p)}
                                onCantidadChange={(q) => actualizarCantidadLinea(c.nombre_partida, q)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-content-secondary text-sm bg-gray-50 rounded-xl">
                    Sin catálogo para este tipo. Puedes añadir o editar partidas manualmente.
                  </div>
                )}

                {/* Líneas seleccionadas */}
                {lineas.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2">
                      Partidas incluidas ({lineas.length})
                    </p>
                    <div className="space-y-1">
                      {lineas.map((l) => (
                        <div key={l.nombre_partida} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-content-primary truncate">{l.nombre_partida}</p>
                          </div>
                          <CantidadPrecioInline
                            cantidad={l.cantidad}
                            precioUnitario={l.precioUnitario}
                            onCantidadChange={(c) => actualizarCantidadLinea(l.nombre_partida, c)}
                            onPrecioChange={(p) => actualizarPrecioLinea(l.nombre_partida, p)}
                          />
                          <button onClick={() => eliminarLinea(l.nombre_partida)} className="p-1 rounded hover:bg-danger-light hover:text-danger transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nueva línea personalizada */}
                {nuevaLinea ? (
                  <div className="card p-4 space-y-3 border-2 border-dashed border-gray-300">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Nombre partida *</label>
                        <input className="input text-sm" value={nuevaLinea.nombre} onChange={(e) => setNuevaLinea({ ...nuevaLinea, nombre: e.target.value })} placeholder="Ej: Trabajo adicional" />
                      </div>
                      <div>
                        <label className="label text-xs">Precio (€) *</label>
                        <input className="input text-sm" type="number" value={nuevaLinea.precio} onChange={(e) => setNuevaLinea({ ...nuevaLinea, precio: e.target.value })} placeholder="0" />
                      </div>
                    </div>
                    <div>
                      <label className="label text-xs">Descripción</label>
                      <input className="input text-sm" value={nuevaLinea.desc} onChange={(e) => setNuevaLinea({ ...nuevaLinea, desc: e.target.value })} placeholder="Descripción opcional..." />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={nuevaLinea.es_base} onChange={(e) => setNuevaLinea({ ...nuevaLinea, es_base: e.target.checked })} />
                        Es partida base
                      </label>
                      <div className="flex gap-2 ml-auto">
                        <button onClick={() => setNuevaLinea(null)} className="btn-ghost text-sm">Cancelar</button>
                        <button onClick={agregarLineaPersonalizada} className="btn-secondary text-sm">Añadir</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setNuevaLinea({ nombre: "", desc: "", precio: "", es_base: false })}
                    className="btn-ghost text-sm w-full border-dashed"
                  >
                    <Plus className="w-4 h-4" /> Añadir partida personalizada
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex-shrink-0">
          {paso === 2 && (
            <div className="flex items-center justify-between mb-4 px-3 py-2.5 bg-gray-50 rounded-xl">
              <span className="text-sm text-content-secondary">Total presupuesto</span>
              <div className="text-right">
                <p className="text-xs text-content-muted">Base: {fmtE(importeBase)} · IVA {iva}%: {fmtE(importeIva)}</p>
                <p className="text-lg font-black text-content-primary">{fmtE(importeTotal)}</p>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            {paso === 2 && (
              <button onClick={() => setPaso(1)} className="btn-ghost">
                <ChevronLeft className="w-4 h-4" /> Atrás
              </button>
            )}
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            {paso === 1 ? (
              <button onClick={irAPaso2} disabled={loadingCat} className="btn-primary flex-1">
                {loadingCat ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Siguiente</span><ChevronRight className="w-4 h-4" /></>}
              </button>
            ) : (
              <button onClick={handleGuardar} disabled={guardando || lineas.length === 0} className="btn-primary flex-1">
                {guardando
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : esEnviado
                    ? `Guardar como v${(pres?.version ?? 1) + 1}`
                    : "Guardar cambios"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CatalogoItem({
  partida, seleccionada, linea, onToggle, onPrecioChange, onCantidadChange,
}: {
  partida: CatalogoPartida;
  seleccionada: boolean;
  linea?: { cantidad: number; precioUnitario: number };
  onToggle: () => void;
  onPrecioChange: (p: number) => void;
  onCantidadChange: (c: number) => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={`flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
        seleccionada ? "bg-primary-light border border-primary-light" : "hover:bg-gray-50 border border-transparent"
      }`}
    >
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
        seleccionada ? "bg-primary border-primary" : "border-gray-300"
      }`}>
        {seleccionada && <span className="text-white text-xs font-bold">✓</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-content-primary">{partida.nombre_partida}</p>
        {partida.descripcion && <p className="text-xs text-content-muted mt-0.5 line-clamp-2">{partida.descripcion}</p>}
      </div>
      {seleccionada && linea ? (
        <CantidadPrecioInline
          cantidad={linea.cantidad}
          precioUnitario={linea.precioUnitario}
          onCantidadChange={onCantidadChange}
          onPrecioChange={onPrecioChange}
        />
      ) : (
        <span className="text-sm font-bold text-content-secondary whitespace-nowrap">
          {fmtE(partida.precio)}
        </span>
      )}
    </div>
  );
}

function CantidadPrecioInline({
  cantidad, precioUnitario, onCantidadChange, onPrecioChange,
}: {
  cantidad: number; precioUnitario: number;
  onCantidadChange: (c: number) => void; onPrecioChange: (p: number) => void;
}) {
  const [editandoPrecio, setEditandoPrecio] = useState(false);
  const [tempPrecio, setTempPrecio]         = useState(String(precioUnitario));

  function confirmarPrecio() {
    const p = parseFloat(tempPrecio.replace(",", "."));
    if (!isNaN(p) && p >= 0) onPrecioChange(p);
    setEditandoPrecio(false);
  }

  const total = cantidad * precioUnitario;

  return (
    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <input
        type="number"
        min={1}
        value={cantidad}
        onChange={(e) => onCantidadChange(Math.max(1, parseInt(e.target.value) || 1))}
        className="input w-12 py-1 text-sm text-center"
        title="Cantidad"
      />
      <span className="text-xs text-content-muted">×</span>
      {editandoPrecio ? (
        <input
          className="input w-20 py-1 text-sm text-right"
          type="number"
          value={tempPrecio}
          onChange={(e) => setTempPrecio(e.target.value)}
          onBlur={confirmarPrecio}
          onKeyDown={(e) => { if (e.key === "Enter") confirmarPrecio(); if (e.key === "Escape") setEditandoPrecio(false); }}
          autoFocus
        />
      ) : (
        <button
          onClick={() => { setTempPrecio(String(precioUnitario)); setEditandoPrecio(true); }}
          className="text-sm font-semibold text-primary hover:underline whitespace-nowrap"
          title="Clic para editar precio unitario"
        >
          {fmtE(precioUnitario)}
        </button>
      )}
      {cantidad > 1 && (
        <span className="text-xs font-bold text-content-primary whitespace-nowrap">
          = {fmtE(total)}
        </span>
      )}
    </div>
  );
}
