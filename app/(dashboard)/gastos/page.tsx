"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import { getMediaUrl } from "@/lib/insforge/storage";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  ShoppingBag, TrendingDown, Calendar,
  ChevronDown, Store, FileText, Loader2, RefreshCw,
  Receipt, Eye, Download, X, ExternalLink, FolderOpen,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Gasto {
  id: string;
  numero_factura: string;
  proveedor: string;
  fecha_factura: string;
  concepto: string;
  importe_base: number;
  porcentaje_iva: number;
  importe_iva: number;
  importe_total: number;
  origen: string;
  mes: number;
  anio: number;
  obra_id: string | null;
  pdf_url: string | null;
  gdrive_url: string | null;
}

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const P   = "#607eaa";
const PL  = "#EEF2F8";
const ACC = "#26bbec";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function fmt(n: number) { return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtEuro(n: number) { return `${fmt(n)} €`; }
function fmtFecha(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor, accent }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string; accent?: string;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "14px 16px",
      boxShadow: "0 1px 3px rgba(96,126,170,0.08), 0 1px 2px rgba(96,126,170,0.04)",
      borderTop: `3px solid ${accent ?? "transparent"}`,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "#4A5568", fontWeight: 500, letterSpacing: "0.02em" }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon style={{ width: 17, height: 17, color: iconColor }} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#1A1A2E", letterSpacing: "-0.5px", lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Modal visor de PDF ────────────────────────────────────────────────────────
function PDFModal({ gasto, onClose }: { gasto: Gasto; onClose: () => void }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gasto.pdf_url) { setError("Sin PDF almacenado"); setLoading(false); return; }
    getMediaUrl(gasto.pdf_url)
      .then(url => { setPdfUrl(url); setLoading(false); })
      .catch(() => { setError("No se pudo cargar el PDF"); setLoading(false); });
  }, [gasto.pdf_url]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", flexDirection: "column",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", background: "#1A1A2E", flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
            Factura {gasto.numero_factura}
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>
            {fmtFecha(gasto.fecha_factura)} · {fmtEuro(gasto.importe_total)} IVA
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {pdfUrl && (
            <a
              href={pdfUrl}
              download={`${gasto.numero_factura}.pdf`}
              style={{
                padding: "6px 12px", borderRadius: 8, background: `${ACC}20`,
                color: ACC, fontSize: 12, fontWeight: 600, textDecoration: "none",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <Download style={{ width: 13, height: 13 }} />
              Descargar
            </a>
          )}
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "6px 12px", borderRadius: 8, background: "#ffffff15",
                color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <ExternalLink style={{ width: 13, height: 13 }} />
              Nueva pestaña
            </a>
          )}
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: "none",
              background: "#ffffff15", color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      {/* PDF viewer */}
      <div style={{ flex: 1, overflow: "hidden", background: "#2d2d2d" }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <Loader2 style={{ width: 32, height: 32, color: ACC, animation: "spin 1s linear infinite" }} />
          </div>
        )}
        {error && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#94A3B8", gap: 12 }}>
            <FileText style={{ width: 48, height: 48, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>{error}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              El PDF se descargará con el próximo sync del bookmarklet
            </div>
          </div>
        )}
        {pdfUrl && !loading && (
          <iframe
            src={pdfUrl}
            style={{ width: "100%", height: "100%", border: "none" }}
            title={`Factura ${gasto.numero_factura}`}
          />
        )}
      </div>
    </div>
  );
}

// ─── Botón Google Drive (3 estados) ────────────────────────────────────────────
const GD_GREEN  = "#1a73e8";  // azul Drive
const GD_OK     = "#10b981";  // verde "subido"

function BtnDrive({ g, onExported }: { g: Gasto; onExported: (id: string, url: string) => void }) {
  const [state, setState] = useState<"idle"|"uploading"|"done">(g.gdrive_url ? "done" : "idle");

  // Si llega nueva data desde arriba (ej. refresh), sincronizar
  useEffect(() => { if (g.gdrive_url) setState("done"); }, [g.gdrive_url]);

  if (state === "done" && g.gdrive_url) {
    return (
      <a
        href={g.gdrive_url}
        target="_blank"
        rel="noopener noreferrer"
        title="Ver en Google Drive"
        style={{
          width: 32, height: 32, borderRadius: 8, border: "none",
          background: `${GD_OK}18`, color: GD_OK,
          display: "flex", alignItems: "center", justifyContent: "center",
          textDecoration: "none", flexShrink: 0,
        }}
      >
        <FolderOpen style={{ width: 15, height: 15 }} />
      </a>
    );
  }

  if (state === "uploading") {
    return (
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${GD_GREEN}15`, color: GD_GREEN,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  // idle — solo si tiene PDF
  if (!g.pdf_url) return null;

  return (
    <button
      title="Subir a Google Drive"
      onClick={async () => {
        setState("uploading");
        try {
          const res = await fetch("/api/gdrive/export", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-secret": "obramat-sync-2026-secret" },
            body: JSON.stringify({
              facturas: [{ id: g.id, numero: g.numero_factura, pdf_url: g.pdf_url, mes: g.mes, anio: g.anio }],
              rootFolderId: "auto",
            }),
          });
          const json = await res.json();
          const r = json.resultados?.[0];
          if (r?.ok && r.driveUrl) {
            setState("done");
            onExported(g.id, r.driveUrl);
          } else {
            setState("idle");
            alert(`Error: ${r?.error ?? json.error ?? "Sin respuesta"}`);
          }
        } catch (e: any) {
          setState("idle");
          alert(`Error: ${e.message}`);
        }
      }}
      style={{
        width: 32, height: 32, borderRadius: 8, border: "none",
        background: "#F0F4FF", color: GD_GREEN,
        cursor: "pointer", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.15s",
      }}
    >
      <FolderOpen style={{ width: 15, height: 15 }} />
    </button>
  );
}

// ─── Fila de gasto ─────────────────────────────────────────────────────────────
function FilaGasto({ g, onVerPDF, onDriveExported }: {
  g: Gasto;
  onVerPDF: (g: Gasto) => void;
  onDriveExported: (id: string, url: string) => void;
}) {
  const storeColor = g.proveedor === "Obramat" ? "#E8472C" : P;
  const tienePDF = !!g.pdf_url;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 14px", borderBottom: "1px solid #F1F5F9", gap: 10,
    }}>
      {/* Icono + info */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: `${storeColor}15`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Store style={{ width: 16, height: 16, color: storeColor }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {g.numero_factura}
          </div>
          <div style={{ fontSize: 11, color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {g.concepto.replace(/^Materiales construcción — /, "")}
          </div>
        </div>
      </div>

      {/* Derecha: fecha + importe + botones */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E" }}>{fmtEuro(g.importe_total)}</div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>{fmtFecha(g.fecha_factura)}</div>
        </div>

        {/* Botón PDF */}
        <button
          onClick={() => tienePDF ? onVerPDF(g) : window.open("https://www.obramat.es/mi-cuenta/0/customer/invoices/", "_blank")}
          title={tienePDF ? "Ver factura PDF" : "Sin PDF — clic para ir a Obramat y re-sincronizar"}
          style={{
            width: 32, height: 32, borderRadius: 8, border: "none",
            background: tienePDF ? `${ACC}18` : "#FFF3E0",
            color: tienePDF ? ACC : "#F59E0B",
            cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
          }}
        >
          {tienePDF ? <Eye style={{ width: 15, height: 15 }} /> : <Download style={{ width: 15, height: 15 }} />}
        </button>

        {/* Botón Google Drive */}
        <BtnDrive g={g} onExported={onDriveExported} />
      </div>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function GastosPage() {
  const isAdmin  = useIsAdmin();
  const tenantId = useTenantId();

  const now      = new Date();
  const [anio,   setAnio]   = useState(now.getFullYear());
  const [mesIdx, setMesIdx] = useState(now.getMonth());
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [gastoVisor, setGastoVisor] = useState<Gasto | null>(null);

  useEffect(() => { if (tenantId) cargar(); }, [tenantId, mesIdx, anio]);

  async function cargar() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/gastos/list?tenantId=${tenantId}&mes=${mesIdx + 1}&anio=${anio}`
      );
      if (res.ok) {
        const data = await res.json();
        setGastos(Array.isArray(data) ? data : []);
      } else {
        setGastos([]);
      }
    } catch {
      setGastos([]);
    }
    setLoading(false);
  }

  const gastosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return gastos;
    const b = busqueda.toLowerCase();
    return gastos.filter(g =>
      g.numero_factura.toLowerCase().includes(b) ||
      g.concepto.toLowerCase().includes(b) ||
      g.proveedor.toLowerCase().includes(b)
    );
  }, [gastos, busqueda]);

  const totalIva    = gastosFiltrados.reduce((s, g) => s + g.importe_total, 0);
  const totalBase   = gastosFiltrados.reduce((s, g) => s + g.importe_base,  0);
  const totalIvaAmt = gastosFiltrados.reduce((s, g) => s + g.importe_iva,   0);
  const numFacturas = gastosFiltrados.length;
  const conPDF      = gastosFiltrados.filter(g => g.pdf_url).length;

  const porTienda = useMemo(() => {
    const map: Record<string, number> = {};
    gastosFiltrados.forEach(g => {
      const t = g.concepto.replace(/^Materiales construcción — /, "") || g.proveedor;
      map[t] = (map[t] ?? 0) + g.importe_total;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [gastosFiltrados]);

  const handleVerPDF = useCallback((g: Gasto) => {
    if (g.pdf_url) setGastoVisor(g);
  }, []);

  // Actualiza gdrive_url localmente cuando se exporta a Drive (sin recargar)
  const handleDriveExported = useCallback((id: string, driveUrl: string) => {
    setGastos(prev => prev.map(g => g.id === id ? { ...g, gdrive_url: driveUrl } : g));
  }, []);

  if (!isAdmin) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>
        Solo los administradores pueden ver los gastos.
      </div>
    );
  }

  return (
    <>
      {/* ── Visor PDF (modal fullscreen) ── */}
      {gastoVisor && (
        <PDFModal gasto={gastoVisor} onClose={() => setGastoVisor(null)} />
      )}

      <div style={{ padding: "16px", maxWidth: 900, margin: "0 auto", paddingBottom: 80 }}>
        <PageHeader
          title="Gastos"
          subtitle={`${numFacturas} factura${numFacturas !== 1 ? "s" : ""} · ${MESES[mesIdx]} ${anio}`}
        />

        {/* ── Filtros ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <select
              value={mesIdx}
              onChange={e => setMesIdx(Number(e.target.value))}
              style={{
                appearance: "none", padding: "7px 28px 7px 12px",
                borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff",
                fontSize: 13, fontWeight: 500, color: "#1A1A2E", cursor: "pointer",
              }}
            >
              {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <ChevronDown style={{ width: 14, height: 14, color: "#94A3B8", position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          </div>
          <div style={{ position: "relative" }}>
            <select
              value={anio}
              onChange={e => setAnio(Number(e.target.value))}
              style={{
                appearance: "none", padding: "7px 28px 7px 12px",
                borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff",
                fontSize: 13, fontWeight: 500, color: "#1A1A2E", cursor: "pointer",
              }}
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown style={{ width: 14, height: 14, color: "#94A3B8", position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          </div>
          <button
            onClick={cargar}
            style={{
              padding: "7px 12px", borderRadius: 10, border: "1px solid #E2E8F0",
              background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              fontSize: 13, color: "#64748B",
            }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <input
          type="search"
          placeholder="Buscar por número, tienda…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{
            width: "100%", padding: "9px 14px", borderRadius: 10,
            border: "1px solid #E2E8F0", fontSize: 13, marginBottom: 16,
            background: "#fff", color: "#1A1A2E", boxSizing: "border-box",
          }}
        />

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 style={{ width: 28, height: 28, color: P, animation: "spin 1s linear infinite" }} />
          </div>
        ) : (
          <>
            {/* ── KPIs ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
              <KpiCard label="Total IVA" value={fmtEuro(totalIva)} sub={`${numFacturas} facturas`} icon={TrendingDown} iconBg={`${ACC}20`} iconColor={ACC} accent={ACC} />
              <KpiCard label="Base imponible" value={fmtEuro(totalBase)} sub="sin IVA" icon={FileText} iconBg={PL} iconColor={P} accent={P} />
              <KpiCard label="IVA soportado" value={fmtEuro(totalIvaAmt)} sub="deducible" icon={Receipt} iconBg="#FFF3E0" iconColor="#F59E0B" accent="#F59E0B" />
              <KpiCard label="PDFs" value={`${conPDF}/${numFacturas}`} sub="disponibles" icon={Eye} iconBg="#F0FDF4" iconColor="#10b981" accent="#10b981" />
            </div>

            {/* ── Por tienda ── */}
            {porTienda.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 16, boxShadow: "0 1px 3px rgba(96,126,170,0.08)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Por tienda
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {porTienda.map(([tienda, total]) => (
                    <div key={tienda} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 13, color: "#1A1A2E", flex: 1, fontWeight: 500 }}>{tienda}</div>
                      <div style={{ flex: 2, height: 6, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${P}, ${ACC})`, width: `${(total / totalIva) * 100}%`, transition: "width 0.4s ease" }} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A2E", minWidth: 80, textAlign: "right" }}>{fmtEuro(total)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Lista de facturas ── */}
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(96,126,170,0.08)", overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>
                  Facturas — {MESES[mesIdx]} {anio}
                </span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {conPDF > 0 && (
                    <span style={{ fontSize: 11, background: "#F0FDF4", color: "#10b981", borderRadius: 8, padding: "2px 8px", fontWeight: 600 }}>
                      {conPDF} PDFs
                    </span>
                  )}
                  <span style={{ fontSize: 11, background: PL, color: P, borderRadius: 8, padding: "2px 8px", fontWeight: 600 }}>
                    {numFacturas}
                  </span>
                </div>
              </div>

              {gastosFiltrados.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>
                  <ShoppingBag style={{ width: 32, height: 32, margin: "0 auto 8px", opacity: 0.4 }} />
                  <div style={{ fontSize: 14 }}>
                    {busqueda ? "Sin resultados" : `No hay gastos para ${MESES[mesIdx]} ${anio}`}
                  </div>
                  {!busqueda && (
                    <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>
                      Usa el bookmarklet de Obramat para importar las facturas del mes
                    </div>
                  )}
                </div>
              ) : (
                gastosFiltrados.map(g => <FilaGasto key={g.id} g={g} onVerPDF={handleVerPDF} onDriveExported={handleDriveExported} />)
              )}
            </div>

            {/* ── Info sync ── */}
            <div style={{ marginTop: 14, padding: "10px 14px", background: `${ACC}10`, borderRadius: 10, border: `1px solid ${ACC}30`, display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar style={{ width: 15, height: 15, color: ACC, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#64748B" }}>
                {conPDF < numFacturas
                  ? `${numFacturas - conPDF} facturas sin PDF — re-sincroniza con el bookmarklet para descargarlos`
                  : "Todos los PDFs disponibles · usa el bookmarklet al inicio de cada mes"
                }
              </span>
            </div>
          </>
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </>
  );
}
