"use client";

import { useEffect, useState, useRef } from "react";
import { getTenantConfig, type TenantConfig } from "@/lib/insforge/database";
import { EmpresaConfigModal } from "@/components/ui/EmpresaConfigModal";
import type { FacturaConPagos, Obra, Pago } from "@/types";
import { X, Download, Settings, Loader2, CheckCircle2 } from "lucide-react";

// ─── Icono Google Drive ───────────────────────────────────────────────────────
function GoogleDriveIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
    </svg>
  );
}
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
        padding: "36px 48px 28px",
        color: TEXT_DARK,
        fontSize: "12.5px",
        lineHeight: "1.5",
      }}
    >
      {/* ══ CABECERA ═══════════════════════════════════════════════ */}
      <div className="no-page-break" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        {/* Empresa */}
        <div style={{ maxWidth: 320 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: PRIMARY, letterSpacing: "-0.5px", lineHeight: 1.1, marginBottom: 8 }}>
            <span>{config?.empresa_nombre ?? "Tu Empresa"}</span>
          </div>
          {config?.empresa_cif && (
            <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 2 }}>
              <strong style={{ color: TEXT_MID }}>CIF:</strong><span style={{ marginLeft: 4 }}>{config.empresa_cif}</span>
            </div>
          )}
          {config?.empresa_direccion && (
            <div style={{ fontSize: 12, color: TEXT_SOFT }}><span>{config.empresa_direccion}</span></div>
          )}
          {config?.empresa_telefono && (
            <div style={{ fontSize: 12, color: TEXT_SOFT }}><span>{config.empresa_telefono}</span></div>
          )}
          {config?.empresa_email && (
            <div style={{ fontSize: 12, color: TEXT_SOFT }}><span>{config.empresa_email}</span></div>
          )}
        </div>

        {/* Número factura */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_FAINT, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
            <span>{isModoHito ? "Factura" : "Presupuesto"}</span>
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: TEXT_DARK, letterSpacing: "-1px", lineHeight: 1 }}>
            <span>{numeroFactura}</span>
          </div>
          {isModoHito && (
            <div style={{ fontSize: 11, color: TEXT_FAINT, marginTop: 4 }}>
              <span>Hito {pago!.orden} · {pago!.concepto} ({pago!.porcentaje}%)</span>
            </div>
          )}
          {factura.fecha_emision && (
            <div style={{ fontSize: 12, color: TEXT_SOFT, marginTop: 6 }}>
              <span>{fmtDate(factura.fecha_emision)}</span>
            </div>
          )}
          {!factura.fecha_emision && (
            <div style={{ fontSize: 12, color: TEXT_SOFT, marginTop: 6 }}>
              <span>{fmtDate(new Date().toISOString().split("T")[0])}</span>
            </div>
          )}
        </div>
      </div>

      {/* ══ LÍNEA DEGRADADA ════════════════════════════════════════ */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${PRIMARY}, #26bbec 50%, transparent)`, borderRadius: 99, marginBottom: 20 }} />

      {/* ══ CLIENTE + OBRA ══════════════════════════════════════════ */}
      <div className="no-page-break" style={{ display: "flex", gap: 24, marginBottom: 20 }}>
        <div style={{ flex: 1, padding: "12px 16px", background: "#f9fafb", borderRadius: 10, borderLeft: `3px solid ${PRIMARY}` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: TEXT_FAINT, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            <span>Facturar a</span>
          </div>
          {obra?.cliente_nombre ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_DARK, marginBottom: 4 }}>
                <span>{obra.facturacion_nombre ?? obra.cliente_nombre}</span>
              </div>
              {(obra.facturacion_nif || (obra as any).cliente_dni_nie_cif) && (
                <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 1 }}>
                  <strong style={{ color: TEXT_MID }}>
                    <span>{obra.facturacion_nif ? "CIF:" : "DNI/NIE/CIF:"}</span>
                  </strong>
                  <span style={{ marginLeft: 4 }}>{obra.facturacion_nif ?? (obra as any).cliente_dni_nie_cif}</span>
                </div>
              )}
              {(obra.facturacion_direccion || obra.direccion) && (
                <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 1 }}>
                  <span>{obra.facturacion_direccion ?? obra.direccion}</span>
                </div>
              )}
              {(obra.facturacion_cp || obra.facturacion_ciudad) && (
                <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 1 }}>
                  <span>{[obra.facturacion_cp, obra.facturacion_ciudad].filter(Boolean).join(" ")}</span>
                </div>
              )}
              {!obra.facturacion_cp && !obra.facturacion_ciudad && ((obra as any).codigo_postal || (obra as any).poblacion) && (
                <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 1 }}>
                  <span>{[(obra as any).codigo_postal, (obra as any).poblacion].filter(Boolean).join(" ")}</span>
                </div>
              )}
              {/* Email y teléfono */}
              {(obra as any).cliente_email && (
                <div style={{ fontSize: 12, color: TEXT_SOFT, marginBottom: 1 }}>{(obra as any).cliente_email}</div>
              )}
              {obra.cliente_telefono && (
                <div style={{ fontSize: 12, color: TEXT_SOFT }}>{obra.cliente_telefono}</div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: TEXT_FAINT, fontStyle: "italic" }}>Sin datos de cliente</div>
          )}
        </div>
        <div style={{ flex: 1, padding: "12px 16px", background: "#f9fafb", borderRadius: 10, borderLeft: `3px solid #26bbec` }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: TEXT_FAINT, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            <span>Obra / Proyecto</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_DARK, marginBottom: 2 }}><span>{obra?.nombre ?? "—"}</span></div>
          {obra?.direccion && <div style={{ fontSize: 12, color: TEXT_SOFT }}><span>{obra.direccion}</span></div>}
        </div>
      </div>

      {/* ══ CONCEPTO + DESCRIPCIÓN ══════════════════════════════════ */}
      <div style={{ background: BG_LIGHT, borderRadius: 12, padding: "14px 20px", marginBottom: 18 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: PRIMARY, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
          <span>{isModoHito ? `Hito ${pago!.orden} de ${factura.pagos.length} — ${pago!.concepto}` : "Concepto del presupuesto"}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: TEXT_DARK, letterSpacing: "-0.3px", lineHeight: 1.25, marginBottom: (factura.notas || (factura.lineas_partidas && factura.lineas_partidas.length > 0)) ? 12 : 0 }}>
          <span>{factura.concepto}</span>
        </div>
        {factura.notas && (
          <div style={{ fontSize: 12.5, color: TEXT_MID, lineHeight: 1.7, whiteSpace: "pre-wrap", marginTop: 8, paddingTop: 8, borderTop: "1px solid #dde6f5" }}>
            {factura.notas}
          </div>
        )}
        {/* ── Partidas del presupuesto ── */}
        {factura.lineas_partidas && factura.lineas_partidas.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #dde6f5" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: PRIMARY, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
              Alcance de los trabajos
            </div>
            {/* Agrupar por sección si las hay */}
            {(() => {
              const lineas = factura.lineas_partidas;
              const secciones = new Map<string, typeof lineas>();
              for (const l of lineas) {
                const key = l.seccion ?? "";
                if (!secciones.has(key)) secciones.set(key, []);
                secciones.get(key)!.push(l);
              }
              const tieneSecciones = secciones.size > 1 || (secciones.size === 1 && !secciones.has("") && !secciones.has(null as any));
              if (tieneSecciones) {
                return Array.from(secciones.entries()).map(([sec, items]) => {
                  const secLabel = sec ? sec.split(":").pop() ?? sec : "";
                  return (
                    <div key={sec} style={{ marginBottom: 10 }}>
                      {secLabel && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_MID, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {secLabel}
                        </div>
                      )}
                      {items.map((l, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 5, marginBottom: 2 }}>
                          <span style={{ fontSize: 10, color: PRIMARY, flexShrink: 0, marginTop: 2 }}>▸</span>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_DARK }}>{l.nombre_partida}</span>
                            {l.descripcion && (
                              <span style={{ fontSize: 10, color: TEXT_SOFT, marginLeft: 5 }}>{l.descripcion}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                });
              }
              return (
                <div style={{ columns: lineas.length > 8 ? 2 : 1, columnGap: 24 }}>
                  {lineas.map((l, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 5, marginBottom: 2 }}>
                      <span style={{ fontSize: 10, color: PRIMARY, flexShrink: 0, marginTop: 2 }}>▸</span>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_DARK }}>{l.nombre_partida}</span>
                        {l.descripcion && (
                          <span style={{ fontSize: 11, color: TEXT_SOFT, marginLeft: 6 }}>{l.descripcion}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ══ TABLA HITOS + TOTALES + IBAN — bloque que nunca se parte ══ */}
      <div className="no-page-break">

      {/* ── Tabla hitos ── */}
      <div style={{ marginBottom: 16 }}>
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

      {/* ── Totales ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
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

      {/* ── IBAN ── */}
      {isModoHito && (config as any)?.numero_cuenta && (
        <div style={{
          background: "#f0f9ff",
          border: "1.5px solid #bae6fd",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#0284c7", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
            Instrucciones de pago
          </div>
          <div style={{ fontSize: 12.5, color: TEXT_MID, lineHeight: 1.6 }}>
            Para abonar esta factura, realice una transferencia bancaria indicando el número de factura <strong style={{ color: TEXT_DARK }}>{numeroFactura}</strong> en el concepto.
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.06em" }}>IBAN:</span>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: TEXT_DARK, letterSpacing: "0.04em", fontFamily: "monospace" }}>
              {(config as any).numero_cuenta}
            </span>
          </div>
        </div>
      )}

      </div>{/* fin no-page-break */}

      {/* ══ FOOTER ════════════════════════════════════════════════ */}
      <div style={{ borderTop: "1.5px solid #EEF2F8", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
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
  facturaId, gdrive_url: initialDriveUrl, onDriveUploaded,
}: {
  factura: FacturaConPagos;
  obra: Obra | null;
  tenantId: string;
  pago?: Pago;
  onClose: () => void;
  /** Si se pasan estas props, aparece el botón "Subir a Drive" en la cabecera */
  facturaId?: string;
  gdrive_url?: string | null;
  onDriveUploaded?: (url: string) => void;
}) {
  const [config, setConfig]           = useState<TenantConfig | null>(null);
  const [showConfig, setShowConfig]   = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [scale, setScale]             = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);

  // ── Estado Drive upload
  const [driveState,    setDriveState]    = useState<"idle" | "selecting" | "uploading" | "done" | "error">(initialDriveUrl ? "done" : "idle");
  const [driveUrl,      setDriveUrl]      = useState<string | null>(initialDriveUrl ?? null);
  const [driveError,    setDriveError]    = useState<string | null>(null);
  const [driveActividad,    setDriveActividad]    = useState("REFORMAS");
  const [driveSubInmueble,  setDriveSubInmueble]  = useState("");

  async function handleDriveUpload() {
    const element = document.getElementById("invoice-doc");
    if (!element || !facturaId) return;
    setDriveState("uploading");
    setDriveError(null);
    try {
      const html2pdf = (await import("html2pdf.js" as any)).default;
      const blob: Blob = await new Promise((resolve, reject) => {
        html2pdf()
          .set({
            margin: 0,
            image:       { type: "jpeg", quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" },
            jsPDF:       { unit: "mm", format: "a4", orientation: "portrait", compress: true },
            pagebreak:   { mode: ["css", "legacy"], avoid: [".no-page-break", "table", "tr"] },
          })
          .from(element)
          .output("blob")
          .then(resolve)
          .catch(reject);
      });

      // Blob → base64
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const res  = await fetch("/api/gdrive/export-ingreso", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-api-secret": "obramat-sync-2026-secret" },
        body: JSON.stringify({
          factura_id:  facturaId,
          pdfBase64:   base64,
          actividad:   driveActividad,
          subInmueble: driveActividad === "FLIPPING HOUSE" ? driveSubInmueble : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.gdrive_url) {
        setDriveUrl(data.gdrive_url);
        setDriveState("done");
        onDriveUploaded?.(data.gdrive_url);
      } else {
        setDriveState("error");
        setDriveError(data.error ?? "Error al subir a Drive");
      }
    } catch (err: any) {
      setDriveState("error");
      setDriveError(err.message ?? "Error al generar o subir el PDF");
    }
  }

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
            avoid: [".no-page-break", "table", "tr"],
            before: [],
            after: [],
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
          <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
            {!loadingConfig && (
              <button onClick={() => setShowConfig(true)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "#f3f4f6", color: "#4A5568", border: "none", borderRadius: 9, padding: "8px 12px", fontWeight: 600, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                <Settings style={{ width: 14, height: 14 }} />
                <span style={{ display: "none" }} className="sm:block">Empresa</span>
              </button>
            )}

            {/* ── Botón subir a Drive (solo si se pasa facturaId) ── */}
            {facturaId && (
              <>
                {driveState === "done" && driveUrl && (
                  <a href={driveUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 9, padding: "8px 12px", fontWeight: 600, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}>
                    <CheckCircle2 style={{ width: 14, height: 14 }} />
                    <span>En Drive</span>
                  </a>
                )}
                {driveState === "uploading" && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 9, padding: "8px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                    <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                    Subiendo…
                  </span>
                )}
                {driveState === "error" && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 9, padding: "8px 12px", fontSize: 11, fontWeight: 600, maxWidth: 280, cursor: "pointer", whiteSpace: "nowrap" }}
                    title={driveError ?? ""}
                    onClick={() => { setDriveState("idle"); setDriveError(null); }}>
                    ⚠️ {(driveError ?? "Error").length > 40 ? (driveError ?? "Error").slice(0, 40) + "…" : (driveError ?? "Error")} — reintentar
                  </span>
                )}
                {driveState === "selecting" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <select value={driveActividad} onChange={e => { setDriveActividad(e.target.value); setDriveSubInmueble(""); }}
                      style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 12, color: "#1A1A2E", background: "#F8FAFC" }}>
                      <option value="REFORMAS">REFORMAS</option>
                      <option value="GESTIÓN">GESTIÓN</option>
                      <option value="FLIPPING HOUSE">FLIPPING HOUSE</option>
                    </select>
                    {driveActividad === "FLIPPING HOUSE" && (
                      <select value={driveSubInmueble} onChange={e => setDriveSubInmueble(e.target.value)}
                        style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 12, color: "#1A1A2E", background: "#F8FAFC" }}>
                        <option value="">Inmueble…</option>
                        <option value="Concepción Arenal">Concepción Arenal</option>
                        <option value="Torres i Bages 163 Terrassa">Torres i Bages 163 Terrassa</option>
                        <option value="Transversal">Transversal</option>
                      </select>
                    )}
                    <button onClick={handleDriveUpload}
                      disabled={driveActividad === "FLIPPING HOUSE" && !driveSubInmueble}
                      style={{ display: "flex", alignItems: "center", gap: 5, background: (driveActividad === "FLIPPING HOUSE" && !driveSubInmueble) ? "#e2e8f0" : "#1a73e8", color: (driveActividad === "FLIPPING HOUSE" && !driveSubInmueble) ? "#94a3b8" : "#fff", border: "none", borderRadius: 7, padding: "7px 12px", fontWeight: 700, fontSize: 12, cursor: (driveActividad === "FLIPPING HOUSE" && !driveSubInmueble) ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                      Subir
                    </button>
                    <button onClick={() => setDriveState("idle")}
                      style={{ background: "#f3f4f6", border: "none", borderRadius: 7, padding: "7px 9px", cursor: "pointer", fontSize: 12, color: "#6b7280" }}>
                      ✕
                    </button>
                  </div>
                )}
                {driveState === "idle" && (
                  <button onClick={() => setDriveState("selecting")}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 12px", fontWeight: 600, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                    <GoogleDriveIcon size={13} />
                    <span>Drive</span>
                  </button>
                )}
              </>
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
        <EmpresaConfigModal
          tenantId={tenantId}
          config={config}
          onClose={() => setShowConfig(false)}
          onSaved={(c) => setConfig(c)}
        />
      )}
    </>
  );
}
