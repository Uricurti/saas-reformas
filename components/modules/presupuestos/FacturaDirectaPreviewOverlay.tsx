"use client";

import { useState, useEffect } from "react";
import { X, Download, Loader2, CheckCircle2 } from "lucide-react";
import { getTenantConfig } from "@/lib/insforge/database";
import type { TenantConfig } from "@/lib/insforge/database";
import { FacturaDirectaDocumentExport } from "./FacturaDirectaModal";
import type { FacturaDirectaData } from "./FacturaDirectaCard";

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

/**
 * Overlay de previsualización de factura directa — sin la UI de card.
 * Usado desde la página "Todas las facturas".
 */
export function FacturaDirectaPreviewOverlay({
  factura,
  tenantId,
  onClose,
  gdrive_url: initialDriveUrl,
  onDriveUploaded,
}: {
  factura: FacturaDirectaData;
  tenantId: string;
  onClose: () => void;
  gdrive_url?: string | null;
  onDriveUploaded?: (url: string) => void;
}) {
  const [config, setConfig]       = useState<TenantConfig | null>(null);
  const [downloading, setDownloading] = useState(false);

  // ── Estado Drive upload
  const [driveState,       setDriveState]       = useState<"idle" | "selecting" | "uploading" | "done" | "error">(initialDriveUrl ? "done" : "idle");
  const [driveUrl,         setDriveUrl]         = useState<string | null>(initialDriveUrl ?? null);
  const [driveError,       setDriveError]       = useState<string | null>(null);
  const [driveActividad,   setDriveActividad]   = useState("REFORMAS");
  const [driveSubInmueble, setDriveSubInmueble] = useState("");

  useEffect(() => {
    getTenantConfig(tenantId).then(setConfig);
  }, [tenantId]);

  const formaPago = (factura.pagos ?? [])
    .sort((a, b) => a.orden - b.orden)
    .map((p) => ({ concepto: p.concepto, porcentaje: p.porcentaje }));

  const docId = `fac-overlay-${factura.id}`;

  async function handleDownload() {
    setDownloading(true);
    await new Promise((r) => setTimeout(r, 300));
    try {
      const html2pdf = (await import("html2pdf.js" as any)).default;
      const element  = document.getElementById(docId);
      if (!element) { setDownloading(false); return; }
      await html2pdf().set({
        margin: 0,
        filename: `${factura.numero_factura ?? "factura"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
        pagebreak: { mode: ["css", "legacy"], avoid: [".no-page-break"] },
      }).from(element).save();
    } catch (e) { console.error(e); }
    setDownloading(false);
  }

  async function handleDriveUpload() {
    const element = document.getElementById(docId);
    if (!element) return;
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
            pagebreak:   { mode: ["css", "legacy"], avoid: [".no-page-break"] },
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

      const res = await fetch("/api/gdrive/export-ingreso", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-api-secret": "obramat-sync-2026-secret" },
        body: JSON.stringify({
          factura_id:  factura.id,
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

  if (!config) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.85)" }}>
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", flexDirection: "column", background: "rgba(15,23,42,0.85)", backdropFilter: "blur(6px)" }}>
      {/* Barra superior */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1A1A2E" }}>{factura.numero_factura}</p>
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{factura.concepto}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* ── Botón subir a Drive ── */}
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

          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#607eaa", color: "#fff", border: "none", borderRadius: 9, padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            {downloading ? <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> : <Download style={{ width: 15, height: 15 }} />}
            Descargar PDF
          </button>
          <button
            onClick={onClose}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "#f3f4f6", border: "none", borderRadius: 8, cursor: "pointer" }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </div>
      {/* Documento */}
      <div style={{ flex: 1, overflow: "auto", padding: 24, display: "flex", justifyContent: "center" }}>
        <div style={{ boxShadow: "0 4px 32px rgba(0,0,0,0.4)", borderRadius: 4 }}>
          <FacturaDirectaDocumentExport
            idOverride={docId}
            numero={factura.numero_factura ?? "—"}
            fecha={factura.fecha_emision?.split("T")[0] ?? new Date().toISOString().split("T")[0]}
            concepto={factura.concepto}
            lineas={factura.lineas_partidas ?? []}
            porcentajeIva={factura.porcentaje_iva}
            formaPago={formaPago}
            clienteNombre={factura.cliente_nombre ?? ""}
            clienteNif={factura.cliente_nif ?? undefined}
            clienteEmail={factura.cliente_email ?? undefined}
            clienteTelefono={factura.cliente_telefono ?? undefined}
            facturacionNombre={factura.facturacion_nombre ?? undefined}
            facturacionNif={factura.facturacion_nif ?? undefined}
            facturacionDireccion={factura.facturacion_direccion ?? undefined}
            facturacionCp={factura.facturacion_cp ?? undefined}
            facturacionCiudad={factura.facturacion_ciudad ?? undefined}
            config={config}
          />
        </div>
      </div>
    </div>
  );
}
