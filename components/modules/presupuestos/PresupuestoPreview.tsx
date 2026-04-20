"use client";

import { useEffect, useState, useRef } from "react";
import { getTenantConfig, type TenantConfig } from "@/lib/insforge/database";
import { EmpresaConfigModal } from "@/components/ui/EmpresaConfigModal";
import type { PresupuestoConLineas } from "@/types";
import { X, Download, Settings, Loader2 } from "lucide-react";
import { PresupuestoDocument } from "./PresupuestoDocument";

export function PresupuestoPreview({
  presupuesto,
  tenantId,
  onClose,
}: {
  presupuesto: PresupuestoConLineas;
  tenantId: string;
  onClose: () => void;
}) {
  const [config, setConfig]             = useState<TenantConfig | null>(null);
  const [showConfig, setShowConfig]     = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [downloading, setDownloading]   = useState(false);
  const [scale, setScale]               = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const docTitle = `${presupuesto.numero}${presupuesto.version > 1 ? `-v${presupuesto.version}` : ""}`;

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

  /** Convierte una URL de SVG a PNG base64 usando un canvas temporal.
   *  html2canvas no renderiza SVGs correctamente (los gira/recorta).
   */
  async function svgToPngDataUrl(svgUrl: string, w = 360, h = 120): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("no ctx")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("svg load failed"));
      img.src = svgUrl;
    });
  }

  async function handleDownload() {
    const element = document.getElementById("presupuesto-doc");
    if (!element) return;
    setDownloading(true);
    try {
      // ── Paso 1: convertir todos los <img src="*.svg"> a PNG base64 ──────────
      // html2canvas/html2pdf tiene un bug conocido que rota o recorta SVGs.
      const svgImgs = Array.from(
        element.querySelectorAll("img")
      ).filter((img) => (img as HTMLImageElement).src.endsWith(".svg")) as HTMLImageElement[];

      const origSrcs = svgImgs.map((img) => img.getAttribute("src") ?? img.src);

      try {
        const pngUrl = await svgToPngDataUrl("/logo/4.svg", 360, 120);
        svgImgs.forEach((img) => {
          img.src = pngUrl;
          // Forzar dimensiones explícitas para que html2canvas las respete
          img.style.width  = img.style.width  || "auto";
          img.style.height = img.style.height || "auto";
        });
        // Dar tiempo al navegador a aplicar el cambio de src
        await new Promise((r) => setTimeout(r, 80));
      } catch (_) {
        // Si falla la conversión, continuamos con el SVG original
      }

      // ── Paso 2: generar PDF ───────────────────────────────────────────────
      const html2pdf = (await import("html2pdf.js" as any)).default;
      await html2pdf()
        .set({
          margin: 0,
          filename: `Presupuesto-${docTitle}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: "#ffffff",
            imageTimeout: 15000,
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
          pagebreak: { mode: ["css", "legacy"], avoid: [".no-page-break"] },
        })
        .from(element)
        .save();

      // ── Paso 3: restaurar src originales ─────────────────────────────────
      svgImgs.forEach((img, i) => { img.src = origSrcs[i]; });
    } catch (err) {
      console.error("Error generando PDF presupuesto:", err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", flexDirection: "column", background: "rgba(15,23,42,0.80)", backdropFilter: "blur(6px)" }}>

        {/* ── Barra superior ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#fff", borderBottom: "1px solid #e5e7eb", flexShrink: 0, minWidth: 0 }}>

          {/* Botón cerrar — siempre visible, a la izquierda en móvil */}
          <button
            onClick={onClose}
            style={{ background: "#f3f4f6", border: "none", borderRadius: 9, padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
          >
            <X style={{ width: 18, height: 18, color: "#6b7280" }} />
          </button>

          {/* Título — ocupa el espacio disponible */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A2E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Presupuesto {docTitle}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {presupuesto.cliente_nombre}{presupuesto.cliente_apellidos ? " " + presupuesto.cliente_apellidos : ""}
            </div>
          </div>

          {/* Acciones — icono solo en móvil, texto en desktop */}
          {!loadingConfig && (
            <button
              onClick={() => setShowConfig(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "#f3f4f6", color: "#4A5568", border: "none", borderRadius: 9, padding: "8px 10px", fontWeight: 600, fontSize: 12, cursor: "pointer", flexShrink: 0 }}
              title="Configurar empresa"
            >
              <Settings style={{ width: 15, height: 15 }} />
              <span style={{ display: "none" }} className="sm-inline">Empresa</span>
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{ display: "flex", alignItems: "center", gap: 5, background: downloading ? "#94a3b8" : "#607eaa", color: "#fff", border: "none", borderRadius: 9, padding: "8px 12px", fontWeight: 700, fontSize: 12, cursor: downloading ? "default" : "pointer", flexShrink: 0, whiteSpace: "nowrap" }}
          >
            {downloading
              ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
              : <Download style={{ width: 14, height: 14 }} />}
            <span>{downloading ? "..." : "PDF"}</span>
          </button>
        </div>

        {/* ── Área scrollable ── */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "20px 12px", background: "#e2e8f0" }}>
          {loadingConfig ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
              <Loader2 style={{ width: 32, height: 32, color: "#607eaa", animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <>
              {!config?.empresa_nombre && (
                <div style={{ maxWidth: 794 * scale, margin: "0 auto 14px", background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <div style={{ flex: 1, fontSize: 12 }}>
                    <strong>Configura los datos de tu empresa</strong> — aparecerán en la cabecera del presupuesto.
                  </div>
                  <button
                    onClick={() => setShowConfig(true)}
                    style={{ background: "#607eaa", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", fontWeight: 600, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Configurar
                  </button>
                </div>
              )}

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
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: 794 }}>
                  <PresupuestoDocument presupuesto={presupuesto} config={config} />
                </div>
              </div>

              <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#94a3b8" }}>
                {scale < 1
                  ? `Vista escalada ${Math.round(scale * 100)}% — el PDF descargado es A4 completo`
                  : "Formato A4 · Listo para imprimir o enviar al cliente"}
              </div>
            </>
          )}
        </div>
      </div>

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
