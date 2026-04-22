"use client";

import { useEffect, useState, useRef } from "react";
import { getTenantConfig, type TenantConfig } from "@/lib/insforge/database";
import { EmpresaConfigModal } from "@/components/ui/EmpresaConfigModal";
import type { PresupuestoConLineas } from "@/types";
import { X, Download, Settings, Loader2 } from "lucide-react";
import { PresupuestoDocument } from "./PresupuestoDocument";

// PresupuestoDocument ya no lleva "use client" — es un componente de servidor puro.
// Se puede renderizar tanto en cliente (para la preview) como en servidor (para el PDF).

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

  async function handleDownload() {
    setDownloading(true);
    try {
      // El PDF lo genera Puppeteer en el servidor — renderizado perfecto con Chrome real.
      const res = await fetch(
        `/api/presupuestos/pdf?id=${presupuesto.id}&tenantId=${tenantId}`
      );
      if (!res.ok) throw new Error(`Error del servidor: ${res.status}`);

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `Presupuesto-${docTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error descargando PDF:", err);
      alert("No se pudo generar el PDF. Inténtalo de nuevo.");
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
