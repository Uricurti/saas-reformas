"use client";

import { useState } from "react";
import { Download, Loader2, FileText, Trash2, Pencil } from "lucide-react";
import { getTenantConfig } from "@/lib/insforge/database";
import type { TenantConfig } from "@/lib/insforge/database";
import { FacturaDirectaModal } from "./FacturaDirectaModal";

// Re-usa el documento del modal — lo importamos de forma lazy
import dynamic from "next/dynamic";
const FacturaDirectaDocument = dynamic(
  () => import("./FacturaDirectaModal").then((m) => m.FacturaDirectaDocumentExport),
  { ssr: false }
);

export type FacturaDirectaData = {
  id: string;
  numero_factura: string;
  fecha_emision: string | null;
  concepto: string;
  importe_total: number;
  porcentaje_iva: number;
  lineas_partidas: any[];
  cliente_nombre: string | null;
  cliente_nif: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
  facturacion_nombre: string | null;
  facturacion_nif: string | null;
  facturacion_direccion: string | null;
  facturacion_cp: string | null;
  facturacion_ciudad: string | null;
  pagos: { concepto: string; porcentaje: number; orden: number }[];
  created_at: string;
};

function fmt(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    const [y, m, day] = d.split("T")[0].split("-");
    return `${parseInt(day)}/${parseInt(m)}/${y}`;
  } catch { return d; }
}

export function FacturaDirectaCard({
  factura,
  tenantId,
  onEliminar,
  onEdited,
}: {
  factura: FacturaDirectaData;
  tenantId: string;
  onEliminar: (id: string) => void;
  onEdited?: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [showDoc, setShowDoc] = useState(false);
  const [showEditar, setShowEditar] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    let cfg = config;
    if (!cfg) {
      cfg = await getTenantConfig(tenantId);
      setConfig(cfg);
    }
    setShowDoc(true);
    // Esperar a que el DOM renderice el documento
    await new Promise((r) => setTimeout(r, 400));
    try {
      const html2pdf = (await import("html2pdf.js" as any)).default;
      const element = document.getElementById(`fac-dir-${factura.id}`);
      if (!element) { setDownloading(false); setShowDoc(false); return; }
      await html2pdf().set({
        margin: 0,
        filename: `${factura.numero_factura ?? "factura"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
        pagebreak: { mode: ["css", "legacy"], avoid: [".no-page-break"] },
      }).from(element).save();
    } catch (e) { console.error(e); }
    setShowDoc(false);
    setDownloading(false);
  }

  const formaPago = factura.pagos
    .sort((a, b) => a.orden - b.orden)
    .map((p) => ({ concepto: p.concepto, porcentaje: p.porcentaje }));

  const ivaImporte = Math.round(factura.importe_total * factura.porcentaje_iva / 100 * 100) / 100;
  const totalConIva = Math.round((factura.importe_total + ivaImporte) * 100) / 100;

  return (
    <>
      <div className="card p-4 flex items-center gap-4">
        {/* Icono */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#EEF2F8" }}>
          <FileText className="w-5 h-5" style={{ color: "#607eaa" }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-content-primary text-sm">{factura.numero_factura ?? "—"}</span>
            <span className="text-xs text-content-muted">{fmtDate(factura.fecha_emision)}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">Factura directa</span>
          </div>
          <p className="text-sm text-content-secondary truncate mt-0.5">{factura.concepto}</p>
          {factura.cliente_nombre && (
            <p className="text-xs text-content-muted truncate">
              {factura.facturacion_nombre ?? factura.cliente_nombre}
              {(factura.facturacion_nif ?? factura.cliente_nif) && ` · ${factura.facturacion_nif ?? factura.cliente_nif}`}
            </p>
          )}
        </div>

        {/* Importe */}
        <div className="text-right flex-shrink-0">
          <p className="font-black text-content-primary">{fmt(totalConIva)} €</p>
          <p className="text-xs text-content-muted">IVA {factura.porcentaje_iva}% inc.</p>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: "#EEF2F8", color: "#607eaa" }}
            title="Descargar PDF"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF
          </button>
          <button
            onClick={() => setShowEditar(true)}
            className="p-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 text-content-muted transition-colors"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { if (confirm(`¿Eliminar la factura ${factura.numero_factura}?`)) onEliminar(factura.id); }}
            className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-content-muted transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal de edición */}
      {showEditar && (
        <FacturaDirectaModal
          tenantId={tenantId}
          initialData={{
            id: factura.id,
            numero_factura: factura.numero_factura,
            fecha_emision: factura.fecha_emision,
            concepto: factura.concepto,
            porcentaje_iva: factura.porcentaje_iva,
            lineas_partidas: factura.lineas_partidas ?? [],
            cliente_nombre: factura.cliente_nombre,
            cliente_nif: factura.cliente_nif,
            cliente_email: factura.cliente_email,
            cliente_telefono: factura.cliente_telefono,
            facturacion_nombre: factura.facturacion_nombre,
            facturacion_nif: factura.facturacion_nif,
            facturacion_direccion: factura.facturacion_direccion,
            facturacion_cp: factura.facturacion_cp,
            facturacion_ciudad: factura.facturacion_ciudad,
            pagos: factura.pagos,
          }}
          onClose={() => setShowEditar(false)}
          onCreated={() => { setShowEditar(false); onEdited?.(); }}
        />
      )}

      {/* Documento oculto para PDF */}
      {showDoc && config && (
        <div style={{ position: "fixed", left: "-9999px", top: 0, pointerEvents: "none", zIndex: -1 }}>
          <FacturaDirectaDocument
            idOverride={`fac-dir-${factura.id}`}
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
      )}
    </>
  );
}
