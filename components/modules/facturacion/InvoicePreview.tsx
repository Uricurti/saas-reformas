"use client";

import { useEffect, useState, useRef } from "react";
import { getTenantConfig, upsertTenantConfig, type TenantConfig } from "@/lib/insforge/database";
import type { FacturaConPagos, Obra, Pago } from "@/types";
import { X, Printer, Settings, Check, Loader2, Building2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtE(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd 'de' MMMM 'de' yyyy", { locale: es }); } catch { return d; }
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente_emitir: "Pendiente",
  emitida: "Emitida",
  cobrada: "Cobrada",
};

// ─── Modal de configuración empresa ──────────────────────────────────────────
function ConfigEmpresaModal({
  tenantId, config, onClose, onSaved,
}: {
  tenantId: string;
  config: TenantConfig | null;
  onClose: () => void;
  onSaved: (c: TenantConfig) => void;
}) {
  const [nombre, setNombre]     = useState(config?.empresa_nombre ?? "");
  const [cif, setCif]           = useState(config?.empresa_cif ?? "");
  const [dir, setDir]           = useState(config?.empresa_direccion ?? "");
  const [tel, setTel]           = useState(config?.empresa_telefono ?? "");
  const [email, setEmail]       = useState(config?.empresa_email ?? "");
  const [saving, setSaving]     = useState(false);

  async function handleSave() {
    setSaving(true);
    const { data } = await upsertTenantConfig(tenantId, {
      empresa_nombre: nombre || null,
      empresa_cif: cif || null,
      empresa_direccion: dir || null,
      empresa_telefono: tel || null,
      empresa_email: email || null,
    });
    setSaving(false);
    if (data) onSaved(data as TenantConfig);
    onClose();
  }

  const fields = [
    { label: "Nombre empresa *", value: nombre, set: setNombre, placeholder: "Reformas García S.L." },
    { label: "CIF / NIF", value: cif, set: setCif, placeholder: "B12345678" },
    { label: "Dirección", value: dir, set: setDir, placeholder: "C/ Mayor 10, 08001 Barcelona" },
    { label: "Teléfono", value: tel, set: setTel, placeholder: "+34 600 000 000" },
    { label: "Email", value: email, set: setEmail, placeholder: "info@reformasgarcia.com" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 440, boxShadow: "0 25px 80px rgba(0,0,0,0.2)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, border: "none", background: "#f3f4f6", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#EEF2F8", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 style={{ width: 18, height: 18, color: "#607eaa" }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Datos de empresa</h3>
            <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>Aparecerán en todas las facturas</p>
          </div>
        </div>
        {fields.map((f) => (
          <div key={f.label} style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>{f.label}</label>
            <input value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder}
              style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#607eaa")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
            />
          </div>
        ))}
        <button onClick={handleSave} disabled={saving || !nombre}
          style={{ width: "100%", marginTop: 8, background: saving || !nombre ? "#94a3b8" : "#607eaa", color: "#fff", border: "none", borderRadius: 10, padding: "12px 0", fontWeight: 700, fontSize: 15, cursor: saving || !nombre ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {saving ? <Loader2 style={{ width: 16, height: 16 }} /> : <Check style={{ width: 16, height: 16 }} />}
          Guardar datos
        </button>
      </div>
    </div>
  );
}

// ─── Contenido imprimible de la factura ──────────────────────────────────────
function InvoiceDocument({
  factura, obra, config, pago,
}: {
  factura: FacturaConPagos;
  obra: Obra | null;
  config: TenantConfig | null;
  pago?: Pago; // si se pasa → modo hito específico
}) {
  // Modo hito-específico: mostramos solo ese pago con IVA
  const isModoHito = !!pago;
  const porcentajeIva = (factura as any).porcentaje_iva ?? 21;
  const numeroFactura = isModoHito
    ? `${factura.numero_factura ?? "FAC-???"}/${pago!.orden}`
    : (factura.numero_factura ?? "—");

  // Cálculos según modo
  const pagosMostrar = isModoHito ? [pago!] : factura.pagos;
  const baseHito     = isModoHito ? pago!.importe_total : 0;
  const ivaHito      = isModoHito ? Math.round(baseHito * porcentajeIva / 100 * 100) / 100 : 0;
  const totalHito    = isModoHito ? baseHito + ivaHito : 0;

  // Modo completo
  const totalBase    = factura.pagos.reduce((s, p) => s + p.importe_base, 0);
  const totalExtra   = factura.pagos.reduce((s, p) => s + (p.importe_extra ?? 0), 0);
  const totalFinal   = factura.pagos.reduce((s, p) => s + p.importe_total, 0);
  const cobrado      = factura.pagos.filter((p) => p.estado === "cobrada").reduce((s, p) => s + p.importe_total, 0);
  const pendiente    = totalFinal - cobrado;

  return (
    <div id="invoice-doc" style={{
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      background: "#fff",
      padding: "48px",
      maxWidth: "820px",
      margin: "0 auto",
      color: "#1A1A2E",
      fontSize: 14,
      lineHeight: 1.6,
    }}>
      {/* ── Header empresa + número ─────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
        {/* Logo / nombre empresa */}
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#607eaa", letterSpacing: "-0.5px", marginBottom: 4 }}>
            {config?.empresa_nombre ?? "Tu Empresa"}
          </div>
          {config?.empresa_cif && (
            <div style={{ fontSize: 13, color: "#6b7280" }}>CIF: {config.empresa_cif}</div>
          )}
          {config?.empresa_direccion && (
            <div style={{ fontSize: 13, color: "#6b7280" }}>{config.empresa_direccion}</div>
          )}
          {config?.empresa_telefono && (
            <div style={{ fontSize: 13, color: "#6b7280" }}>{config.empresa_telefono}</div>
          )}
          {config?.empresa_email && (
            <div style={{ fontSize: 13, color: "#6b7280" }}>{config.empresa_email}</div>
          )}
        </div>

        {/* Número y fecha */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
            {isModoHito ? "Factura" : "Presupuesto / Factura"}
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#1A1A2E", letterSpacing: "-1px" }}>
            {numeroFactura}
          </div>
          {isModoHito && (
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              Hito {pago!.orden} de 3 · {pago!.porcentaje}%
            </div>
          )}
          {factura.fecha_emision && (
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
              {fmtDate(factura.fecha_emision)}
            </div>
          )}
        </div>
      </div>

      {/* ── Línea divisora con gradiente ────────────────────────── */}
      <div style={{ height: 3, background: "linear-gradient(90deg, #607eaa, #26bbec, transparent)", borderRadius: 99, marginBottom: 36 }} />

      {/* ── Datos cliente ────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 40, marginBottom: 36 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Facturar a
          </div>
          {obra?.cliente_nombre ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E" }}>{obra.cliente_nombre}</div>
              {obra.cliente_telefono && <div style={{ fontSize: 13, color: "#6b7280" }}>{obra.cliente_telefono}</div>}
              {obra.direccion && <div style={{ fontSize: 13, color: "#6b7280" }}>{obra.direccion}</div>}
            </>
          ) : (
            <div style={{ fontSize: 14, color: "#94a3b8", fontStyle: "italic" }}>Sin datos de cliente</div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Obra / Proyecto
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E" }}>{obra?.nombre ?? "—"}</div>
          {obra?.direccion && <div style={{ fontSize: 13, color: "#6b7280" }}>{obra.direccion}</div>}
          {obra?.fecha_inicio && <div style={{ fontSize: 13, color: "#6b7280" }}>Inicio: {fmtDate(obra.fecha_inicio)}</div>}
        </div>
      </div>

      {/* ── Título del presupuesto ───────────────────────────────── */}
      <div style={{ background: "#EEF2F8", borderRadius: 12, padding: "20px 24px", marginBottom: 28, borderLeft: "4px solid #607eaa" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#607eaa", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
          {isModoHito ? `Hito de cobro — ${pago!.concepto}` : "Concepto"}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A2E", marginBottom: factura.notas ? 12 : 0 }}>
          {factura.concepto}
        </div>
        {factura.notas && (
          <div style={{ fontSize: 13, color: "#4A5568", lineHeight: 1.7, whiteSpace: "pre-wrap", marginTop: 4 }}>
            {factura.notas}
          </div>
        )}
      </div>

      {/* ── Tabla de hitos (o un solo hito) ─────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
          {isModoHito ? "Detalle del cobro" : "Hitos de pago"}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #EEF2F8" }}>
              <th style={{ textAlign: "left",  padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Descripción</th>
              <th style={{ textAlign: "center",padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>%</th>
              <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Importe base</th>
              {!isModoHito && <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Extras</th>}
              <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Subtotal</th>
              {!isModoHito && <th style={{ textAlign: "center",padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Fecha prev.</th>}
              {!isModoHito && <th style={{ textAlign: "center",padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Estado</th>}
            </tr>
          </thead>
          <tbody>
            {pagosMostrar.map((p, i) => {
              const estadoColor = p.estado === "cobrada" ? "#10b981" : p.estado === "emitida" ? "#607eaa" : "#f59e0b";
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                  <td style={{ padding: "12px 12px", fontWeight: 600, color: "#1A1A2E" }}>
                    {p.concepto}
                    {p.nota && <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400, marginTop: 2 }}>{p.nota}</div>}
                  </td>
                  <td style={{ padding: "12px 12px", textAlign: "center", color: "#6b7280" }}>{p.porcentaje}%</td>
                  <td style={{ padding: "12px 12px", textAlign: "right", color: "#4A5568" }}>{fmtE(p.importe_base)}</td>
                  {!isModoHito && (
                    <td style={{ padding: "12px 12px", textAlign: "right", color: p.importe_extra > 0 ? "#f59e0b" : "#d1d5db", fontWeight: p.importe_extra > 0 ? 700 : 400 }}>
                      {p.importe_extra > 0 ? `+${fmtE(p.importe_extra)}` : "—"}
                    </td>
                  )}
                  <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 700, color: "#1A1A2E" }}>{fmtE(p.importe_total)}</td>
                  {!isModoHito && (
                    <td style={{ padding: "12px 12px", textAlign: "center", color: "#6b7280", fontSize: 13 }}>
                      {p.fecha_prevista ? fmtDate(p.fecha_prevista) : "—"}
                    </td>
                  )}
                  {!isModoHito && (
                    <td style={{ padding: "12px 12px", textAlign: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: estadoColor + "18", color: estadoColor }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: estadoColor }} />
                        {ESTADO_LABEL[p.estado] ?? p.estado}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Desglose IVA (modo hito) o Resumen (modo completo) ─── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 36 }}>
        <div style={{ width: 320 }}>
          {isModoHito ? (
            // Desglose con IVA
            <>
              {pago!.importe_extra > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#6b7280", fontSize: 14 }}>
                    <span>Importe base</span><span>{fmtE(pago!.importe_base)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#f59e0b", fontWeight: 600, fontSize: 14 }}>
                    <span>Extras adicionales</span><span>+{fmtE(pago!.importe_extra)}</span>
                  </div>
                  <div style={{ height: 1, background: "#e5e7eb", margin: "4px 0 8px" }} />
                </>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#6b7280", fontSize: 14 }}>
                <span>Base imponible</span><span>{fmtE(baseHito)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#6b7280", fontSize: 14 }}>
                <span>IVA ({porcentajeIva}%)</span><span>{fmtE(ivaHito)}</span>
              </div>
              <div style={{ height: 1, background: "#e5e7eb", margin: "6px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", background: "#1A1A2E", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 20, marginTop: 4 }}>
                <span>TOTAL</span><span>{fmtE(totalHito)}</span>
              </div>
              {pago!.fecha_prevista && (
                <div style={{ textAlign: "right", fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
                  Fecha prevista de cobro: {fmtDate(pago!.fecha_prevista)}
                </div>
              )}
            </>
          ) : (
            // Resumen sin IVA (vista general)
            <>
              {totalExtra > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#6b7280", fontSize: 14 }}>
                    <span>Importe base</span><span>{fmtE(totalBase)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#f59e0b", fontWeight: 600, fontSize: 14 }}>
                    <span>Extras adicionales</span><span>+{fmtE(totalExtra)}</span>
                  </div>
                  <div style={{ height: 1, background: "#e5e7eb", margin: "6px 0" }} />
                </>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", background: "#1A1A2E", borderRadius: 10, color: "#fff", fontWeight: 800, fontSize: 18 }}>
                <span>TOTAL (sin IVA)</span><span>{fmtE(totalFinal)}</span>
              </div>
              {cobrado > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#10b981", fontWeight: 600, fontSize: 13, marginTop: 8 }}>
                    <span>Cobrado</span><span>−{fmtE(cobrado)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#f59e0b", fontWeight: 700, fontSize: 14 }}>
                    <span>Pendiente</span><span>{fmtE(pendiente)}</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Footer legal ────────────────────────────────────────── */}
      <div style={{ height: 1, background: "#EEF2F8", marginBottom: 24 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: "#94a3b8", maxWidth: 420 }}>
          {isModoHito
            ? `Factura nº ${numeroFactura} emitida conforme a la ley fiscal vigente. IVA incluido según tipo aplicable. En caso de impago se aplicará el interés legal vigente.`
            : "Este documento es un resumen de la facturación de la obra. Cada hito tiene su propia factura con IVA desglosado."
          }
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#607eaa", letterSpacing: "-0.5px" }}>ReforLife</div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>Gestión profesional de reformas</div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal (modal con overlay) ─────────────────────────────────
export function InvoicePreview({
  factura, obra, tenantId, pago, onClose,
}: {
  factura: FacturaConPagos;
  obra: Obra | null;
  tenantId: string;
  pago?: Pago;
  onClose: () => void;
}) {
  const [config, setConfig]           = useState<TenantConfig | null>(null);
  const [showConfig, setShowConfig]   = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    getTenantConfig(tenantId).then((c) => { setConfig(c); setLoadingConfig(false); });
  }, [tenantId]);

  const invoiceTitle = pago
    ? `${factura.numero_factura ?? "FAC-???"}/${pago.orden}`
    : (factura.numero_factura ?? "Factura");

  function handlePrint() {
    const content = document.getElementById("invoice-doc");
    if (!content) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Factura ${invoiceTitle}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background:#fff; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>${content.innerHTML}</body>
</html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  }

  return (
    <>
      {/* Overlay principal */}
      <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", flexDirection: "column", background: "rgba(15,23,42,0.75)", backdropFilter: "blur(4px)" }}>
        {/* Barra superior */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "#fff", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEF2F8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 18 }}>📄</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1A2E" }}>
                Vista previa —{" "}
                {pago
                  ? `${factura.numero_factura ?? "FAC-???"}/${pago.orden} · ${pago.concepto}`
                  : (factura.numero_factura ?? "Sin número")}
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{factura.concepto}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!loadingConfig && (
              <button onClick={() => setShowConfig(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#f3f4f6", color: "#4A5568", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                <Settings style={{ width: 15, height: 15 }} />
                <span className="hidden sm:inline">Datos empresa</span>
              </button>
            )}
            <button onClick={handlePrint}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#607eaa", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              <Printer style={{ width: 15, height: 15 }} />
              <span className="hidden sm:inline">Descargar PDF</span>
            </button>
            <button onClick={onClose}
              style={{ background: "#f3f4f6", border: "none", borderRadius: 10, padding: "9px 12px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <X style={{ width: 18, height: 18, color: "#6b7280" }} />
            </button>
          </div>
        </div>

        {/* Contenido scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px", background: "#f1f5f9" }}>
          {loadingConfig ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
              <Loader2 style={{ width: 32, height: 32, color: "#607eaa", animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <>
              {/* Aviso si no hay datos empresa */}
              {!config?.empresa_nombre && (
                <div style={{ maxWidth: 820, margin: "0 auto 16px", background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <strong>Configura los datos de tu empresa</strong> para que aparezcan en la factura.
                  </div>
                  <button onClick={() => setShowConfig(true)}
                    style={{ background: "#607eaa", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                    Configurar
                  </button>
                </div>
              )}

              {/* Documento factura */}
              <div style={{ maxWidth: 820, margin: "0 auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", borderRadius: 4, overflow: "hidden" }}>
                <InvoiceDocument factura={factura} obra={obra} config={config} pago={pago} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal config empresa */}
      {showConfig && (
        <ConfigEmpresaModal
          tenantId={tenantId}
          config={config}
          onClose={() => setShowConfig(false)}
          onSaved={(c) => setConfig(c)}
        />
      )}
    </>
  );
}
