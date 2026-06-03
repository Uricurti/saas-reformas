"use client";

import { useState, useEffect } from "react";
import {
  X, Plus, Trash2, Loader2, ChevronRight, ChevronLeft,
  Download, Pencil, Check,
} from "lucide-react";
import { getNextNumeroFactura, createFacturaDirecta, getTenantConfig } from "@/lib/insforge/database";
import type { TenantConfig } from "@/lib/insforge/database";
import { FormaPagoEditor, type FilaPago } from "@/components/ui/FormaPagoEditor";

// ── Tipos locales ─────────────────────────────────────────────────────────────
type LineaDirecta = {
  nombre_partida: string;
  descripcion: string | null;
  precio: number;
  es_base: boolean;
};

function fmtE(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function fmtDate(d: string) {
  try {
    const [y, m, day] = d.split("-");
    const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    return `${parseInt(day)} de ${meses[parseInt(m) - 1]} de ${y}`;
  } catch { return d; }
}

// ── Documento PDF ─────────────────────────────────────────────────────────────
function FacturaDirectaDocument({
  numero, fecha, concepto, lineas, porcentajeIva, formaPago,
  clienteNombre, clienteNif, clienteEmail, clienteTelefono,
  facturacionNombre, facturacionNif, facturacionDireccion, facturacionCp, facturacionCiudad,
  config, idOverride,
}: {
  numero: string; fecha: string; concepto: string;
  lineas: LineaDirecta[]; porcentajeIva: number;
  formaPago: FilaPago[];
  clienteNombre: string; clienteNif?: string; clienteEmail?: string; clienteTelefono?: string;
  facturacionNombre?: string; facturacionNif?: string;
  facturacionDireccion?: string; facturacionCp?: string; facturacionCiudad?: string;
  config: TenantConfig | null;
  idOverride?: string;
}) {
  const PRIMARY   = "#607eaa";
  const PRIMARY_D = "#1c3879";
  const TEXT_DARK = "#1A1A2E";
  const TEXT_MID  = "#4A5568";
  const TEXT_SOFT = "#6b7280";
  const TEXT_FAINT= "#94a3b8";
  const BG_LIGHT  = "#EEF2F8";
  const fontBase: React.CSSProperties = { fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" };

  const importeBase = lineas.reduce((s, l) => s + l.precio, 0);
  const importeIva  = Math.round(importeBase * porcentajeIva / 100 * 100) / 100;
  const importeTotal= Math.round((importeBase + importeIva) * 100) / 100;

  const nombreFacturar = facturacionNombre ?? clienteNombre;
  const nifFacturar    = facturacionNif ?? clienteNif;
  const dirFacturar    = facturacionDireccion;
  const cpCiudad       = [facturacionCp, facturacionCiudad].filter(Boolean).join(" ");

  return (
    <div id={idOverride ?? "factura-directa-doc"} style={{ ...fontBase, background: "#fff", width: 794, boxSizing: "border-box", padding: "36px 48px 28px", color: TEXT_DARK, fontSize: "12.5px", lineHeight: 1.5 }}>

      {/* Cabecera */}
      <div className="no-page-break" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ maxWidth: 320 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: PRIMARY, letterSpacing: "-0.5px", lineHeight: 1.1, marginBottom: 8 }}>
            {config?.empresa_nombre ?? "Tu Empresa"}
          </div>
          {config?.empresa_cif && <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 2 }}><strong style={{ color: TEXT_MID }}>CIF:</strong> {config.empresa_cif}</div>}
          {config?.empresa_direccion && <div style={{ fontSize: 12, color: TEXT_SOFT }}>{config.empresa_direccion}</div>}
          {config?.empresa_telefono && <div style={{ fontSize: 12, color: TEXT_SOFT }}>{config.empresa_telefono}</div>}
          {config?.empresa_email && <div style={{ fontSize: 12, color: TEXT_SOFT }}>{config.empresa_email}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_FAINT, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Factura</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: TEXT_DARK, letterSpacing: "-1px", lineHeight: 1 }}>{numero}</div>
          <div style={{ fontSize: 12, color: TEXT_SOFT, marginTop: 6 }}>{fmtDate(fecha)}</div>
        </div>
      </div>

      {/* Línea */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${PRIMARY}, #26bbec 50%, transparent)`, borderRadius: 99, marginBottom: 20 }} />

      {/* Facturar a */}
      <div className="no-page-break" style={{ marginBottom: 20 }}>
        <div style={{ padding: "12px 16px", background: "#f9fafb", borderRadius: 10, borderLeft: `3px solid ${PRIMARY}`, display: "inline-block", minWidth: 280, maxWidth: "48%" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: TEXT_FAINT, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Facturar a</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_DARK, marginBottom: 4 }}>{nombreFacturar}</div>
          {nifFacturar && <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 1 }}><strong style={{ color: TEXT_MID }}>{facturacionNif ? "CIF:" : "NIF/CIF:"}</strong> {nifFacturar}</div>}
          {dirFacturar && <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 1 }}>{dirFacturar}</div>}
          {cpCiudad && <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 1 }}>{cpCiudad}</div>}
          {clienteEmail && <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 1 }}>{clienteEmail}</div>}
          {clienteTelefono && <div style={{ fontSize: 12, color: TEXT_SOFT }}>{clienteTelefono}</div>}
        </div>
      </div>

      {/* Concepto */}
      <div style={{ background: BG_LIGHT, borderRadius: 12, padding: "14px 20px", marginBottom: 18 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: PRIMARY, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Concepto</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: TEXT_DARK, letterSpacing: "-0.3px" }}>{concepto}</div>
      </div>

      {/* Tabla líneas */}
      <div className="no-page-break" style={{ marginBottom: 18 }}>
        {/* Cabecera */}
        <div style={{ display: "flex", background: TEXT_DARK, borderRadius: "8px 8px 0 0", padding: "9px 14px" }}>
          <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase" }}>Descripción</div>
          <div style={{ width: 120, fontSize: 10, fontWeight: 700, color: "#fff", textAlign: "right", letterSpacing: "0.06em" }}>Importe</div>
        </div>
        {lineas.map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", padding: "10px 14px", background: i % 2 === 0 ? "#fff" : "#f9fafb", borderBottom: "1px solid #f0f0f5" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_DARK }}>{l.nombre_partida}</div>
              {l.descripcion && <div style={{ fontSize: 11, color: TEXT_SOFT, marginTop: 2 }}>{l.descripcion}</div>}
            </div>
            <div style={{ width: 120, fontSize: 13, fontWeight: 700, color: TEXT_DARK, textAlign: "right" }}>{fmtE(l.precio)}</div>
          </div>
        ))}
        <div style={{ height: 2, background: TEXT_DARK, borderRadius: "0 0 4px 4px" }} />
      </div>

      {/* Totales */}
      <div className="no-page-break" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <div style={{ width: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 13, color: TEXT_SOFT }}>Base imponible</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_MID }}>{fmtE(importeBase)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 13, color: TEXT_SOFT }}>IVA ({porcentajeIva}%)</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_MID }}>{fmtE(importeIva)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", background: TEXT_DARK, borderRadius: 10, marginTop: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "0.04em" }}>TOTAL</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>{fmtE(importeTotal)}</span>
          </div>
        </div>
      </div>

      {/* Forma de pago — solo si hay más de 1 hito */}
      {formaPago.length > 1 && (
        <div className="no-page-break" style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            Calendario de pagos
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            {formaPago.map((fp, i) => {
              const importe = Math.round(importeTotal * fp.porcentaje / 100 * 100) / 100;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "9px 14px", background: i % 2 === 0 ? "#fff" : "#f9fafb", borderBottom: i < formaPago.length - 1 ? "1px solid #f0f0f5" : "none" }}>
                  <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#1A1A2E" }}>{fp.concepto}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginRight: 16 }}>{fp.porcentaje}%</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A2E" }}>{fmtE(importe)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* IBAN */}
      {(config as any)?.numero_cuenta && (
        <div style={{ background: "#f0f9ff", border: "1.5px solid #bae6fd", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#0284c7", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Instrucciones de pago</div>
          <div style={{ fontSize: 12, color: TEXT_MID }}>Para abonar esta factura, realice una transferencia indicando el número <strong style={{ color: TEXT_DARK }}>{numero}</strong> en el concepto.</div>
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#0284c7", textTransform: "uppercase" }}>IBAN:</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: TEXT_DARK, fontFamily: "monospace" }}>{(config as any).numero_cuenta}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: "1.5px solid #EEF2F8", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: 10, color: TEXT_FAINT, maxWidth: 380, lineHeight: 1.6 }}>
          Factura nº {numero} emitida conforme a la normativa fiscal vigente (Ley 37/1992 del IVA).
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: PRIMARY, letterSpacing: "-0.5px", lineHeight: 1 }}>ReforLife</div>
          <div style={{ fontSize: 9, color: TEXT_FAINT, marginTop: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>Gestión profesional de reformas</div>
        </div>
      </div>
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────
export function FacturaDirectaModal({
  tenantId,
  onClose,
  onCreated,
}: {
  tenantId: string;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [paso, setPaso]             = useState<1 | 2>(1);
  const [guardando, setGuardando]   = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [config, setConfig]         = useState<TenantConfig | null>(null);

  // Paso 1 — datos cliente + cabecera
  const [numero, setNumero]           = useState("");
  const [fecha, setFecha]             = useState(new Date().toISOString().split("T")[0]);
  const [concepto, setConcepto]       = useState("");
  const [iva, setIva]                 = useState<10 | 21>(21);
  const [clienteNombre, setClienteNombre]   = useState("");
  const [clienteNif, setClienteNif]         = useState("");
  const [clienteEmail, setClienteEmail]     = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [mismaDireccion, setMismaDireccion] = useState(true);
  const [facNombre, setFacNombre]   = useState("");
  const [facNif, setFacNif]         = useState("");
  const [facDir, setFacDir]         = useState("");
  const [facCp, setFacCp]           = useState("");
  const [facCiudad, setFacCiudad]   = useState("");
  const [formaPago, setFormaPago]   = useState<FilaPago[]>([{ concepto: "Pago único", porcentaje: 100 }]);

  // Paso 2 — líneas
  const [lineas, setLineas]           = useState<LineaDirecta[]>([]);
  const [nuevaLinea, setNuevaLinea]   = useState<{ nombre: string; desc: string; precio: string } | null>(null);
  const [editando, setEditando]       = useState<number | null>(null);
  const [editForm, setEditForm]       = useState<{ nombre: string; desc: string; precio: string } | null>(null);

  const importeBase  = lineas.reduce((s, l) => s + l.precio, 0);
  const importeIva   = Math.round(importeBase * iva / 100 * 100) / 100;
  const importeTotal = Math.round((importeBase + importeIva) * 100) / 100;

  useEffect(() => {
    getNextNumeroFactura(tenantId).then(setNumero);
    getTenantConfig(tenantId).then(setConfig);
  }, [tenantId]);

  function agregarLinea() {
    if (!nuevaLinea?.nombre.trim()) return;
    const precio = parseFloat(nuevaLinea.precio.replace(",", "."));
    if (isNaN(precio) || precio < 0) return;
    setLineas((prev) => [...prev, { nombre_partida: nuevaLinea.nombre.trim(), descripcion: nuevaLinea.desc.trim() || null, precio, es_base: true }]);
    setNuevaLinea(null);
  }

  function guardarEdicion() {
    if (editando === null || !editForm) return;
    const precio = parseFloat(editForm.precio.replace(",", "."));
    if (!editForm.nombre.trim() || isNaN(precio) || precio < 0) return;
    setLineas((prev) => prev.map((l, i) => i === editando ? { ...l, nombre_partida: editForm.nombre.trim(), descripcion: editForm.desc.trim() || null, precio } : l));
    setEditando(null); setEditForm(null);
  }

  async function handleGuardar() {
    if (!clienteNombre.trim()) return alert("El nombre del cliente es obligatorio.");
    if (!concepto.trim()) return alert("El concepto es obligatorio.");
    if (lineas.length === 0) return alert("Añade al menos una línea a la factura.");
    setGuardando(true);
    const { error } = await createFacturaDirecta({
      tenantId, concepto, numeroFactura: numero, fecha,
      porcentajeIva: iva,
      lineas: lineas.map((l) => ({ ...l, seccion: null })),
      formaPago: formaPago.map((fp) => ({ concepto: fp.concepto, porcentaje: fp.porcentaje, fechaPrevista: null })),
      clienteNombre: clienteNombre.trim(),
      clienteNif: clienteNif.trim() || null,
      clienteEmail: clienteEmail.trim() || null,
      clienteTelefono: clienteTelefono.trim() || null,
      facturacionNombre: !mismaDireccion ? (facNombre.trim() || null) : null,
      facturacionNif: !mismaDireccion ? (facNif.trim() || null) : null,
      facturacionDireccion: !mismaDireccion ? (facDir.trim() || null) : null,
      facturacionCp: !mismaDireccion ? (facCp.trim() || null) : null,
      facturacionCiudad: !mismaDireccion ? (facCiudad.trim() || null) : null,
    });
    setGuardando(false);
    if (error) { alert("Error al guardar: " + error); return; }
    onCreated?.();
    await handleDownload();
    onClose();
  }

  async function handleDownload() {
    const element = document.getElementById("factura-directa-doc");
    if (!element) return;
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js" as any)).default;
      await html2pdf().set({
        margin: 0,
        filename: `${numero}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
        pagebreak: { mode: ["css", "legacy"], avoid: [".no-page-break"] },
      }).from(element).save();
    } catch (err) { console.error(err); }
    finally { setDownloading(false); }
  }

  const docProps = {
    numero, fecha, concepto, lineas, porcentajeIva: iva, formaPago,
    clienteNombre, clienteNif, clienteEmail, clienteTelefono,
    facturacionNombre: !mismaDireccion ? facNombre : undefined,
    facturacionNif: !mismaDireccion ? facNif : undefined,
    facturacionDireccion: !mismaDireccion ? facDir : undefined,
    facturacionCp: !mismaDireccion ? facCp : undefined,
    facturacionCiudad: !mismaDireccion ? facCiudad : undefined,
    config,
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9050 }}>
      <div className="modal-panel" style={{ maxWidth: paso === 2 ? 1100 : 660, width: "100%", maxHeight: "94vh", overflow: "hidden", display: "flex", flexDirection: "column", transition: "max-width 0.2s" }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-content-primary">Nueva factura directa</h2>
            <p className="text-sm text-content-secondary">
              Paso {paso} de 2 — {paso === 1 ? "Datos del cliente" : "Líneas y previsualización"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-5 h-5 text-content-muted" /></button>
        </div>

        {/* ═══ PASO 1 ═══════════════════════════════════════════════ */}
        {paso === 1 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Número + fecha + concepto */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Número de factura</label>
                <input className="input" value={numero} onChange={(e) => setNumero(e.target.value)} />
              </div>
              <div>
                <label className="label">Fecha</label>
                <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Concepto *</label>
                <input className="input" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: Servicios de diseño, Consultoría, Materiales..." />
              </div>
            </div>

            {/* IVA */}
            <div>
              <label className="label">IVA</label>
              <div className="flex gap-2 mt-1">
                {([21, 10] as const).map((v) => (
                  <button key={v} onClick={() => setIva(v)}
                    className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-bold transition-all ${iva === v ? "border-primary bg-primary-light text-primary" : "border-gray-200 text-content-secondary hover:border-gray-300"}`}>
                    {v}% {v === 21 ? "(general)" : "(reducido)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Forma de pago */}
            <div>
              <label className="label">Forma de pago</label>
              <div className="mt-2">
                <FormaPagoEditor value={formaPago} onChange={setFormaPago} />
              </div>
            </div>

            {/* Datos cliente */}
            <div>
              <p className="text-sm font-semibold text-content-primary mb-2">Datos del cliente</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Nombre / Razón social *</label>
                  <input className="input" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">NIF / CIF</label>
                  <input className="input" value={clienteNif} onChange={(e) => setClienteNif(e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Email</label>
                  <input className="input" type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} />
                </div>
                <div>
                  <label className="label text-xs">Teléfono</label>
                  <input className="input" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} />
                </div>

                {/* Dirección facturación */}
                <div className="col-span-2 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={mismaDireccion} onChange={(e) => setMismaDireccion(e.target.checked)} className="w-4 h-4 rounded" />
                    <span className="text-sm text-content-secondary">🧾 Sin dirección de facturación separada</span>
                  </label>
                </div>
                {!mismaDireccion && (
                  <>
                    <div className="col-span-2">
                      <label className="label text-xs">🏢 Nombre empresa / Razón social facturación</label>
                      <input className="input" value={facNombre} onChange={(e) => setFacNombre(e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <label className="label text-xs">CIF empresa</label>
                      <input className="input" value={facNif} onChange={(e) => setFacNif(e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <label className="label text-xs">Dirección de facturación</label>
                      <input className="input" value={facDir} onChange={(e) => setFacDir(e.target.value)} />
                    </div>
                    <div>
                      <label className="label text-xs">CP</label>
                      <input className="input" value={facCp} onChange={(e) => setFacCp(e.target.value)} />
                    </div>
                    <div>
                      <label className="label text-xs">Ciudad</label>
                      <input className="input" value={facCiudad} onChange={(e) => setFacCiudad(e.target.value)} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ PASO 2 ═══════════════════════════════════════════════ */}
        {paso === 2 && (
          <div className="flex-1 overflow-hidden flex gap-0" style={{ minHeight: 0 }}>

            {/* Panel izquierdo — líneas */}
            <div className="w-80 flex-shrink-0 border-r border-gray-100 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-content-primary">Líneas de la factura</p>
                <span className="text-xs font-bold" style={{ color: "#607eaa" }}>{fmtE(importeTotal)}</span>
              </div>

              {/* Líneas */}
              <div className="space-y-1">
                {lineas.map((l, i) => (
                  <div key={i}>
                    {editando === i && editForm ? (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                        <input className="input text-xs" value={editForm.nombre} autoFocus
                          onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Escape") { setEditando(null); setEditForm(null); } }}
                          placeholder="Nombre *" />
                        <textarea className="input text-xs w-full" rows={2} value={editForm.desc}
                          onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })}
                          placeholder="Descripción opcional..." />
                        <input className="input text-xs" type="number" value={editForm.precio}
                          onChange={(e) => setEditForm({ ...editForm, precio: e.target.value })}
                          placeholder="Precio €" />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => { setEditando(null); setEditForm(null); }} className="btn-ghost text-xs py-1">Cancelar</button>
                          <button onClick={guardarEdicion} className="btn-primary text-xs py-1 px-3"><Check className="w-3 h-3 mr-1" />OK</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 px-3 py-2 bg-gray-50 rounded-lg group">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-content-primary">{l.nombre_partida}</p>
                          {l.descripcion && <p className="text-xs text-content-muted truncate">{l.descripcion}</p>}
                          <p className="text-xs font-bold mt-0.5" style={{ color: "#607eaa" }}>{fmtE(l.precio)}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                          <button onClick={() => { setEditando(i); setEditForm({ nombre: l.nombre_partida, desc: l.descripcion ?? "", precio: String(l.precio) }); }}
                            className="p-1 rounded hover:bg-blue-100 hover:text-blue-600 transition-colors"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => setLineas((prev) => prev.filter((_, j) => j !== i))}
                            className="p-1 rounded hover:bg-red-100 hover:text-red-500 transition-colors"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Nueva línea */}
              {nuevaLinea ? (
                <div className="p-3 border-2 border-dashed border-gray-300 rounded-lg space-y-2">
                  <input className="input text-xs" value={nuevaLinea.nombre} autoFocus
                    onChange={(e) => setNuevaLinea({ ...nuevaLinea, nombre: e.target.value })}
                    placeholder="Descripción de la línea *"
                    onKeyDown={(e) => { if (e.key === "Enter") agregarLinea(); }} />
                  <textarea className="input text-xs w-full" rows={2} value={nuevaLinea.desc}
                    onChange={(e) => setNuevaLinea({ ...nuevaLinea, desc: e.target.value })}
                    placeholder="Detalle opcional..." />
                  <input className="input text-xs" type="number" value={nuevaLinea.precio}
                    onChange={(e) => setNuevaLinea({ ...nuevaLinea, precio: e.target.value })}
                    placeholder="Importe €" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setNuevaLinea(null)} className="btn-ghost text-xs py-1">Cancelar</button>
                    <button onClick={agregarLinea} className="btn-secondary text-xs py-1">Añadir</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setNuevaLinea({ nombre: "", desc: "", precio: "" })}
                  className="btn-ghost text-xs w-full border-dashed">
                  <Plus className="w-3 h-3" /> Añadir línea
                </button>
              )}

              {/* Resumen */}
              {lineas.length > 0 && (
                <div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-1 text-xs text-content-secondary">
                  <div className="flex justify-between"><span>Base</span><span className="font-semibold">{fmtE(importeBase)}</span></div>
                  <div className="flex justify-between"><span>IVA {iva}%</span><span className="font-semibold">{fmtE(importeIva)}</span></div>
                  <div className="flex justify-between font-bold text-content-primary text-sm border-t pt-1 mt-1"><span>Total</span><span>{fmtE(importeTotal)}</span></div>
                </div>
              )}
            </div>

            {/* Panel derecho — preview PDF (escalado solo para visualización) */}
            <div className="flex-1 overflow-auto bg-gray-100 p-4">
              <div style={{ transform: "scale(0.72)", transformOrigin: "top left", width: "139%", pointerEvents: "none" }}>
                <FacturaDirectaDocument {...docProps} idOverride="factura-directa-preview" />
              </div>
            </div>
          </div>
        )}

        {/* Documento oculto a tamaño real — solo para generar el PDF */}
        <div style={{ position: "fixed", left: "-9999px", top: 0, pointerEvents: "none", zIndex: -1 }}>
          <FacturaDirectaDocument {...docProps} />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex-shrink-0 flex gap-3">
          {paso === 2 && (
            <button onClick={() => setPaso(1)} className="btn-ghost"><ChevronLeft className="w-4 h-4" />Atrás</button>
          )}
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          {paso === 1 ? (
            <button onClick={() => {
              if (!clienteNombre.trim()) return alert("El nombre del cliente es obligatorio.");
              if (!concepto.trim()) return alert("El concepto es obligatorio.");
              const sumPct = formaPago.reduce((s, f) => s + f.porcentaje, 0);
              if (Math.abs(sumPct - 100) > 0.01) return alert(`Los porcentajes de forma de pago deben sumar 100% (ahora ${sumPct}%).`);
              setPaso(2);
            }} className="btn-primary flex-1">
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleGuardar} disabled={guardando || lineas.length === 0}
              className="btn-primary flex-1">
              {guardando || downloading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><Download className="w-4 h-4" /> Guardar y descargar PDF</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
