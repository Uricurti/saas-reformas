"use client";

import { useEffect, useState, useRef } from "react";
import { getTenantConfig, upsertTenantConfig, type TenantConfig } from "@/lib/insforge/database";
import type { FacturaConPagos, Obra, Pago } from "@/types";
import { X, Download, Settings, Check, Loader2, Building2 } from "lucide-react";
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

// ─── Modal configuración empresa ─────────────────────────────────────────────
function ConfigEmpresaModal({
  tenantId, config, onClose, onSaved,
}: {
  tenantId: string;
  config: TenantConfig | null;
  onClose: () => void;
  onSaved: (c: TenantConfig) => void;
}) {
  const [nombre, setNombre] = useState(config?.empresa_nombre ?? "");
  const [cif,    setCif]    = useState(config?.empresa_cif ?? "");
  const [dir,    setDir]    = useState(config?.empresa_direccion ?? "");
  const [tel,    setTel]    = useState(config?.empresa_telefono ?? "");
  const [email,  setEmail]  = useState(config?.empresa_email ?? "");
  const [saving, setSaving] = useState(false);

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
    { label: "CIF / NIF",        value: cif,    set: setCif,    placeholder: "B12345678" },
    { label: "Dirección",        value: dir,    set: setDir,    placeholder: "C/ Mayor 10, 08001 Barcelona" },
    { label: "Teléfono",         value: tel,    set: setTel,    placeholder: "+34 600 000 000" },
    { label: "Email",            value: email,  set: setEmail,  placeholder: "info@reformasgarcia.com" },
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
              onBlur={(e)  => (e.currentTarget.style.borderColor = "#e5e7eb")}
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

// ─── Documento A4 ─────────────────────────────────────────────────────────────
// Ancho fijo 794px = A4 a 96dpi — html2pdf lo mapea perfectamente a 210mm
function InvoiceDocument({
  factura, obra, config, pago,
}: {
  factura: FacturaConPagos;
  obra: Obra | null;
  config: TenantConfig | null;
  pago?: Pago;
}) {
  const isModoHito    = !!pago;
  const porcentajeIva = (factura as any).porcentaje_iva ?? 21;

  const numeroFactura = isModoHito
    ? (pago!.numero_factura_emitida ?? `${factura.numero_factura ?? "FAC-???"}/${pago!.orden}`)
    : (factura.numero_factura ?? "—");

  // Cálculos modo hito
  const baseHito  = isModoHito ? pago!.importe_total : 0;
  const ivaHito   = isModoHito ? Math.round(baseHito * porcentajeIva / 100 * 100) / 100 : 0;
  const totalHito = isModoHito ? baseHito + ivaHito : 0;

  // Cálculos modo completo
  const totalBase  = factura.pagos.reduce((s, p) => s + p.importe_base, 0);
  const totalExtra = factura.pagos.reduce((s, p) => s + (p.importe_extra ?? 0), 0);
  const totalFinal = factura.pagos.reduce((s, p) => s + p.importe_total, 0);
  const cobrado    = factura.pagos.filter((p) => p.estado === "cobrada").reduce((s, p) => s + p.importe_total, 0);

  // Paleta
  const PRIMARY    = "#607eaa";
  const PRIMARY_D  = "#1c3879";
  const TEXT_DARK  = "#1A1A2E";
  const TEXT_MID   = "#4A5568";
  const TEXT_SOFT  = "#6b7280";
  const TEXT_FAINT = "#94a3b8";
  const BG_LIGHT   = "#EEF2F8";

  // Tipografía
  const fontBase: React.CSSProperties = {
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    WebkitFontSmoothing: "antialiased",
  };

  return (
    <div
      id="invoice-doc"
      style={{
        ...fontBase,
        background: "#ffffff",
        width: "794px",
        boxSizing: "border-box",
        padding: "52px 56px 44px",
        color: TEXT_DARK,
        fontSize: "13px",
        lineHeight: "1.55",
      }}
    >
      {/* ══ CABECERA ═══════════════════════════════════════════════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, pageBreakInside: "avoid", breakInside: "avoid" }}>
        {/* Empresa */}
        <div style={{ maxWidth: 320 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: PRIMARY, letterSpacing: "-0.5px", lineHeight: 1.1, marginBottom: 8 }}>
            {config?.empresa_nombre ?? "Tu Empresa"}
          </div>
          {config?.empresa_cif && (
            <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 2 }}>
              <strong style={{ color: TEXT_MID }}>CIF:</strong> {config.empresa_cif}
            </div>
          )}
          {config?.empresa_direccion && (
            <div style={{ fontSize: 12, color: TEXT_SOFT }}>{config.empresa_direccion}</div>
          )}
          {config?.empresa_telefono && (
            <div style={{ fontSize: 12, color: TEXT_SOFT }}>{config.empresa_telefono}</div>
          )}
          {config?.empresa_email && (
            <div style={{ fontSize: 12, color: TEXT_SOFT }}>{config.empresa_email}</div>
          )}
        </div>

        {/* Número factura */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_FAINT, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
            {isModoHito ? "Factura" : "Presupuesto"}
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: TEXT_DARK, letterSpacing: "-1px", lineHeight: 1 }}>
            {numeroFactura}
          </div>
          {isModoHito && (
            <div style={{ fontSize: 11, color: TEXT_FAINT, marginTop: 4 }}>
              Hito {pago!.orden} · {pago!.concepto} ({pago!.porcentaje}%)
            </div>
          )}
          {factura.fecha_emision && (
            <div style={{ fontSize: 12, color: TEXT_SOFT, marginTop: 6 }}>
              {fmtDate(factura.fecha_emision)}
            </div>
          )}
          {!factura.fecha_emision && (
            <div style={{ fontSize: 12, color: TEXT_SOFT, marginTop: 6 }}>
              {fmtDate(new Date().toISOString().split("T")[0])}
            </div>
          )}
        </div>
      </div>

      {/* ══ LÍNEA DEGRADADA ════════════════════════════════════════ */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${PRIMARY}, #26bbec 50%, transparent)`, borderRadius: 99, marginBottom: 32 }} />

      {/* ══ CLIENTE + OBRA ══════════════════════════════════════════ */}
      <div style={{ display: "flex", gap: 32, marginBottom: 32, pageBreakInside: "avoid", breakInside: "avoid" }}>
        <div style={{ flex: 1, padding: "16px 20px", background: "#f9fafb", borderRadius: 10, borderLeft: `3px solid ${PRIMARY}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: TEXT_FAINT, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            Facturar a
          </div>
          {obra?.cliente_nombre ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_DARK, marginBottom: 2 }}>{obra.cliente_nombre}</div>
              {obra.cliente_telefono && <div style={{ fontSize: 12, color: TEXT_SOFT }}>{obra.cliente_telefono}</div>}
              {obra.direccion && <div style={{ fontSize: 12, color: TEXT_SOFT }}>{obra.direccion}</div>}
            </>
          ) : (
            <div style={{ fontSize: 13, color: TEXT_FAINT, fontStyle: "italic" }}>Sin datos de cliente</div>
          )}
        </div>
        <div style={{ flex: 1, padding: "16px 20px", background: "#f9fafb", borderRadius: 10, borderLeft: `3px solid #26bbec` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: TEXT_FAINT, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            Obra / Proyecto
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_DARK, marginBottom: 2 }}>{obra?.nombre ?? "—"}</div>
          {obra?.direccion && <div style={{ fontSize: 12, color: TEXT_SOFT }}>{obra.direccion}</div>}
          {obra?.fecha_inicio && (
            <div style={{ fontSize: 12, color: TEXT_SOFT }}>Inicio: {fmtDate(obra.fecha_inicio)}</div>
          )}
        </div>
      </div>

      {/* ══ CONCEPTO + DESCRIPCIÓN ══════════════════════════════════ */}
      <div style={{ background: BG_LIGHT, borderRadius: 12, padding: "20px 24px", marginBottom: 28, breakInside: "avoid" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: PRIMARY, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
          {isModoHito ? `Hito ${pago!.orden} de ${factura.pagos.length} — ${pago!.concepto}` : "Concepto del presupuesto"}
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: TEXT_DARK, letterSpacing: "-0.3px", lineHeight: 1.25, marginBottom: factura.notas ? 12 : 0 }}>
          {factura.concepto}
        </div>
        {factura.notas && (
          <div style={{ fontSize: 12.5, color: TEXT_MID, lineHeight: 1.7, whiteSpace: "pre-wrap", marginTop: 8, paddingTop: 8, borderTop: "1px solid #dde6f5" }}>
            {factura.notas}
          </div>
        )}
      </div>

      {/* ══ TABLA HITOS ════════════════════════════════════════════ */}
      <div style={{ marginBottom: 28, breakInside: "avoid" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: TEXT_FAINT, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
          {isModoHito ? "Detalle del cobro" : "Hitos de pago"}
        </div>

        {/* Cabecera tabla */}
        <div style={{ display: "flex", background: TEXT_DARK, borderRadius: "8px 8px 0 0", padding: "9px 14px" }}>
          <div style={{ flex: 3, fontSize: 10, fontWeight: 700, color: "#ffffff", letterSpacing: "0.06em", textTransform: "uppercase" }}>Descripción</div>
          <div style={{ width: 48, fontSize: 10, fontWeight: 700, color: "#ffffff", textAlign: "center", letterSpacing: "0.06em" }}>%</div>
          <div style={{ width: 110, fontSize: 10, fontWeight: 700, color: "#ffffff", textAlign: "right", letterSpacing: "0.06em" }}>Importe base</div>
          {!isModoHito && <div style={{ width: 90, fontSize: 10, fontWeight: 700, color: "#ffffff", textAlign: "right", letterSpacing: "0.06em" }}>Extras</div>}
          <div style={{ width: 110, fontSize: 10, fontWeight: 700, color: "#ffffff", textAlign: "right", letterSpacing: "0.06em" }}>Subtotal</div>
          {!isModoHito && <div style={{ width: 100, fontSize: 10, fontWeight: 700, color: "#ffffff", textAlign: "center", letterSpacing: "0.06em" }}>Fecha prev.</div>}
        </div>

        {/* Filas */}
        {(isModoHito ? [pago!] : factura.pagos).map((p, i) => (
          <div key={p.id} style={{
            display: "flex", alignItems: "center",
            padding: "11px 14px",
            background: i % 2 === 0 ? "#ffffff" : "#f9fafb",
            borderBottom: "1px solid #f0f0f5",
          }}>
            <div style={{ flex: 3 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_DARK }}>{p.concepto}</div>
              {p.nota && <div style={{ fontSize: 10, color: TEXT_FAINT, marginTop: 1 }}>{p.nota}</div>}
            </div>
            <div style={{ width: 48, fontSize: 12, color: TEXT_SOFT, textAlign: "center" }}>{p.porcentaje}%</div>
            <div style={{ width: 110, fontSize: 12, color: TEXT_MID, textAlign: "right" }}>{fmtE(p.importe_base)}</div>
            {!isModoHito && (
              <div style={{ width: 90, fontSize: 12, textAlign: "right", color: p.importe_extra > 0 ? "#f59e0b" : "#d1d5db", fontWeight: p.importe_extra > 0 ? 700 : 400 }}>
                {p.importe_extra > 0 ? `+${fmtE(p.importe_extra)}` : "—"}
              </div>
            )}
            <div style={{ width: 110, fontSize: 13, fontWeight: 700, color: TEXT_DARK, textAlign: "right" }}>{fmtE(p.importe_total)}</div>
            {!isModoHito && (
              <div style={{ width: 100, fontSize: 11, color: TEXT_SOFT, textAlign: "center" }}>
                {p.fecha_prevista ? fmtDate(p.fecha_prevista) : "—"}
              </div>
            )}
          </div>
        ))}
        <div style={{ height: 2, background: TEXT_DARK, borderRadius: "0 0 4px 4px" }} />
      </div>

      {/* ══ TOTALES ════════════════════════════════════════════════ */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 36, breakInside: "avoid" }}>
        <div style={{ width: 300 }}>
          {isModoHito ? (
            // ── Modo hito: desglose con IVA
            <>
              {pago!.importe_extra > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f5" }}>
                    <span style={{ fontSize: 13, color: TEXT_SOFT }}>Hito ({pago!.porcentaje}%)</span>
                    <span style={{ fontSize: 13, color: TEXT_MID }}>{fmtE(pago!.importe_base)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f5" }}>
                    <span style={{ fontSize: 13, color: "#b45309" }}>Trabajos adicionales</span>
                    <span style={{ fontSize: 13, color: "#b45309", fontWeight: 700 }}>+{fmtE(pago!.importe_extra)}</span>
                  </div>
                </>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 13, color: TEXT_SOFT }}>Base imponible</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_MID }}>{fmtE(baseHito)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 13, color: TEXT_SOFT }}>IVA ({porcentajeIva}%)</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_MID }}>{fmtE(ivaHito)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: TEXT_DARK, borderRadius: 10, marginTop: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", letterSpacing: "0.04em" }}>TOTAL A PAGAR</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.5px" }}>{fmtE(totalHito)}</span>
              </div>
              {pago!.fecha_prevista && (
                <div style={{ textAlign: "right", fontSize: 11.5, color: TEXT_SOFT, marginTop: 10 }}>
                  Fecha prevista de cobro:{" "}
                  <strong style={{ color: TEXT_MID }}>{fmtDate(pago!.fecha_prevista)}</strong>
                </div>
              )}
            </>
          ) : (
            // ── Modo completo: resumen
            <>
              {totalExtra > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f5" }}>
                    <span style={{ fontSize: 13, color: TEXT_SOFT }}>Importe base</span>
                    <span style={{ fontSize: 13, color: TEXT_MID }}>{fmtE(totalBase)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f5" }}>
                    <span style={{ fontSize: 13, color: "#b45309" }}>Extras adicionales</span>
                    <span style={{ fontSize: 13, color: "#b45309", fontWeight: 700 }}>+{fmtE(totalExtra)}</span>
                  </div>
                </>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", background: TEXT_DARK, borderRadius: 10, marginTop: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>TOTAL (sin IVA)</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#ffffff" }}>{fmtE(totalFinal)}</span>
              </div>
              {cobrado > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: "#10b981" }}>Cobrado</span>
                    <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>−{fmtE(cobrado)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                    <span style={{ fontSize: 13, color: "#b45309", fontWeight: 600 }}>Pendiente</span>
                    <span style={{ fontSize: 13, color: "#b45309", fontWeight: 700 }}>{fmtE(totalFinal - cobrado)}</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══ FOOTER ════════════════════════════════════════════════ */}
      <div style={{ borderTop: "1.5px solid #EEF2F8", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", breakInside: "avoid" }}>
        <div style={{ fontSize: 10, color: TEXT_FAINT, maxWidth: 380, lineHeight: 1.6 }}>
          {isModoHito
            ? `Factura nº ${numeroFactura} emitida conforme a la normativa fiscal vigente (Ley 37/1992 del IVA). El pago debe realizarse en la fecha indicada. En caso de demora se aplicará el interés legal del dinero.`
            : "Documento de resumen de facturación. Cada hito de pago dispone de su propia factura con IVA desglosado."}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: PRIMARY, letterSpacing: "-0.5px", lineHeight: 1 }}>ReforLife</div>
          <div style={{ fontSize: 9, color: TEXT_FAINT, marginTop: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>Gestión profesional de reformas</div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
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
  const [downloading, setDownloading] = useState(false);
  const [scale, setScale]             = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const invoiceTitle = pago
    ? (pago.numero_factura_emitida ?? `${factura.numero_factura ?? "FAC-???"}/${pago.orden}`)
    : (factura.numero_factura ?? "Factura");

  // Calcular escala para que quepa en pantalla
  useEffect(() => {
    function updateScale() {
      const maxW = Math.min(window.innerWidth - 24, 860);
      setScale(Math.min(1, maxW / 794));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    getTenantConfig(tenantId).then((c) => { setConfig(c); setLoadingConfig(false); });
  }, [tenantId]);

  async function handleDownload() {
    const element = document.getElementById("invoice-doc");
    if (!element) return;
    setDownloading(true);
    try {
      // Dynamic import para evitar problemas SSR
      const html2pdf = (await import("html2pdf.js" as any)).default;
      await html2pdf()
        .set({
          margin: 0,
          filename: `${invoiceTitle}.pdf`,
          image:      { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait",
            compress: true,
          },
          pagebreak: {
            mode: ["css", "legacy"],
            avoid: [".no-page-break"],
          },
        })
        .from(element)
        .save();
    } catch (err) {
      console.error("Error generando PDF:", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", flexDirection: "column", background: "rgba(15,23,42,0.80)", backdropFilter: "blur(6px)" }}>

        {/* ── Barra superior ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EEF2F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 17 }}>📄</span>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E" }}>{invoiceTitle}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "calc(100vw - 240px)" }}>
                {factura.concepto}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {!loadingConfig && (
              <button onClick={() => setShowConfig(true)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "#f3f4f6", color: "#4A5568", border: "none", borderRadius: 9, padding: "8px 12px", fontWeight: 600, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                <Settings style={{ width: 14, height: 14 }} />
                <span style={{ display: "none" }} className="sm:block">Empresa</span>
              </button>
            )}
            <button onClick={handleDownload} disabled={downloading}
              style={{ display: "flex", alignItems: "center", gap: 5, background: downloading ? "#94a3b8" : "#607eaa", color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontWeight: 700, fontSize: 12, cursor: downloading ? "default" : "pointer", whiteSpace: "nowrap" }}>
              {downloading
                ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                : <Download style={{ width: 14, height: 14 }} />}
              {downloading ? "Generando..." : "Descargar PDF"}
            </button>
            <button onClick={onClose}
              style={{ background: "#f3f4f6", border: "none", borderRadius: 9, padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <X style={{ width: 17, height: 17, color: "#6b7280" }} />
            </button>
          </div>
        </div>

        {/* ── Área scrollable ── */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "20px 12px", background: "#e2e8f0" }}>
          {loadingConfig ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
              <Loader2 style={{ width: 32, height: 32, color: "#607eaa", animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <>
              {/* Aviso sin datos empresa */}
              {!config?.empresa_nombre && (
                <div style={{ maxWidth: 794 * scale, margin: "0 auto 14px", background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <div style={{ flex: 1, fontSize: 12 }}>
                    <strong>Configura los datos de tu empresa</strong> — aparecerán en la cabecera de la factura.
                  </div>
                  <button onClick={() => setShowConfig(true)}
                    style={{ background: "#607eaa", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", fontWeight: 600, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                    Configurar
                  </button>
                </div>
              )}

              {/* Contenedor escalado */}
              <div
                ref={wrapRef}
                style={{
                  width: Math.round(794 * scale),
                  margin: "0 auto",
                  overflow: "hidden",
                  borderRadius: 4,
                  boxShadow: "0 4px 6px rgba(0,0,0,0.07), 0 20px 60px rgba(0,0,0,0.18)",
                }}
              >
                <div style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  width: 794,
                }}>
                  <InvoiceDocument factura={factura} obra={obra} config={config} pago={pago} />
                </div>
              </div>

              {/* Nota debajo */}
              <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#94a3b8" }}>
                {scale < 1
                  ? `Vista escalada ${Math.round(scale * 100)}% — el PDF descargado es A4 completo`
                  : "Formato A4 · Listo para imprimir o enviar al cliente"}
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
