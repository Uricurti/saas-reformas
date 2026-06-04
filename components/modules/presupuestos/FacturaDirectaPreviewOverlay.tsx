"use client";

import { useState, useEffect } from "react";
import { X, Download, Loader2 } from "lucide-react";
import { getTenantConfig } from "@/lib/insforge/database";
import type { TenantConfig } from "@/lib/insforge/database";
import { FacturaDirectaDocumentExport } from "./FacturaDirectaModal";
import type { FacturaDirectaData } from "./FacturaDirectaCard";

/**
 * Overlay de previsualización de factura directa — sin la UI de card.
 * Usado desde la página "Todas las facturas".
 */
export function FacturaDirectaPreviewOverlay({
  factura,
  tenantId,
  onClose,
}: {
  factura: FacturaDirectaData;
  tenantId: string;
  onClose: () => void;
}) {
  const [config, setConfig]       = useState<TenantConfig | null>(null);
  const [downloading, setDownloading] = useState(false);

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
        <div style={{ display: "flex", gap: 8 }}>
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
