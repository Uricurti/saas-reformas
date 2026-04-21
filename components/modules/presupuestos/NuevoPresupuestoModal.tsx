"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Loader2, ChevronRight, ChevronLeft, ChevronDown, ChevronUp } from "lucide-react";
import {
  createPresupuesto,
  getNextNumeroPresupuesto,
  getCatalogoPresupuesto,
} from "@/lib/insforge/database";
import type { PresupuestoTipo, LineaPresupuesto, CatalogoPartida } from "@/types";

// ── Tipos locales ────────────────────────────────────────────────────────────
type LineaLocal = Omit<LineaPresupuesto, "id" | "created_at" | "tenant_id" | "presupuesto_id"> & {
  cantidad: number;
  precioUnitario: number;
};

type SeccionLocal = {
  localId: string;
  nombre: string;
  tipo: "bano" | "cocina" | "otros";
  lineas: LineaLocal[];
  expandCatalogo: boolean;
  nuevaLinea: NuevaLineaForm | null;
};

type NuevaLineaForm = { nombre: string; desc: string; precio: string; es_base: boolean };

// ── Constantes ───────────────────────────────────────────────────────────────
const TIPO_OPTS: { key: PresupuestoTipo; label: string; emoji: string; desc: string }[] = [
  { key: "bano",   label: "Baño",           emoji: "🛁", desc: "Reforma de baño" },
  { key: "cocina", label: "Cocina",          emoji: "🍳", desc: "Reforma de cocina" },
  { key: "otros",  label: "Otros",           emoji: "🏗️", desc: "Otros trabajos" },
  { key: "mixto",  label: "Completa",        emoji: "🏠", desc: "Varias secciones" },
];

const SECCION_TIPO_OPTS: { key: "bano" | "cocina" | "otros"; label: string; emoji: string }[] = [
  { key: "bano",   label: "Baño",   emoji: "🛁" },
  { key: "cocina", label: "Cocina", emoji: "🍳" },
  { key: "otros",  label: "Otros",  emoji: "🏗️" },
];

const SECCION_BG: Record<string, string>     = { bano: "#EEF2F8", cocina: "#FFF7ED", otros: "#F3F4F6" };
const SECCION_BORDER: Record<string, string> = { bano: "#607eaa", cocina: "#EA580C", otros: "#6B7280" };
const SECCION_TEXT: Record<string, string>   = { bano: "#607eaa", cocina: "#C2410C", otros: "#374151" };

const FORMA_PAGO_DEFAULT = [
  { concepto: "A la aceptación del presupuesto", porcentaje: 50 },
  { concepto: "A mitad de obra",                 porcentaje: 40 },
  { concepto: "A la finalización de los trabajos", porcentaje: 10 },
];

function fmtE(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

// ── Componente principal ─────────────────────────────────────────────────────
export function NuevoPresupuestoModal({
  tenantId,
  userId,
  onClose,
  onCreated,
}: {
  tenantId: string;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [paso, setPaso]               = useState(1);
  const [guardando, setGuardando]     = useState(false);

  // ── Paso 1: datos ────────────────────────────────────────────────
  const [tipo, setTipo]               = useState<PresupuestoTipo>("bano");
  const [numero, setNumero]           = useState("");
  const [loadingNum, setLoadingNum]   = useState(true);
  const [nombre, setNombre]           = useState("");
  const [apellidos, setApellidos]     = useState("");
  const [nif, setNif]                 = useState("");
  const [email, setEmail]             = useState("");
  const [telefono, setTelefono]       = useState("");
  const [direccion, setDireccion]     = useState("");
  const [cp, setCp]                   = useState("");
  const [ciudad, setCiudad]           = useState("");
  const [iva, setIva]                 = useState<10 | 21>(21);
  const [formaPago, setFormaPago]     = useState(FORMA_PAGO_DEFAULT.map((f) => ({ ...f })));

  // ── Paso 2: modo simple ─────────────────────────────────────────
  const [catalogo, setCatalogo]       = useState<CatalogoPartida[]>([]);
  const [lineas, setLineas]           = useState<LineaLocal[]>([]);
  const [loadingCat, setLoadingCat]   = useState(false);
  const [nuevaLinea, setNuevaLinea]   = useState<NuevaLineaForm | null>(null);

  // ── Paso 2: modo mixto ──────────────────────────────────────────
  const [secciones, setSecciones]     = useState<SeccionLocal[]>([]);
  const [catalogoCache, setCatalogoCache] = useState<Record<string, CatalogoPartida[]>>({});
  const [loadingCatTipo, setLoadingCatTipo] = useState<Record<string, boolean>>({});

  const esMixto = tipo === "mixto";

  useEffect(() => {
    getNextNumeroPresupuesto(tenantId).then((n) => { setNumero(n); setLoadingNum(false); });
  }, [tenantId]);

  // ── Carga de catálogo por tipo (con caché) ───────────────────────
  const cargarCatalogoTipo = useCallback(async (t: "bano" | "cocina" | "otros") => {
    if (catalogoCache[t] !== undefined || loadingCatTipo[t]) return;
    setLoadingCatTipo((prev) => ({ ...prev, [t]: true }));
    const cat = await getCatalogoPresupuesto(tenantId, t);
    setCatalogoCache((prev) => ({ ...prev, [t]: cat }));
    setLoadingCatTipo((prev) => ({ ...prev, [t]: false }));
  }, [tenantId, catalogoCache, loadingCatTipo]);

  // ── Paso 1 → 2 ──────────────────────────────────────────────────
  async function irAPaso2() {
    if (!nombre.trim()) return alert("El nombre del cliente es obligatorio.");
    const sumaPct = formaPago.reduce((s, f) => s + f.porcentaje, 0);
    if (sumaPct !== 100) return alert(`Los porcentajes de forma de pago deben sumar 100% (ahora ${sumaPct}%).`);

    if (esMixto) {
      // Inicializar con 1 sección de baño por defecto
      setSecciones([{
        localId: `s${Date.now()}`,
        nombre: "Baño 1",
        tipo: "bano",
        lineas: [],
        expandCatalogo: true,
        nuevaLinea: null,
      }]);
      await cargarCatalogoTipo("bano");
    } else {
      setLoadingCat(true);
      const cat = await getCatalogoPresupuesto(tenantId, tipo as "bano" | "cocina" | "otros");
      setCatalogo(cat);
      const baseLineas: LineaLocal[] = cat.filter((c) => c.es_base).map((c) => ({
        nombre_partida: c.nombre_partida,
        descripcion:    c.descripcion,
        precio:         c.precio,
        precioUnitario: c.precio,
        cantidad:       1,
        orden:          c.orden,
        es_base:        c.es_base,
        seccion:        null,
      }));
      setLineas(baseLineas);
      setLoadingCat(false);
    }
    setPaso(2);
  }

  // ── Gestión secciones (modo mixto) ──────────────────────────────
  function agregarSeccion() {
    const banoCount   = secciones.filter((s) => s.tipo === "bano").length;
    const cocinaCount = secciones.filter((s) => s.tipo === "cocina").length;
    const nuevaTipo: "bano" | "cocina" | "otros" =
      banoCount <= cocinaCount ? "bano" : cocinaCount === 0 ? "cocina" : "otros";
    const nuevoNombre =
      nuevaTipo === "bano"   ? (banoCount === 0 ? "Baño" : `Baño ${banoCount + 1}`)
      : nuevaTipo === "cocina" ? (cocinaCount === 0 ? "Cocina" : `Cocina ${cocinaCount + 1}`)
      : "Otros";
    setSecciones((prev) => [...prev, {
      localId: `s${Date.now()}`,
      nombre: nuevoNombre,
      tipo: nuevaTipo,
      lineas: [],
      expandCatalogo: true,
      nuevaLinea: null,
    }]);
    cargarCatalogoTipo(nuevaTipo);
  }

  function eliminarSeccion(localId: string) {
    setSecciones((prev) => prev.filter((s) => s.localId !== localId));
  }

  function updateSeccion(localId: string, patch: Partial<SeccionLocal>) {
    setSecciones((prev) => prev.map((s) => s.localId === localId ? { ...s, ...patch } : s));
  }

  const SECCION_NOMBRE_LABEL: Record<string, string> = { bano: "Baño", cocina: "Cocina", otros: "Otros" };

  function cambiarTipoSeccion(localId: string, nuevoTipo: "bano" | "cocina" | "otros") {
    setSecciones((prev) => {
      // Count how many OTHER sections already have this tipo
      const existentes = prev.filter((s) => s.localId !== localId && s.tipo === nuevoTipo).length;
      const nuevoNombre = existentes === 0
        ? SECCION_NOMBRE_LABEL[nuevoTipo]
        : `${SECCION_NOMBRE_LABEL[nuevoTipo]} ${existentes + 1}`;
      return prev.map((s) =>
        s.localId === localId ? { ...s, tipo: nuevoTipo, nombre: nuevoNombre, lineas: [], expandCatalogo: true } : s
      );
    });
    cargarCatalogoTipo(nuevoTipo);
  }

  function toggleCatalogoEnSeccion(localId: string, partida: CatalogoPartida) {
    setSecciones((prev) => prev.map((s) => {
      if (s.localId !== localId) return s;
      const existe = s.lineas.find((l) => l.nombre_partida === partida.nombre_partida);
      if (existe) {
        return { ...s, lineas: s.lineas.filter((l) => l.nombre_partida !== partida.nombre_partida) };
      } else {
        return { ...s, lineas: [...s.lineas, {
          nombre_partida: partida.nombre_partida,
          descripcion:    partida.descripcion,
          precio:         partida.precio,
          precioUnitario: partida.precio,
          cantidad:       1,
          orden:          s.lineas.length + 1,
          es_base:        partida.es_base,
          seccion:        null,
        }]};
      }
    }));
  }

  function actualizarPrecioEnSeccion(localId: string, nombre_partida: string, precio: number) {
    setSecciones((prev) => prev.map((s) => {
      if (s.localId !== localId) return s;
      return { ...s, lineas: s.lineas.map((l) =>
        l.nombre_partida === nombre_partida
          ? { ...l, precioUnitario: precio, precio: l.cantidad * precio }
          : l
      )};
    }));
  }

  function actualizarCantidadEnSeccion(localId: string, nombre_partida: string, cantidad: number) {
    if (cantidad < 1) return;
    setSecciones((prev) => prev.map((s) => {
      if (s.localId !== localId) return s;
      return { ...s, lineas: s.lineas.map((l) =>
        l.nombre_partida === nombre_partida
          ? { ...l, cantidad, precio: cantidad * l.precioUnitario }
          : l
      )};
    }));
  }

  function eliminarLineaDeSeccion(localId: string, nombre_partida: string) {
    setSecciones((prev) => prev.map((s) => {
      if (s.localId !== localId) return s;
      return { ...s, lineas: s.lineas.filter((l) => l.nombre_partida !== nombre_partida) };
    }));
  }

  function agregarLineaCustomEnSeccion(localId: string) {
    const sec = secciones.find((s) => s.localId === localId);
    if (!sec?.nuevaLinea || !sec.nuevaLinea.nombre.trim()) return;
    const precio = parseFloat(sec.nuevaLinea.precio.replace(",", "."));
    if (isNaN(precio) || precio < 0) return alert("Precio inválido");
    setSecciones((prev) => prev.map((s) => {
      if (s.localId !== localId) return s;
      return {
        ...s,
        lineas: [...s.lineas, {
          nombre_partida: sec.nuevaLinea!.nombre.trim(),
          descripcion:    sec.nuevaLinea!.desc.trim() || null,
          precio,
          precioUnitario: precio,
          cantidad:       1,
          orden:          s.lineas.length + 1,
          es_base:        sec.nuevaLinea!.es_base,
          seccion:        null,
        }],
        nuevaLinea: null,
      };
    }));
  }

  // ── Gestión líneas (modo simple) ─────────────────────────────────
  function toggleCatalogo(partida: CatalogoPartida) {
    const existe = lineas.find((l) => l.nombre_partida === partida.nombre_partida);
    if (existe) {
      setLineas((prev) => prev.filter((l) => l.nombre_partida !== partida.nombre_partida));
    } else {
      setLineas((prev) => [...prev, {
        nombre_partida: partida.nombre_partida,
        descripcion:    partida.descripcion,
        precio:         partida.precio,
        precioUnitario: partida.precio,
        cantidad:       1,
        orden:          prev.length + 1,
        es_base:        partida.es_base,
        seccion:        null,
      }]);
    }
  }

  function actualizarPrecioLinea(nombre_partida: string, precio: number) {
    setLineas((prev) => prev.map((l) =>
      l.nombre_partida === nombre_partida
        ? { ...l, precioUnitario: precio, precio: l.cantidad * precio } : l
    ));
  }

  function actualizarCantidadLinea(nombre_partida: string, cantidad: number) {
    if (cantidad < 1) return;
    setLineas((prev) => prev.map((l) =>
      l.nombre_partida === nombre_partida
        ? { ...l, cantidad, precio: cantidad * l.precioUnitario } : l
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
      descripcion:    nuevaLinea.desc.trim() || null,
      precio,
      precioUnitario: precio,
      cantidad:       1,
      orden:          prev.length + 1,
      es_base:        nuevaLinea.es_base,
      seccion:        null,
    }]);
    setNuevaLinea(null);
  }

  // ── Totales ──────────────────────────────────────────────────────
  const importeBase = esMixto
    ? secciones.reduce((t, s) => t + s.lineas.reduce((st, l) => st + l.precio, 0), 0)
    : lineas.reduce((s, l) => s + l.precio, 0);
  const importeIva   = Math.round(importeBase * iva / 100 * 100) / 100;
  const importeTotal = Math.round((importeBase + importeIva) * 100) / 100;

  // ── Guardar ──────────────────────────────────────────────────────
  async function handleGuardar() {
    const todasLineas: LineaLocal[] = esMixto
      ? secciones.flatMap((s, si) =>
          s.lineas.map((l, li) => ({
            ...l,
            orden: si * 1000 + li + 1,
            seccion: `${s.tipo}:${s.nombre}`,
          }))
        )
      : lineas.map((l, i) => ({ ...l, orden: i + 1, seccion: null }));

    if (todasLineas.length === 0) return alert("Añade al menos una partida al presupuesto.");
    if (esMixto && secciones.every((s) => s.lineas.length === 0)) return alert("Añade partidas a al menos una sección.");

    setGuardando(true);
    const pres = await createPresupuesto({
      tenantId, numero, tipo,
      clienteNombre:    nombre.trim(),
      clienteApellidos: apellidos.trim() || undefined,
      clienteNif:       nif.trim() || undefined,
      clienteEmail:     email.trim() || undefined,
      clienteTelefono:  telefono.trim() || undefined,
      clienteDireccion: direccion.trim() || undefined,
      clienteCp:        cp.trim() || undefined,
      clienteCiudad:    ciudad.trim() || undefined,
      importeBase,
      porcentajeIva:    iva,
      formaPago,
      lineas:           todasLineas,
    });
    setGuardando(false);

    if (!pres) {
      alert("Error al guardar el presupuesto. Comprueba la conexión y vuelve a intentarlo.");
      return;
    }
    onCreated();
  }

  const catBase   = catalogo.filter((c) => c.es_base);
  const catExtras = catalogo.filter((c) => !c.es_base);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" style={{ zIndex: 9050 }}>
      <div
        className="modal-panel"
        style={{
          maxWidth: esMixto && paso === 2 ? 760 : 680,
          width: "100%",
          maxHeight: "92vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          transition: "max-width 0.2s",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-content-primary">Nuevo presupuesto</h2>
            <p className="text-sm text-content-secondary">
              Paso {paso} de 2 — {paso === 1 ? "Datos del cliente" : "Partidas del presupuesto"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-content-muted" />
          </button>
        </div>

        {/* ═══ PASO 1 ═══════════════════════════════════════════════ */}
        {paso === 1 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Tipo */}
            <div>
              <label className="label">Tipo de presupuesto *</label>
              <div className="grid grid-cols-4 gap-2 mt-1">
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
                    <div className="text-xs font-bold text-content-primary">{t.label}</div>
                    <div className="text-xs text-content-muted mt-0.5 leading-tight">{t.desc}</div>
                  </button>
                ))}
              </div>
              {esMixto && (
                <p className="text-xs text-primary bg-primary-light rounded-lg px-3 py-2 mt-2">
                  🏠 Podrás añadir múltiples secciones independientes: Baño 1, Baño 2, Cocina, Suelos…
                </p>
              )}
            </div>

            {/* Número */}
            <div>
              <label className="label">Número de presupuesto</label>
              <input
                className="input"
                value={loadingNum ? "Cargando..." : numero}
                onChange={(e) => setNumero(e.target.value)}
                disabled={loadingNum}
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
                    />
                    <div className="flex items-center gap-1">
                      <input
                        className="input w-16 text-sm text-center"
                        type="number" min={0} max={100}
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

        {/* ═══ PASO 2 — MODO SIMPLE ═══════════════════════════════ */}
        {paso === 2 && !esMixto && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {loadingCat ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {catalogo.length > 0 ? (
                  <div className="space-y-4">
                    {catBase.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2">Partidas base</p>
                        <div className="space-y-1">
                          {catBase.map((c) => {
                            const sel   = lineas.some((l) => l.nombre_partida === c.nombre_partida);
                            const linea = lineas.find((l) => l.nombre_partida === c.nombre_partida);
                            return (
                              <CatalogoItem
                                key={c.id} partida={c} seleccionada={sel} linea={linea}
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
                            const sel   = lineas.some((l) => l.nombre_partida === c.nombre_partida);
                            const linea = lineas.find((l) => l.nombre_partida === c.nombre_partida);
                            return (
                              <CatalogoItem
                                key={c.id} partida={c} seleccionada={sel} linea={linea}
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
                    Sin catálogo para este tipo. Puedes añadir partidas manualmente.
                  </div>
                )}

                {lineas.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-2">
                      Partidas seleccionadas ({lineas.length})
                    </p>
                    <div className="space-y-1">
                      {lineas.map((l) => (
                        <div key={l.nombre_partida} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-content-primary truncate">{l.nombre_partida}</p>
                          </div>
                          <CantidadPrecioInline
                            cantidad={l.cantidad} precioUnitario={l.precioUnitario}
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

                {nuevaLinea ? (
                  <div className="card p-4 space-y-3 border-2 border-dashed border-gray-300">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">Nombre partida *</label>
                        <input className="input text-sm" value={nuevaLinea.nombre} onChange={(e) => setNuevaLinea({ ...nuevaLinea, nombre: e.target.value })} placeholder="Ej: Trabajo adicional" />
                      </div>
                      <div>
                        <label className="label text-xs">Precio (€) *</label>
                        <input className="input text-sm" type="number" value={nuevaLinea.precio} onChange={(e) => setNuevaLinea({ ...nuevaLinea, precio: e.target.value })} />
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
                  <button onClick={() => setNuevaLinea({ nombre: "", desc: "", precio: "", es_base: false })} className="btn-ghost text-sm w-full border-dashed">
                    <Plus className="w-4 h-4" /> Añadir partida personalizada
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ PASO 2 — MODO MIXTO ════════════════════════════════ */}
        {paso === 2 && esMixto && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Resumen rápido */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl text-sm">
              <span className="text-content-secondary font-medium">{secciones.length} sección{secciones.length !== 1 ? "es" : ""}</span>
              <span className="font-black text-content-primary">{fmtE(importeBase)} base</span>
            </div>

            {/* Secciones */}
            {secciones.map((sec, idx) => {
              const cat       = catalogoCache[sec.tipo] ?? [];
              const isLoading = loadingCatTipo[sec.tipo];
              const subtotal  = sec.lineas.reduce((s, l) => s + l.precio, 0);
              const bg        = SECCION_BG[sec.tipo] ?? "#F3F4F6";
              const border    = SECCION_BORDER[sec.tipo] ?? "#6B7280";
              const textColor = SECCION_TEXT[sec.tipo] ?? "#374151";
              const catBase_s = cat.filter((c) => c.es_base);
              const catExt_s  = cat.filter((c) => !c.es_base);

              return (
                <div key={sec.localId} style={{ border: `1.5px solid ${border}30`, borderRadius: 12, overflow: "hidden" }}>
                  {/* Header sección */}
                  <div style={{ background: bg, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${border}20` }}>
                    <span style={{ fontSize: 16 }}>
                      {sec.tipo === "bano" ? "🛁" : sec.tipo === "cocina" ? "🍳" : "🏗️"}
                    </span>
                    <input
                      value={sec.nombre}
                      onChange={(e) => updateSeccion(sec.localId, { nombre: e.target.value })}
                      style={{
                        flex: 1, fontSize: 13, fontWeight: 700, color: textColor,
                        background: "transparent", border: "none", outline: "none",
                        minWidth: 0,
                      }}
                      placeholder="Nombre de la sección"
                    />
                    {/* Tipo selector */}
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {SECCION_TIPO_OPTS.map((t) => (
                        <button
                          key={t.key}
                          onClick={() => cambiarTipoSeccion(sec.localId, t.key)}
                          title={t.label}
                          style={{
                            padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            border: `1.5px solid ${sec.tipo === t.key ? border : "transparent"}`,
                            background: sec.tipo === t.key ? `${border}18` : "transparent",
                            color: sec.tipo === t.key ? textColor : "#9CA3AF",
                            cursor: "pointer",
                          }}
                        >
                          {t.emoji} {t.label}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: textColor, flexShrink: 0, marginLeft: 4 }}>
                      {fmtE(subtotal)}
                    </span>
                    {secciones.length > 1 && (
                      <button
                        onClick={() => eliminarSeccion(sec.localId)}
                        title="Eliminar sección"
                        style={{ padding: 4, borderRadius: 6, background: "transparent", border: "none", cursor: "pointer", color: "#EF4444", flexShrink: 0 }}
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                  </div>

                  {/* Cuerpo sección */}
                  <div style={{ padding: "12px 14px" }}>
                    {isLoading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                    ) : (
                      <>
                        {/* Toggle catálogo */}
                        {cat.length > 0 && (
                          <button
                            onClick={() => updateSeccion(sec.localId, { expandCatalogo: !sec.expandCatalogo })}
                            className="flex items-center gap-2 text-xs font-bold text-content-muted uppercase tracking-wider mb-2 hover:text-primary transition-colors"
                          >
                            {sec.expandCatalogo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            Catálogo {sec.tipo === "bano" ? "baño" : sec.tipo === "cocina" ? "cocina" : "otros"} ({cat.length} partidas)
                          </button>
                        )}

                        {sec.expandCatalogo && cat.length > 0 && (
                          <div className="space-y-1 mb-3">
                            {catBase_s.length > 0 && (
                              <>
                                <p className="text-xs text-content-muted mb-1">Partidas base</p>
                                {catBase_s.map((c) => {
                                  const sel   = sec.lineas.some((l) => l.nombre_partida === c.nombre_partida);
                                  const linea = sec.lineas.find((l) => l.nombre_partida === c.nombre_partida);
                                  return (
                                    <CatalogoItem
                                      key={c.id} partida={c} seleccionada={sel} linea={linea}
                                      onToggle={() => toggleCatalogoEnSeccion(sec.localId, c)}
                                      onPrecioChange={(p) => actualizarPrecioEnSeccion(sec.localId, c.nombre_partida, p)}
                                      onCantidadChange={(q) => actualizarCantidadEnSeccion(sec.localId, c.nombre_partida, q)}
                                    />
                                  );
                                })}
                              </>
                            )}
                            {catExt_s.length > 0 && (
                              <>
                                <p className="text-xs text-content-muted mt-2 mb-1">Extras y opcionales</p>
                                {catExt_s.map((c) => {
                                  const sel   = sec.lineas.some((l) => l.nombre_partida === c.nombre_partida);
                                  const linea = sec.lineas.find((l) => l.nombre_partida === c.nombre_partida);
                                  return (
                                    <CatalogoItem
                                      key={c.id} partida={c} seleccionada={sel} linea={linea}
                                      onToggle={() => toggleCatalogoEnSeccion(sec.localId, c)}
                                      onPrecioChange={(p) => actualizarPrecioEnSeccion(sec.localId, c.nombre_partida, p)}
                                      onCantidadChange={(q) => actualizarCantidadEnSeccion(sec.localId, c.nombre_partida, q)}
                                    />
                                  );
                                })}
                              </>
                            )}
                          </div>
                        )}

                        {/* Líneas seleccionadas de esta sección */}
                        {sec.lineas.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-bold text-content-muted uppercase tracking-wider mb-1.5">
                              Incluidas ({sec.lineas.length})
                            </p>
                            <div className="space-y-1">
                              {sec.lineas.map((l) => (
                                <div key={l.nombre_partida} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-content-primary truncate">{l.nombre_partida}</p>
                                  </div>
                                  <CantidadPrecioInline
                                    cantidad={l.cantidad} precioUnitario={l.precioUnitario}
                                    onCantidadChange={(c) => actualizarCantidadEnSeccion(sec.localId, l.nombre_partida, c)}
                                    onPrecioChange={(p) => actualizarPrecioEnSeccion(sec.localId, l.nombre_partida, p)}
                                  />
                                  <button onClick={() => eliminarLineaDeSeccion(sec.localId, l.nombre_partida)} className="p-1 rounded hover:bg-danger-light hover:text-danger transition-colors">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Añadir partida personalizada a esta sección */}
                        {sec.nuevaLinea ? (
                          <div className="mt-2 p-3 border border-dashed border-gray-300 rounded-lg space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                className="input text-xs"
                                placeholder="Nombre partida *"
                                value={sec.nuevaLinea.nombre}
                                onChange={(e) => updateSeccion(sec.localId, { nuevaLinea: { ...sec.nuevaLinea!, nombre: e.target.value } })}
                              />
                              <input
                                className="input text-xs"
                                type="number"
                                placeholder="Precio €"
                                value={sec.nuevaLinea.precio}
                                onChange={(e) => updateSeccion(sec.localId, { nuevaLinea: { ...sec.nuevaLinea!, precio: e.target.value } })}
                              />
                            </div>
                            <input
                              className="input text-xs"
                              placeholder="Descripción (opcional)"
                              value={sec.nuevaLinea.desc}
                              onChange={(e) => updateSeccion(sec.localId, { nuevaLinea: { ...sec.nuevaLinea!, desc: e.target.value } })}
                            />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => updateSeccion(sec.localId, { nuevaLinea: null })} className="btn-ghost text-xs py-1">Cancelar</button>
                              <button onClick={() => agregarLineaCustomEnSeccion(sec.localId)} className="btn-secondary text-xs py-1">Añadir</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => updateSeccion(sec.localId, { nuevaLinea: { nombre: "", desc: "", precio: "", es_base: false } })}
                            className="btn-ghost text-xs w-full border-dashed mt-1"
                          >
                            <Plus className="w-3 h-3" /> Añadir partida personalizada
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Botón añadir sección */}
            <button
              onClick={agregarSeccion}
              className="btn-ghost text-sm w-full border-dashed"
              style={{ borderStyle: "dashed" }}
            >
              <Plus className="w-4 h-4" /> Nueva sección
            </button>
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
              <button
                onClick={handleGuardar}
                disabled={guardando || (esMixto ? secciones.every((s) => s.lineas.length === 0) : lineas.length === 0)}
                className="btn-primary flex-1"
              >
                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar presupuesto"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes compartidos ──────────────────────────────────────────────
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
          cantidad={linea.cantidad} precioUnitario={linea.precioUnitario}
          onCantidadChange={onCantidadChange} onPrecioChange={onPrecioChange}
        />
      ) : (
        <span className="text-sm font-bold text-content-secondary whitespace-nowrap">
          {partida.precio.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
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
  const [editando, setEditando]   = useState(false);
  const [tempPrecio, setTempPrecio] = useState(String(precioUnitario));

  function confirmar() {
    const p = parseFloat(tempPrecio.replace(",", "."));
    if (!isNaN(p) && p >= 0) onPrecioChange(p);
    setEditando(false);
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <input
        type="number" min={1} value={cantidad}
        onChange={(e) => onCantidadChange(Math.max(1, parseInt(e.target.value) || 1))}
        className="input w-12 py-1 text-sm text-center"
        title="Cantidad"
      />
      <span className="text-xs text-content-muted">×</span>
      {editando ? (
        <input
          className="input w-20 py-1 text-sm text-right"
          type="number" value={tempPrecio}
          onChange={(e) => setTempPrecio(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => { if (e.key === "Enter") confirmar(); if (e.key === "Escape") setEditando(false); }}
          autoFocus
        />
      ) : (
        <button
          onClick={() => { setTempPrecio(String(precioUnitario)); setEditando(true); }}
          className="text-sm font-semibold text-primary hover:underline whitespace-nowrap"
          title="Clic para editar precio unitario"
        >
          {precioUnitario.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </button>
      )}
      {cantidad > 1 && (
        <span className="text-xs font-bold text-content-primary whitespace-nowrap">
          = {(cantidad * precioUnitario).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </span>
      )}
    </div>
  );
}
