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

// ─── Modal Emitir (con edición de número de factura) ─────────────────────────
function ModalEmitir({
  pago, numeroSugerido, onClose, onConfirm,
}: {
  pago: Pago;
  numeroSugerido: string;
  onClose: () => void;
  onConfirm: (numeroFactura: string) => Promise<void>;
}) {
  const [numero, setNumero] = useState(numeroSugerido);
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!numero.trim()) return;
    setSaving(true);
    await onConfirm(numero.trim());
    setSaving(false);
    // onClose lo llama el padre tras confirmar
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: 18, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, border: "none", background: "#f3f4f6", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X style={{ width: 14, height: 14 }} />
        </button>

        {/* Icono + título */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FileText style={{ width: 20, height: 20, color: "#16a34a" }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>Emitir factura</h3>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>Hito: {pago.concepto} · {pago.porcentaje}%</p>
          </div>
        </div>

        {/* Campo número */}
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          Número de factura
        </label>
        <input
          autoFocus
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); if (e.key === "Escape") onClose(); }}
          placeholder="FAC-001"
          style={{ width: "100%", border: `1.5px solid ${PRIMARY}`, borderRadius: 9, padding: "10px 14px", fontSize: 16, fontWeight: 700, color: PRIMARY, letterSpacing: "0.04em", marginBottom: 8, boxSizing: "border-box", outline: "none" }}
        />
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "#9ca3af" }}>
          Puedes cambiarlo si necesitas un número específico. Se guardará en la factura definitiva.
        </p>

        {/* Botones */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose}
            style={{ flex: 1, background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={saving || !numero.trim()}
            style={{ flex: 2, background: saving || !numero.trim() ? "#9ca3af" : "#16a34a", color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: saving || !numero.trim() ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> : <Check style={{ width: 15, height: 15 }} />}
            Confirmar y emitir
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal cobro en efectivo / factura ───────────────────────────────────────
// Llamado anteriormente "Modal A/B Split". Permite repartir un hito entre
// "con factura (IVA)" y "en efectivo (sin IVA)".
function ModalEfectivo({
  pago, onClose, onSave,
}: {
  pago: Pago;
  onClose: () => void;
  onSave: (a: number, b: number, ivaPercent: number) => Promise<void>;
}) {
  const total = pago.importe_total;
  const currentA = pago.importe_facturado_a ?? total;
  const currentB = pago.importe_efectivo_b ?? 0;
  const currentIva = pago.porcentaje_iva_a ?? 21;

  // Modo rápido: todo en efectivo / todo con factura
  const [modoRapido, setModoRapido] = useState<"factura" | "efectivo" | "mixto">(
    currentB >= total - 0.01 ? "efectivo" : currentB <= 0.01 ? "factura" : "mixto"
  );

  const [a, setA] = useState(fmt(currentA));
  const [b, setB] = useState(fmt(currentB));
  const [iva, setIva] = useState(String(currentIva));
  const [saving, setSaving] = useState(false);

  function aplicarModo(modo: "factura" | "efectivo" | "mixto") {
    setModoRapido(modo);
    if (modo === "factura")   { setA(fmt(total)); setB("0,00"); }
    if (modo === "efectivo")  { setA("0,00"); setB(fmt(total)); }
    // "mixto": no toca los valores, el admin los edita manualmente
  }

  async function handleSave() {
    const aVal = parseFloat(a.replace(",", "."));
    const bVal = parseFloat(b.replace(",", "."));
    const ivaVal = parseInt(iva, 10);
    if (isNaN(aVal) || isNaN(bVal) || isNaN(ivaVal)) return;
    if (Math.abs(aVal + bVal - total) > 0.01) return;
    setSaving(true);
    await onSave(aVal, bVal, ivaVal);
    setSaving(false);
    onClose();
  }

  const aNum = parseFloat(a.replace(",", ".")) || 0;
  const bNum = parseFloat(b.replace(",", ".")) || 0;
  const sumAB = aNum + bNum;
  const isValid = Math.abs(sumAB - total) < 0.01;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: 18, padding: 24, width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, border: "none", background: "#f3f4f6", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X style={{ width: 14, height: 14 }} />
        </button>

        {/* Cabecera */}
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#111827" }}>Forma de cobro</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
          {pago.concepto} · <strong style={{ color: "#111827" }}>{fmt(total)} €</strong>
        </p>

        {/* Selector rápido — 3 opciones */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          {([
            { id: "factura",  label: "Con factura",   emoji: "🧾", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
            { id: "efectivo", label: "En efectivo",   emoji: "💵", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
            { id: "mixto",    label: "Mixto",          emoji: "✂️", color: "#9333ea", bg: "#faf5ff", border: "#e9d5ff" },
          ] as const).map(({ id, label, emoji, color, bg, border }) => (
            <button key={id} type="button" onClick={() => aplicarModo(id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: "10px 6px", borderRadius: 10, cursor: "pointer",
                border: `2px solid ${modoRapido === id ? border : "#e5e7eb"}`,
                background: modoRapido === id ? bg : "#fafafa",
                transition: "all 0.12s ease",
              }}
            >
              <span style={{ fontSize: 20 }}>{emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: modoRapido === id ? color : "#6b7280", textAlign: "center", lineHeight: 1.2 }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Campos de importe (siempre visibles, el selector rápido los rellena) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#2563eb", marginBottom: 4 }}>
              🧾 Con factura (€)
            </label>
            <input
              type="number" value={a}
              onChange={(e) => { setA(e.target.value); setModoRapido("mixto"); }}
              placeholder="0.00" min="0" step="0.01"
              style={{ width: "100%", border: "1.5px solid #bfdbfe", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontWeight: 600, boxSizing: "border-box", color: "#1d4ed8" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#16a34a", marginBottom: 4 }}>
              💵 En efectivo (€)
            </label>
            <input
              type="number" value={b}
              onChange={(e) => { setB(e.target.value); setModoRapido("mixto"); }}
              placeholder="0.00" min="0" step="0.01"
              style={{ width: "100%", border: "1.5px solid #bbf7d0", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontWeight: 600, boxSizing: "border-box", color: "#15803d" }}
            />
          </div>
        </div>

        {/* IVA (solo si hay factura) */}
        {aNum > 0.01 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 4 }}>IVA de la factura</label>
            <select value={iva} onChange={(e) => setIva(e.target.value)}
              style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 13, boxSizing: "border-box" }}>
              <option value="10">10%</option>
              <option value="21">21%</option>
            </select>
          </div>
        )}

        {/* Validación */}
        {!isValid && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: "#991b1b" }}>
            La suma debe ser {fmt(total)} € (ahora: {fmt(sumAB)} €)
          </div>
        )}

        {/* Resumen cuando hay mezcla */}
        {aNum > 0.01 && bNum > 0.01 && (
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12, color: "#374151" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>🧾 Factura base + IVA {iva}%:</span>
              <strong>{fmt(aNum * (1 + parseInt(iva) / 100))} €</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>💵 Efectivo sin factura:</span>
              <strong>{fmt(bNum)} €</strong>
            </div>
          </div>
        )}

        {/* Botones */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose}
            style={{ flex: 1, background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !isValid}
            style={{ flex: 2, background: isValid && !saving ? "#111827" : "#9ca3af", color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: isValid && !saving ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? <Loader2 style={{ width: 15, height: 15 }} /> : <Check style={{ width: 15, height: 15 }} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila de pago ─────────────────────────────────────────────────────────────
function FilaPago({
  pago, tenantId, isMobile, onUpdate, onEmitirPago, onVerFactura,
}: {
  pago: Pago;
  tenantId: string;
  isMobile: boolean;
  onUpdate: () => void;
  onEmitirPago?: (pago: Pago) => void;
  onVerFactura?: (pago: Pago) => void;
}) {
  const [saving, setSaving]           = useState(false);
  const [showExtra, setShowExtra]     = useState(false);
  const [editFecha, setEditFecha]     = useState(false);
  const [fecha, setFecha]             = useState(pago.fecha_prevista ?? "");
  const [showEmitir, setShowEmitir]   = useState(false);
  const [numSugerido, setNumSugerido] = useState("");
  const [showEfectivo, setShowEfectivo] = useState(false);

  async function iniciarEmision() {
    if (pago.estado !== "pendiente_emitir") {
      // Cobrar: directo, sin modal
      setSaving(true);
      await updatePago(pago.id, { estado: "cobrada", fecha_cobro: new Date().toISOString().split("T")[0] });
      setSaving(false);
      onUpdate();
      return;
    }
    // Emitir: primero obtenemos el número sugerido y abrimos el modal
    setSaving(true);
    const num = await getNextNumeroFactura(tenantId);
    setNumSugerido(num);
    setSaving(false);
    setShowEmitir(true);
  }

  async function confirmarEmision(numeroFactura: string) {
    await updatePago(pago.id, {
      estado: "emitida",
      numero_factura_emitida: numeroFactura,
    } as any);
    setShowEmitir(false);
    onUpdate();
    if (onEmitirPago) {
      onEmitirPago({ ...pago, estado: "emitida", numero_factura_emitida: numeroFactura });
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

  async function handleABSplit(a: number, b: number, ivaPercent: number) {
    await updatePago(pago.id, {
      importe_facturado_a: a,
      importe_efectivo_b: b,
      porcentaje_iva_a: ivaPercent,
    });
    onUpdate();
  }

  const color      = ESTADO_COLOR[pago.estado];
  const canAdvance = pago.estado !== "cobrada";

  // ── Botones de acción (compartidos entre móvil y desktop) ──────────────────
  const accionesNode = (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
      {pago.numero_factura_emitida && (
        <button onClick={() => onVerFactura?.(pago)} title={`Ver factura ${pago.numero_factura_emitida}`}
          style={{ background: PRIMARY_L, color: PRIMARY, border: `1px solid ${PRIMARY}30`, borderRadius: 7, padding: "5px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <Eye style={{ width: 12, height: 12 }} />
          <span>{pago.numero_factura_emitida}</span>
        </button>
      )}
      {canAdvance && (
        <button onClick={iniciarEmision} disabled={saving}
          style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: saving ? "default" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          {saving ? <Loader2 style={{ width: 12, height: 12 }} /> : <Check style={{ width: 12, height: 12 }} />}
          {pago.estado === "pendiente_emitir" ? "Emitir" : "Cobrar"}
        </button>
      )}
      {pago.estado !== "cobrada" && (
        <>
          {pago.orden > 1 && (
            <button onClick={() => setShowExtra(true)}
              style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              + Extra
            </button>
          )}
          <button onClick={() => setShowEfectivo(true)}
            style={{
              background: (pago.importe_efectivo_b ?? 0) > 0.01 ? "#f0fdf4" : "#f3f4f6",
              color:      (pago.importe_efectivo_b ?? 0) > 0.01 ? "#15803d" : "#374151",
              border:     `1px solid ${(pago.importe_efectivo_b ?? 0) > 0.01 ? "#bbf7d0" : "#e5e7eb"}`,
              borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>
            {(pago.importe_efectivo_b ?? 0) > 0.01
              ? `💵 Efectivo: ${fmt(pago.importe_efectivo_b!)} €`
              : "💵 En efectivo"}
          </button>
        </>
      )}
    </div>
  );

  // ── Modo móvil: tarjeta premium ───────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <div style={{
          borderRadius: 16,
          marginBottom: 10,
          background: "#fff",
          overflow: "hidden",
          boxShadow: `0 1px 4px rgba(0,0,0,0.06), 0 0 0 1.5px ${color}22`,
        }}>
          {/* Franja de color de estado arriba */}
          <div style={{ height: 3, background: color, borderRadius: "0" }} />

          <div style={{ padding: "14px 16px" }}>
            {/* Fila superior: número burbuja + concepto + badge estado */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  width: 30, height: 30, borderRadius: "50%",
                  background: color + "15",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800, color, flexShrink: 0,
                }}>
                  {pago.orden}
                </span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>{pago.concepto}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{pago.porcentaje}% del presupuesto</div>
                </div>
              </div>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 700,
                padding: "4px 10px", borderRadius: 20,
                background: color + "15", color,
                flexShrink: 0, letterSpacing: "0.01em",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                {ESTADO_LABEL[pago.estado]}
              </span>
            </div>

            {/* Importes — pill destacado */}
            <div style={{
              display: "flex", gap: 0,
              marginBottom: 12,
              background: "#f8fafc",
              borderRadius: 12,
              overflow: "hidden",
              border: "1px solid #f0f0f5",
            }}>
              <div style={{ flex: 1, padding: "10px 12px", borderRight: "1px solid #f0f0f5" }}>
                <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Base</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>{fmt(pago.importe_base)} €</div>
              </div>
              {pago.importe_extra > 0 && (
                <div style={{ flex: 1, padding: "10px 12px", borderRight: "1px solid #f0f0f5", background: "#fffbeb" }}>
                  <div style={{ fontSize: 10, color: "#d97706", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Extra</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#b45309" }}>+{fmt(pago.importe_extra)} €</div>
                </div>
              )}
              <div style={{ flex: 1, padding: "10px 12px", background: color + "08" }}>
                <div style={{ fontSize: 10, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3, opacity: 0.7 }}>Total</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>{fmt(pago.importe_total)} €</div>
              </div>
            </div>

            {/* Fecha prevista */}
            {(pago.fecha_prevista || pago.estado !== "cobrada") && (
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <Clock style={{ width: 13, height: 13, color: "#94a3b8", flexShrink: 0 }} />
                {editFecha ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1 }}>
                    <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                      style={{ flex: 1, border: `1.5px solid ${PRIMARY}`, borderRadius: 8, padding: "5px 8px", fontSize: 13, outline: "none" }} />
                    <button onClick={saveFecha} style={{ background: PRIMARY, color: "#fff", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Ok</button>
                    <button onClick={() => setEditFecha(false)} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}><X style={{ width: 12, height: 12 }} /></button>
                  </div>
                ) : (
                  <span
                    onClick={() => pago.estado !== "cobrada" && setEditFecha(true)}
                    style={{
                      fontSize: 13, color: "#374151", fontWeight: 500,
                      cursor: pago.estado !== "cobrada" ? "pointer" : "default",
                      borderBottom: pago.estado !== "cobrada" ? "1px dashed #d1d5db" : "none",
                    }}
                  >
                    {pago.fecha_prevista ? fmtDate(pago.fecha_prevista) : <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sin fecha — toca para añadir</span>}
                  </span>
                )}
              </div>
            )}

            {/* Acciones */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {pago.numero_factura_emitida && (
                <button onClick={() => onVerFactura?.(pago)} title={`Ver factura ${pago.numero_factura_emitida}`}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: PRIMARY_L, color: PRIMARY, border: `1px solid ${PRIMARY}30`, borderRadius: 9, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", flex: 1, justifyContent: "center" }}>
                  <Eye style={{ width: 14, height: 14 }} />
                  {pago.numero_factura_emitida}
                </button>
              )}
              {canAdvance && (
                <button onClick={iniciarEmision} disabled={saving}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", flex: 1, justifyContent: "center" }}>
                  {saving ? <Loader2 style={{ width: 14, height: 14 }} /> : <Check style={{ width: 14, height: 14 }} />}
                  {pago.estado === "pendiente_emitir" ? "Emitir" : "Cobrar"}
                </button>
              )}
              {pago.estado !== "cobrada" && pago.orden > 1 && (
                <button onClick={() => setShowExtra(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  + Extra
                </button>
              )}
            </div>

            {pago.nota && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8", background: "#f9fafb", borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 }}>
                {pago.nota}
              </div>
            )}
          </div>
        </div>
        {showExtra && <ModalExtra pago={pago} onClose={() => setShowExtra(false)} onSave={handleExtra} />}
        {showEmitir && (
          <ModalEmitir pago={pago} numeroSugerido={numSugerido}
            onClose={() => setShowEmitir(false)} onConfirm={confirmarEmision} />
        )}
        {showEfectivo && (
          <ModalEfectivo pago={pago}
            onClose={() => setShowEfectivo(false)} onSave={handleABSplit} />
        )}
      </>
    );
  }

  // ── Modo desktop: fila de tabla ────────────────────────────────────────────
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
        <td style={{ padding: "10px 8px", fontSize: 13, color: "#6b7280", textAlign: "center" }}>{pago.porcentaje}%</td>
        <td style={{ padding: "10px 8px", fontSize: 13, textAlign: "right", color: "#374151" }}>{fmt(pago.importe_base)} €</td>
        <td style={{ padding: "10px 8px", fontSize: 13, textAlign: "right" }}>
          {pago.importe_extra > 0
            ? <span style={{ color: "#f59e0b", fontWeight: 600 }}>+{fmt(pago.importe_extra)} €</span>
            : <span style={{ color: "#d1d5db" }}>—</span>}
        </td>
        <td style={{ padding: "10px 8px", fontSize: 14, fontWeight: 700, textAlign: "right", color: "#111827" }}>{fmt(pago.importe_total)} €</td>
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
        <td style={{ padding: "10px 8px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: color + "18", color }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            {ESTADO_LABEL[pago.estado]}
          </span>
        </td>
        <td style={{ padding: "10px 8px", textAlign: "right" }}>
          {accionesNode}
        </td>
      </tr>
      {showExtra && <ModalExtra pago={pago} onClose={() => setShowExtra(false)} onSave={handleExtra} />}
      {showEmitir && (
        <ModalEmitir pago={pago} numeroSugerido={numSugerido}
          onClose={() => setShowEmitir(false)} onConfirm={confirmarEmision} />
      )}
      {showEfectivo && (
        <ModalEfectivo pago={pago}
          onClose={() => setShowEfectivo(false)} onSave={handleABSplit} />
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
  const [previewPago, setPreviewPago]   = useState<Pago | null>(null);
  const [editNumero, setEditNumero]     = useState(false);
  const [numeroEdit, setNumeroEdit]     = useState(factura.numero_factura ?? "" as string);
  const [savingNum, setSavingNum]       = useState(false);
  const [editConcepto, setEditConcepto] = useState(false);
  const [conceptoEdit, setConceptoEdit] = useState(factura.concepto);
  const [savingConc, setSavingConc]     = useState(false);
  const [editImporte, setEditImporte]   = useState(false);
  const [importeEdit, setImporteEdit]   = useState(String(factura.importe_total));
  const [savingImp, setSavingImp]       = useState(false);
  const [isMobile, setIsMobile]         = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function onEmitirPago(pago: Pago) { setPreviewPago(pago); }
  function onVerFactura(pago: Pago) { setPreviewPago(pago); }

  const cobrado    = factura.pagos.filter((p) => p.estado === "cobrada").reduce((s, p) => s + p.importe_total, 0);
  const total      = factura.pagos.reduce((s, p) => s + p.importe_total, 0);
  const progreso   = total > 0 ? Math.round((cobrado / total) * 100) : 0;
  const allCobrado = factura.pagos.every((p) => p.estado === "cobrada");

  async function handleDelete() {
    if (!confirm(`¿Eliminar el presupuesto "${factura.concepto}"? Se borrarán también sus hitos de pago.`)) return;
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

  async function saveConcepto() {
    if (!conceptoEdit.trim()) return;
    setSavingConc(true);
    await updateFactura(factura.id, { concepto: conceptoEdit.trim() });
    setSavingConc(false);
    setEditConcepto(false);
    onUpdate();
  }

  async function saveImporte() {
    const num = parseFloat(importeEdit.replace(",", "."));
    if (isNaN(num) || num <= 0) { setEditImporte(false); return; }
    setSavingImp(true);
    // Recalcular importe_base de cada pago manteniendo los porcentajes actuales
    await updateFactura(factura.id, { importe_total: num });
    for (const p of factura.pagos) {
      const nuevaBase = Math.round(num * p.porcentaje / 100 * 100) / 100;
      await updatePago(p.id, { importe_base: nuevaBase });
    }
    setSavingImp(false);
    setEditImporte(false);
    onUpdate();
  }

  return (
    <>
    <div style={{
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 14,
      boxShadow: expanded
        ? `0 4px 20px rgba(96,126,170,0.12), 0 0 0 2px ${PRIMARY}30`
        : "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1.5px #f0f0f5",
      transition: "box-shadow 0.2s",
    }}>
      {/* Cabecera */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", cursor: "pointer", background: expanded ? PRIMARY_L : "#fff" }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: allCobrado ? "#dcfce7" : PRIMARY_L,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          boxShadow: allCobrado ? "0 2px 8px rgba(16,185,129,0.2)" : `0 2px 8px ${PRIMARY}20`,
        }}>
          <FileText style={{ width: 18, height: 18, color: allCobrado ? "#16a34a" : PRIMARY }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Concepto editable */}
            {editConcepto ? (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                <input
                  autoFocus
                  value={conceptoEdit}
                  onChange={(e) => setConceptoEdit(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveConcepto(); if (e.key === "Escape") { setConceptoEdit(factura.concepto); setEditConcepto(false); } }}
                  style={{ border: `1.5px solid ${PRIMARY}`, borderRadius: 6, padding: "2px 8px", fontSize: 14, fontWeight: 700, color: "#1A1A2E", outline: "none", minWidth: 160 }}
                />
                <button onClick={saveConcepto} disabled={savingConc} style={{ background: PRIMARY, color: "#fff", border: "none", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                  {savingConc ? "..." : "Ok"}
                </button>
                <button onClick={() => { setConceptoEdit(factura.concepto); setEditConcepto(false); }} style={{ background: "#f3f4f6", border: "none", borderRadius: 6, padding: "2px 6px", cursor: "pointer" }}><X style={{ width: 10, height: 10 }} /></button>
              </div>
            ) : (
              <span
                onClick={(e) => { e.stopPropagation(); setEditConcepto(true); }}
                title="Editar nombre del presupuesto"
                style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E", cursor: "pointer", borderBottom: "1px dashed transparent" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "#d1d5db")}
                onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
              >
                {factura.concepto}
              </span>
            )}
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
        <div style={{ textAlign: "right", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {editImporte ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
              <input
                autoFocus
                type="number"
                value={importeEdit}
                onChange={(e) => setImporteEdit(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveImporte(); if (e.key === "Escape") { setImporteEdit(String(factura.importe_total)); setEditImporte(false); } }}
                style={{ border: `1.5px solid ${PRIMARY}`, borderRadius: 6, padding: "2px 6px", fontSize: 14, fontWeight: 800, color: "#1A1A2E", outline: "none", width: 90, textAlign: "right" }}
              />
              <span style={{ fontSize: 13, color: "#6b7280" }}>€</span>
              <button onClick={saveImporte} disabled={savingImp} style={{ background: PRIMARY, color: "#fff", border: "none", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 11 }}>{savingImp ? "..." : "Ok"}</button>
              <button onClick={() => { setImporteEdit(String(factura.importe_total)); setEditImporte(false); }} style={{ background: "#f3f4f6", border: "none", borderRadius: 6, padding: "2px 6px", cursor: "pointer" }}><X style={{ width: 10, height: 10 }} /></button>
            </div>
          ) : (
            <div
              onClick={() => setEditImporte(true)}
              title="Editar importe base"
              style={{ fontSize: 16, fontWeight: 800, color: "#1A1A2E", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}
            >
              {fmt(total)} €
              <Pencil style={{ width: 10, height: 10, color: "#d1d5db" }} />
            </div>
          )}
          {factura.fecha_emision && (
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{fmtDate(factura.fecha_emision)}</div>
          )}
        </div>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} disabled={deleting}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", padding: 4 }}>
          <Trash2 style={{ width: 14, height: 14 }} />
        </button>
        {expanded ? <ChevronUp style={{ width: 16, height: 16, color: "#9ca3af", flexShrink: 0 }} /> : <ChevronDown style={{ width: 16, height: 16, color: "#9ca3af", flexShrink: 0 }} />}
      </div>

      {/* Hitos de pago */}
      {expanded && (
        <div style={{ borderTop: "1px solid #f3f4f6" }}>
          {isMobile ? (
            // ── Tarjetas en móvil
            <div style={{ padding: "10px 12px" }}>
              {factura.pagos.map((p) => (
                <FilaPago key={p.id} pago={p} tenantId={tenantId} isMobile={true}
                  onUpdate={onUpdate} onEmitirPago={onEmitirPago} onVerFactura={onVerFactura} />
              ))}
            </div>
          ) : (
            // ── Tabla en desktop
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#fafafa" }}>
                    <th style={{ padding: "8px 8px", textAlign: "left",   fontSize: 11, fontWeight: 600, color: "#9ca3af", whiteSpace: "nowrap" }}>Hito</th>
                    <th style={{ padding: "8px 8px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>%</th>
                    <th style={{ padding: "8px 8px", textAlign: "right",  fontSize: 11, fontWeight: 600, color: "#9ca3af", whiteSpace: "nowrap" }}>Base</th>
                    <th style={{ padding: "8px 8px", textAlign: "right",  fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>Extra</th>
                    <th style={{ padding: "8px 8px", textAlign: "right",  fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>Total</th>
                    <th style={{ padding: "8px 8px", textAlign: "left",   fontSize: 11, fontWeight: 600, color: "#9ca3af", whiteSpace: "nowrap" }}>Fecha prev.</th>
                    <th style={{ padding: "8px 8px", fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>Estado</th>
                    <th style={{ padding: "8px 8px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textAlign: "right" }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {factura.pagos.map((p) => (
                    <FilaPago key={p.id} pago={p} tenantId={tenantId} isMobile={false}
                      onUpdate={onUpdate} onEmitirPago={onEmitirPago} onVerFactura={onVerFactura} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>

    {/* Preview modal — hito específico */}
    {previewPago !== null && (
      <InvoicePreview
        factura={factura}
        obra={obra}
        tenantId={tenantId}
        pago={previewPago}
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
    <div style={{ background: "#fff", border: `2px solid ${PRIMARY}30`, borderRadius: 18, padding: isMobile ? "16px 14px" : 20, marginBottom: 16, boxShadow: `0 4px 20px ${PRIMARY}10` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Nuevo presupuesto</h4>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X style={{ width: 18, height: 18 }} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Nombre del presupuesto *</label>
          <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Reforma baño principal, instalación cocina…"
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: Math.abs(sumPct - 100) > 0.01 ? "#ef4444" : "#10b981", fontWeight: 600 }}>
              Suma: {sumPct}%
            </span>
            <button
              type="button"
              onClick={() => setPagos((prev) => [...prev, { concepto: `Hito ${prev.length + 1}`, porcentaje: 0, fechaPrevista: null }])}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "#f3f4f6", border: "none", borderRadius: 7, padding: "4px 9px", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}
            >
              <Plus style={{ width: 12, height: 12 }} />
              Hito
            </button>
          </div>
        </div>
        {pagos.map((p, i) => (
          isMobile ? (
            // ── Hito en móvil: card vertical
            <div key={i} style={{
              background: "#f8fafc", borderRadius: 12, padding: "12px 14px",
              marginBottom: 10, border: "1px solid #e5e7eb", position: "relative",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>Hito {i + 1}</span>
                <button
                  type="button"
                  onClick={() => pagos.length > 1 && setPagos((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={pagos.length <= 1}
                  style={{ background: "none", border: "none", cursor: pagos.length <= 1 ? "default" : "pointer", color: pagos.length <= 1 ? "#d1d5db" : "#ef4444", padding: 4, display: "flex" }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Concepto</label>
                <input value={p.concepto} onChange={(e) => setP(i, "concepto", e.target.value)}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 12px", fontSize: 14, boxSizing: "border-box", background: "#fff" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
                    Porcentaje{importeNum > 0 ? ` · ${fmt((importeNum * (parseFloat(String(p.porcentaje)) || 0)) / 100)} €` : ""}
                  </label>
                  <input type="number" value={p.porcentaje} onChange={(e) => setP(i, "porcentaje", parseFloat(e.target.value) as any)} min="0" max="100"
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 12px", fontSize: 14, boxSizing: "border-box", background: "#fff" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Fecha prevista</label>
                  <input type="date" value={p.fechaPrevista ?? ""} onChange={(e) => setP(i, "fechaPrevista", e.target.value || null)}
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 10px", fontSize: 13, boxSizing: "border-box", background: "#fff" }} />
                </div>
              </div>
            </div>
          ) : (
            // ── Hito en desktop: fila horizontal
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
              <div>
                {i === 0 && <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>Concepto</label>}
                <input value={p.concepto} onChange={(e) => setP(i, "concepto", e.target.value)}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div>
                {i === 0 && <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>%</label>}
                <input type="number" value={p.porcentaje} onChange={(e) => setP(i, "porcentaje", parseFloat(e.target.value) as any)} min="0" max="100"
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div>
                {i === 0 && <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>
                  Fecha{importeNum > 0 ? ` · ${fmt((importeNum * (parseFloat(String(p.porcentaje)) || 0)) / 100)} €` : ""}
                </label>}
                {i !== 0 && importeNum > 0 && <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>
                  {fmt((importeNum * (parseFloat(String(p.porcentaje)) || 0)) / 100)} €
                </label>}
                <input type="date" value={p.fechaPrevista ?? ""} onChange={(e) => setP(i, "fechaPrevista", e.target.value || null)}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 10px", fontSize: 13, boxSizing: "border-box" }} />
              </div>
              <div style={{ paddingBottom: 1 }}>
                {i === 0 && <div style={{ height: 18, marginBottom: 3 }} />}
                <button
                  type="button"
                  onClick={() => pagos.length > 1 && setPagos((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={pagos.length <= 1}
                  title="Eliminar hito"
                  style={{ background: pagos.length <= 1 ? "#f9fafb" : "#fef2f2", border: "none", borderRadius: 7, padding: "6px 8px", cursor: pagos.length <= 1 ? "default" : "pointer", color: pagos.length <= 1 ? "#d1d5db" : "#ef4444", display: "flex", alignItems: "center" }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          )
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
          Crear presupuesto
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

  // Totales con IVA incluido (importe real que paga el cliente)
  function conIva(importe: number, f: FacturaConPagos) {
    const iva = (f as any).porcentaje_iva ?? 21;
    return importe * (1 + iva / 100);
  }
  const totalFacturado = facturas.reduce((s, f) =>
    s + f.pagos.reduce((ps, p) => ps + conIva(p.importe_total, f), 0), 0);
  const totalCobrado = facturas.reduce((s, f) =>
    s + f.pagos.filter((p) => p.estado === "cobrada").reduce((ps, p) => ps + conIva(p.importe_total, f), 0), 0);
  const pendiente = totalFacturado - totalCobrado;

  return (
    <div style={{ marginTop: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1A1A2E" }}>Presupuestos</h3>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#94A3B8" }}>
            {facturas.length === 0
              ? "Sin presupuestos aún"
              : `${facturas.length} presupuesto${facturas.length !== 1 ? "s" : ""} · cobros de esta obra`}
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: PRIMARY, color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Plus style={{ width: 16, height: 16 }} />
            Nuevo presupuesto
          </button>
        )}
      </div>

      {/* KPI chips */}
      {totalFacturado > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          <div style={{
            display: "flex", flexDirection: "column", gap: 4,
            background: "#fff", borderRadius: 14, padding: "12px 14px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            borderTop: `3px solid ${PRIMARY}`,
          }}>
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Facturado</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: PRIMARY_D, letterSpacing: "-0.3px" }}>{fmt(totalFacturado)}<span style={{ fontSize: 11, fontWeight: 600, marginLeft: 2 }}>€</span></div>
          </div>
          <div style={{
            display: "flex", flexDirection: "column", gap: 4,
            background: "#fff", borderRadius: 14, padding: "12px 14px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            borderTop: "3px solid #10b981",
          }}>
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Cobrado</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#15803d", letterSpacing: "-0.3px" }}>{fmt(totalCobrado)}<span style={{ fontSize: 11, fontWeight: 600, marginLeft: 2 }}>€</span></div>
          </div>
          <div style={{
            display: "flex", flexDirection: "column", gap: 4,
            background: "#fff", borderRadius: 14, padding: "12px 14px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            borderTop: "3px solid #f59e0b",
          }}>
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Pendiente</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#b45309", letterSpacing: "-0.3px" }}>{fmt(pendiente)}<span style={{ fontSize: 11, fontWeight: 600, marginLeft: 2 }}>€</span></div>
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
          <p style={{ margin: 0, fontSize: 14 }}>Sin presupuestos. Crea el primero con "+ Nuevo presupuesto".</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {facturas.map((f, idx) => (
            <div key={f.id}>
              {facturas.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, color: PRIMARY,
                    background: PRIMARY_L, borderRadius: 6,
                    padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.1em",
                  }}>
                    Presupuesto {idx + 1}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "#f0f0f5" }} />
                </div>
              )}
              <FacturaCard factura={f} obra={obra} tenantId={tenantId} onUpdate={load}
                onDelete={(id) => setFacturas((prev) => prev.filter((x) => x.id !== id))} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
