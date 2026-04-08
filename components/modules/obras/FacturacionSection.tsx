"use client";

import { useEffect, useState } from "react";
import {
  getFacturasByObra,
  getNextNumeroFactura,
  createFactura,
  updateFactura,
  updatePago,
  deleteFactura,
  getObraById,
} from "@/lib/insforge/database";
import type { FacturaConPagos, Pago, PagoEstado, Obra } from "@/types";
import {
  ChevronDown, ChevronUp, Plus, Trash2, Check, FileText,
  Euro, Clock, AlertCircle, Loader2, X, Eye, Pencil
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { InvoicePreview } from "@/components/modules/facturacion/InvoicePreview";

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy", { locale: es }); } catch { return d; }
}

const ESTADO_LABEL: Record<PagoEstado, string> = {
  pendiente_emitir: "Pendiente",
  emitida: "Emitida",
  cobrada: "Cobrada",
};
const ESTADO_COLOR: Record<PagoEstado, string> = {
  pendiente_emitir: "#f59e0b",
  emitida: "#607eaa",
  cobrada: "#10b981",
};
// Brand colors
const PRIMARY   = "#607eaa";
const PRIMARY_L = "#EEF2F8";
const PRIMARY_D = "#1c3879";

const PAGOS_DEFAULT = [
  { concepto: "Reserva", porcentaje: 40, fechaPrevista: null as string | null },
  { concepto: "Mitad obra", porcentaje: 50, fechaPrevista: null as string | null },
  { concepto: "Final", porcentaje: 10, fechaPrevista: null as string | null },
];

// ─── Modal Extra ──────────────────────────────────────────────────────────────
function ModalExtra({
  pago, onClose, onSave,
}: {
  pago: Pago;
  onClose: () => void;
  onSave: (extra: number, nota: string) => Promise<void>;
}) {
  const [extra, setExtra] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const val = parseFloat(extra.replace(",", "."));
    if (isNaN(val) || val <= 0) return;
    setSaving(true);
    await onSave(val, nota);
    setSaving(false);
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, border: "none", background: "#f3f4f6", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>Añadir extra</h3>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>Hito: {pago.concepto}</p>

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Importe extra (€)</label>
        <input
          type="number" value={extra} onChange={(e) => setExtra(e.target.value)}
          placeholder="0.00" min="0" step="0.01"
          style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 15, marginBottom: 12, boxSizing: "border-box" }}
        />

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Nota (opcional)</label>
        <textarea
          value={nota} onChange={(e) => setNota(e.target.value)}
          rows={2} placeholder="Descripción del extra..."
          style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 13, resize: "none", boxSizing: "border-box", marginBottom: 20 }}
        />

        <button
          onClick={handleSave} disabled={saving || !extra}
          style={{ width: "100%", background: saving ? "#9ca3af" : "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 600, fontSize: 15, cursor: saving ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {saving && <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />}
          Añadir extra
        </button>
      </div>
    </div>
  );
}

// ─── Fila de pago ─────────────────────────────────────────────────────────────
function FilaPago({
  pago, onUpdate, onEmitirPago,
}: {
  pago: Pago;
  onUpdate: () => void;
  onEmitirPago?: (pago: Pago) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [editFecha, setEditFecha] = useState(false);
  const [fecha, setFecha] = useState(pago.fecha_prevista ?? "");

  async function avanzarEstado() {
    setSaving(true);
    const next: PagoEstado = pago.estado === "pendiente_emitir" ? "emitida" : "cobrada";
    const extra: Partial<{ fecha_cobro: string; estado: PagoEstado }> = { estado: next };
    if (next === "cobrada") extra.fecha_cobro = new Date().toISOString().split("T")[0];
    await updatePago(pago.id, extra);
    setSaving(false);
    onUpdate();
    // Si pasamos a "emitida", abrimos el preview de ese hito
    if (next === "emitida" && onEmitirPago) {
      onEmitirPago({ ...pago, estado: "emitida" });
    }
  }

  async function saveFecha() {
    await updatePago(pago.id, { fecha_prevista: fecha || null });
    setEditFecha(false);
    onUpdate();
  }

  async function handleExtra(extra: number, nota: string) {
    const nuevo_extra = (pago.importe_extra ?? 0) + extra;
    const nota_actual = pago.nota ?? "";
    await updatePago(pago.id, {
      importe_extra: nuevo_extra,
      nota: nota_actual ? `${nota_actual}\n+ Extra: ${nota || fmt(extra) + " €"}` : `Extra: ${nota || fmt(extra) + " €"}`,
    });
    onUpdate();
  }

  const color = ESTADO_COLOR[pago.estado];
  const canAdvance = pago.estado !== "cobrada";

  return (
    <>
      <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
        {/* Orden + concepto */}
        <td style={{ padding: "10px 8px", fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#6b7280", flexShrink: 0 }}>
              {pago.orden}
            </span>
            <div>
              <div style={{ fontWeight: 600, color: "#111827" }}>{pago.concepto}</div>
              {pago.nota && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{pago.nota}</div>}
            </div>
          </div>
        </td>

        {/* % */}
        <td style={{ padding: "10px 8px", fontSize: 13, color: "#6b7280", textAlign: "center" }}>{pago.porcentaje}%</td>

        {/* Importe base */}
        <td style={{ padding: "10px 8px", fontSize: 13, textAlign: "right", color: "#374151" }}>{fmt(pago.importe_base)} €</td>

        {/* Extra */}
        <td style={{ padding: "10px 8px", fontSize: 13, textAlign: "right" }}>
          {pago.importe_extra > 0 ? (
            <span style={{ color: "#f59e0b", fontWeight: 600 }}>+{fmt(pago.importe_extra)} €</span>
          ) : (
            <span style={{ color: "#d1d5db" }}>—</span>
          )}
        </td>

        {/* Total */}
        <td style={{ padding: "10px 8px", fontSize: 14, fontWeight: 700, textAlign: "right", color: "#111827" }}>{fmt(pago.importe_total)} €</td>

        {/* Fecha prevista */}
        <td style={{ padding: "10px 8px", fontSize: 12, color: "#6b7280" }}>
          {editFecha ? (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "3px 6px", fontSize: 12 }} />
              <button onClick={saveFecha} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>Ok</button>
              <button onClick={() => setEditFecha(false)} style={{ background: "#f3f4f6", border: "none", borderRadius: 6, padding: "3px 6px", cursor: "pointer" }}><X style={{ width: 10, height: 10 }} /></button>
            </div>
          ) : (
            <span onClick={() => pago.estado !== "cobrada" && setEditFecha(true)}
              style={{ cursor: pago.estado !== "cobrada" ? "pointer" : "default", textDecoration: pago.estado !== "cobrada" ? "underline dotted" : "none" }}>
              {fmtDate(pago.fecha_prevista)}
            </span>
          )}
        </td>

        {/* Estado */}
        <td style={{ padding: "10px 8px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: color + "18", color }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            {ESTADO_LABEL[pago.estado]}
          </span>
        </td>

        {/* Acciones */}
        <td style={{ padding: "10px 8px", textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
            {canAdvance && (
              <button
                onClick={avanzarEstado} disabled={saving}
                style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
              >
                {saving ? <Loader2 style={{ width: 12, height: 12 }} /> : <Check style={{ width: 12, height: 12 }} />}
                {pago.estado === "pendiente_emitir" ? "Emitir" : "Cobrar"}
              </button>
            )}
            {pago.estado !== "cobrada" && pago.orden > 1 && (
              <button
                onClick={() => setShowExtra(true)}
                style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
              >
                + Extra
              </button>
            )}
          </div>
        </td>
      </tr>

      {showExtra && (
        <ModalExtra pago={pago} onClose={() => setShowExtra(false)} onSave={handleExtra} />
      )}
    </>
  );
}

// ─── Card de factura ──────────────────────────────────────────────────────────
function FacturaCard({
  factura, obra, tenantId, onUpdate, onDelete,
}: {
  factura: FacturaConPagos;
  obra: Obra | null;
  tenantId: string;
  onUpdate: () => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded]         = useState(false);
  const [deleting, setDeleting]         = useState(false);
  // previewPago: null = cerrado, "all" = todos los hitos, Pago = hito específico
  const [previewPago, setPreviewPago]   = useState<Pago | "all" | null>(null);
  const [editNumero, setEditNumero]     = useState(false);
  const [numeroEdit, setNumeroEdit]     = useState(factura.numero_factura ?? "" as string);
  const [savingNum, setSavingNum]       = useState(false);

  function onEmitirPago(pago: Pago) {
    setPreviewPago(pago);
  }

  const cobrado    = factura.pagos.filter((p) => p.estado === "cobrada").reduce((s, p) => s + p.importe_total, 0);
  const total      = factura.pagos.reduce((s, p) => s + p.importe_total, 0);
  const progreso   = total > 0 ? Math.round((cobrado / total) * 100) : 0;
  const allCobrado = factura.pagos.every((p) => p.estado === "cobrada");

  async function handleDelete() {
    if (!confirm(`¿Eliminar la factura "${factura.concepto}"? Se borrarán también sus pagos.`)) return;
    setDeleting(true);
    await deleteFactura(factura.id);
    onDelete(factura.id);
  }

  async function saveNumero() {
    setSavingNum(true);
    await updateFactura(factura.id, { numero_factura: numeroEdit.trim() || undefined });
    setSavingNum(false);
    setEditNumero(false);
    onUpdate();
  }

  return (
    <>
    <div style={{ border: `1.5px solid ${expanded ? PRIMARY + "30" : "#f3f4f6"}`, borderRadius: 14, overflow: "hidden", marginBottom: 12, transition: "border-color 0.2s" }}>
      {/* Cabecera */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer", background: expanded ? PRIMARY_L : "#fff" }}
      >
        <div style={{ width: 38, height: 38, borderRadius: 10, background: allCobrado ? "#dcfce7" : PRIMARY_L, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FileText style={{ width: 18, height: 18, color: allCobrado ? "#16a34a" : PRIMARY }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E" }}>{factura.concepto}</span>
            {editNumero ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={numeroEdit}
                  onChange={(e) => setNumeroEdit(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveNumero(); if (e.key === "Escape") setEditNumero(false); }}
                  placeholder="FAC-001"
                  style={{ border: `1.5px solid ${PRIMARY}`, borderRadius: 6, padding: "1px 7px", fontSize: 12, width: 90, fontWeight: 600, color: PRIMARY, outline: "none" }}
                />
                <button onClick={saveNumero} disabled={savingNum} style={{ background: PRIMARY, color: "#fff", border: "none", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                  {savingNum ? "..." : "Ok"}
                </button>
                <button onClick={() => setEditNumero(false)} style={{ background: "#f3f4f6", border: "none", borderRadius: 6, padding: "2px 6px", cursor: "pointer" }}><X style={{ width: 10, height: 10 }} /></button>
              </div>
            ) : (
              <span
                onClick={(e) => { e.stopPropagation(); setEditNumero(true); }}
                title="Editar número de factura"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: PRIMARY, background: PRIMARY_L, border: `1px solid ${PRIMARY}30`, borderRadius: 6, padding: "1px 6px", fontWeight: 600, cursor: "pointer" }}
              >
                {factura.numero_factura ?? <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Sin número</span>}
                <Pencil style={{ width: 9, height: 9, opacity: 0.6 }} />
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <div style={{ flex: 1, height: 4, background: "#e8e8ec", borderRadius: 9 }}>
              <div style={{ height: "100%", width: `${progreso}%`, background: allCobrado ? "#10b981" : PRIMARY, borderRadius: 9, transition: "width 0.4s" }} />
            </div>
            <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{fmt(cobrado)} / {fmt(total)} €</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1A1A2E" }}>{fmt(total)} €</div>
          {factura.fecha_emision && (
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{fmtDate(factura.fecha_emision)}</div>
          )}
        </div>
        {/* Botón preview */}
        <button
          onClick={(e) => { e.stopPropagation(); setPreviewPago("all"); }}
          title="Ver factura completa"
          style={{ background: PRIMARY_L, border: `1px solid ${PRIMARY}30`, borderRadius: 8, padding: "5px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: PRIMARY, fontSize: 11, fontWeight: 600, flexShrink: 0 }}
        >
          <Eye style={{ width: 13, height: 13 }} />
          <span className="hidden sm:inline">Ver</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} disabled={deleting}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", padding: 4 }}>
          <Trash2 style={{ width: 14, height: 14 }} />
        </button>
        {expanded ? <ChevronUp style={{ width: 16, height: 16, color: "#9ca3af", flexShrink: 0 }} /> : <ChevronDown style={{ width: 16, height: 16, color: "#9ca3af", flexShrink: 0 }} />}
      </div>

      {/* Tabla de pagos */}
      {expanded && (
        <div style={{ borderTop: "1px solid #f3f4f6", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#fafafa" }}>
                <th style={{ padding: "8px 8px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", whiteSpace: "nowrap" }}>Hito</th>
                <th style={{ padding: "8px 8px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>%</th>
                <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#9ca3af", whiteSpace: "nowrap" }}>Base</th>
                <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>Extra</th>
                <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>Total</th>
                <th style={{ padding: "8px 8px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", whiteSpace: "nowrap" }}>Fecha prev.</th>
                <th style={{ padding: "8px 8px", fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>Estado</th>
                <th style={{ padding: "8px 8px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textAlign: "right" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {factura.pagos.map((p) => (
                <FilaPago key={p.id} pago={p} onUpdate={onUpdate} onEmitirPago={onEmitirPago} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* Preview modal — hito específico o factura completa */}
    {previewPago !== null && (
      <InvoicePreview
        factura={factura}
        obra={obra}
        tenantId={tenantId}
        pago={previewPago === "all" ? undefined : previewPago}
        onClose={() => setPreviewPago(null)}
      />
    )}
    </>
  );
}

// ─── Formulario nueva factura ─────────────────────────────────────────────────
function NuevaFacturaForm({
  tenantId, obraId, onCreated, onCancel,
}: {
  tenantId: string; obraId: string;
  onCreated: () => void; onCancel: () => void;
}) {
  const [concepto, setConcepto] = useState("");
  const [importe, setImporte] = useState("");
  const [iva, setIva] = useState<10 | 21>(21);
  const [numero, setNumero] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pagos, setPagos] = useState(PAGOS_DEFAULT.map((p) => ({ ...p })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNextNumeroFactura(tenantId).then(setNumero);
  }, [tenantId]);

  function setP<K extends keyof (typeof pagos)[0]>(i: number, k: K, v: (typeof pagos)[0][K]) {
    setPagos((prev) => prev.map((p, idx) => (idx === i ? { ...p, [k]: v } : p)));
  }

  const sumPct = pagos.reduce((s, p) => s + (parseFloat(String(p.porcentaje)) || 0), 0);
  const importeNum = parseFloat(importe.replace(",", ".")) || 0;
  const ivaImporte = Math.round(importeNum * iva / 100 * 100) / 100;
  const totalConIva = importeNum + ivaImporte;

  async function handleCreate() {
    setError(null);
    if (!concepto.trim()) { setError("Introduce un concepto"); return; }
    if (!importeNum || importeNum <= 0) { setError("Introduce un importe válido"); return; }
    if (Math.abs(sumPct - 100) > 0.01) { setError(`La suma de porcentajes debe ser 100% (ahora: ${sumPct}%)`); return; }

    setSaving(true);
    const { error: err } = await createFactura({
      tenantId, obraId, concepto, importeTotal: importeNum,
      porcentajeIva: iva,
      numeroFactura: numero, fechaEmision: fechaEmision || null, notas: descripcion || null,
      pagos: pagos.map((p) => ({
        concepto: p.concepto, porcentaje: parseFloat(String(p.porcentaje)), fechaPrevista: p.fechaPrevista,
      })),
    });
    setSaving(false);
    if (err) { setError(err); return; }
    onCreated();
  }

  return (
    <div style={{ background: "#fafafa", border: "1.5px solid #e5e7eb", borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Nueva factura</h4>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X style={{ width: 18, height: 18 }} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Título / concepto *</label>
          <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Reforma integral baño principal…"
            style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Base imponible (€) *</label>
          <input value={importe} onChange={(e) => setImporte(e.target.value)} type="number" placeholder="0.00" min="0" step="0.01"
            style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>IVA aplicable</label>
          <div style={{ display: "flex", gap: 6 }}>
            {([10, 21] as const).map((pct) => (
              <button key={pct} type="button" onClick={() => setIva(pct)}
                style={{ flex: 1, border: `2px solid ${iva === pct ? PRIMARY : "#e5e7eb"}`, borderRadius: 8, padding: "8px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", background: iva === pct ? PRIMARY_L : "#fff", color: iva === pct ? PRIMARY_D : "#6b7280", transition: "all 0.15s" }}>
                {pct}%
              </button>
            ))}
          </div>
          {importeNum > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", display: "flex", gap: 8 }}>
              <span>IVA: <strong style={{ color: PRIMARY }}>{fmt(ivaImporte)} €</strong></span>
              <span>·</span>
              <span>Total: <strong style={{ color: "#1A1A2E" }}>{fmt(totalConIva)} €</strong></span>
            </div>
          )}
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Nº Factura base</label>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="FAC-001"
            style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }} />
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>Cada hito: {numero || "FAC-001"}/1, /2, /3</div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Fecha emisión</label>
          <input value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} type="date"
            style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Descripción completa del presupuesto</label>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={5}
            placeholder={"Detalla aquí todo el alcance de la obra:\n– Demolición y preparación de paredes\n– Instalación de alicatado y solado\n– Fontanería: sustitución de tuberías y sanitarios\n– Pintura final con dos manos de acabado\n…"}
            style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 13, resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>Aparecerá en el cuerpo de cada factura</div>
        </div>
      </div>

      {/* Hitos */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Hitos de cobro</span>
          <span style={{ fontSize: 12, color: Math.abs(sumPct - 100) > 0.01 ? "#ef4444" : "#10b981", fontWeight: 600 }}>
            Suma: {sumPct}%
          </span>
        </div>
        {pagos.map((p, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr", gap: 8, marginBottom: 8, alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>Concepto</label>
              <input value={p.concepto} onChange={(e) => setP(i, "concepto", e.target.value)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 10px", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>%</label>
              <input type="number" value={p.porcentaje} onChange={(e) => setP(i, "porcentaje", parseFloat(e.target.value) as any)} min="0" max="100"
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 10px", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>
                Fecha prevista{importeNum > 0 ? ` · ${fmt((importeNum * (parseFloat(String(p.porcentaje)) || 0)) / 100)} €` : ""}
              </label>
              <input type="date" value={p.fechaPrevista ?? ""} onChange={(e) => setP(i, "fechaPrevista", e.target.value || null)}
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 10px", fontSize: 13, boxSizing: "border-box" }} />
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
          <AlertCircle style={{ width: 14, height: 14, color: "#ef4444", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#ef4444" }}>{error}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleCreate} disabled={saving}
          style={{ flex: 1, background: saving ? "#94a3b8" : PRIMARY, color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: saving ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {saving && <Loader2 style={{ width: 16, height: 16 }} />}
          Crear factura
        </button>
        <button onClick={onCancel} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 10, padding: "11px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function FacturacionSection({
  obraId, tenantId,
}: {
  obraId: string; tenantId: string;
}) {
  const [facturas, setFacturas] = useState<FacturaConPagos[]>([]);
  const [obra, setObra]         = useState<Obra | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    const [data, obraRes] = await Promise.all([
      getFacturasByObra(obraId),
      getObraById(obraId),
    ]);
    setFacturas(data);
    setObra((obraRes.data as Obra | null) ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [obraId]);

  const allPagos       = facturas.flatMap((f) => f.pagos);
  const totalFacturado = allPagos.reduce((s, p) => s + p.importe_total, 0);
  const totalCobrado   = allPagos.filter((p) => p.estado === "cobrada").reduce((s, p) => s + p.importe_total, 0);
  const pendiente      = totalFacturado - totalCobrado;

  return (
    <div style={{ marginTop: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1A1A2E" }}>Facturación</h3>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#94A3B8" }}>Facturas y cobros de esta obra</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: PRIMARY, color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Plus style={{ width: 16, height: 16 }} />
            Nueva factura
          </button>
        )}
      </div>

      {/* KPI chips */}
      {totalFacturado > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: PRIMARY_L, borderRadius: 10, padding: "8px 14px" }}>
            <Euro style={{ width: 14, height: 14, color: PRIMARY }} />
            <div>
              <div style={{ fontSize: 11, color: PRIMARY, fontWeight: 600, opacity: 0.7 }}>FACTURADO</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: PRIMARY_D }}>{fmt(totalFacturado)} €</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f0fdf4", borderRadius: 10, padding: "8px 14px" }}>
            <Check style={{ width: 14, height: 14, color: "#16a34a" }} />
            <div>
              <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, opacity: 0.7 }}>COBRADO</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#15803d" }}>{fmt(totalCobrado)} €</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fffbeb", borderRadius: 10, padding: "8px 14px" }}>
            <Clock style={{ width: 14, height: 14, color: "#d97706" }} />
            <div>
              <div style={{ fontSize: 11, color: "#d97706", fontWeight: 600, opacity: 0.7 }}>PENDIENTE</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#b45309" }}>{fmt(pendiente)} €</div>
            </div>
          </div>
        </div>
      )}

      {/* Form nueva factura */}
      {showForm && (
        <NuevaFacturaForm tenantId={tenantId} obraId={obraId}
          onCreated={() => { setShowForm(false); load(); }}
          onCancel={() => setShowForm(false)} />
      )}

      {/* Lista facturas */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <Loader2 style={{ width: 24, height: 24, color: PRIMARY, animation: "spin 1s linear infinite" }} />
        </div>
      ) : facturas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px", color: "#94A3B8" }}>
          <FileText style={{ width: 32, height: 32, margin: "0 auto 8px", opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: 14 }}>Sin facturas. Crea la primera pulsando "+ Nueva factura".</p>
        </div>
      ) : (
        facturas.map((f) => (
          <FacturaCard key={f.id} factura={f} obra={obra} tenantId={tenantId} onUpdate={load}
            onDelete={(id) => setFacturas((prev) => prev.filter((x) => x.id !== id))} />
        ))
      )}
    </div>
  );
}
