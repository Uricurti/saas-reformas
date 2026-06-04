"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import { getFacturasByObra, getObraById } from "@/lib/insforge/database";
import { PageHeader } from "@/components/ui/PageHeader";
import { Loader2, Search, X, FileText, Building2, Receipt, Eye } from "lucide-react";
import { InvoicePreview } from "@/components/modules/facturacion/InvoicePreview";
import { FacturaDirectaCard, type FacturaDirectaData } from "@/components/modules/presupuestos/FacturaDirectaCard";
import { FacturaDirectaPreviewOverlay } from "@/components/modules/presupuestos/FacturaDirectaPreviewOverlay";
import type { FacturaConPagos, Obra, Pago } from "@/types";

type FilaFactura = {
  tipo: "obra" | "directa";
  id: string;
  numero: string;
  fecha: string | null;
  concepto: string;
  cliente: string;
  obra_nombre: string | null;
  obra_id: string | null;
  importe_base: number;
  importe_iva: number;
  importe_total: number;
  estado: string;
  factura_id: string;
  pago_id: string | null;
  // Para directas: datos completos
  directa_data?: FacturaDirectaData;
};

function fmt(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${parseInt(day)}/${parseInt(m)}/${y}`;
}

const ESTADO_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  emitida:  { bg: "#EEF2F8", text: "#607eaa", label: "Emitida" },
  cobrada:  { bg: "#f0fdf4", text: "#16a34a", label: "Cobrada" },
};

export default function TodasLasFacturasPage() {
  const router   = useRouter();
  const isAdmin  = useIsAdmin();
  const tenantId = useTenantId();

  useEffect(() => { if (isAdmin === false) router.replace("/dashboard"); }, [isAdmin, router]);

  const [facturas, setFacturas]   = useState<FilaFactura[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [busqueda, setBusqueda]   = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"" | "obra" | "directa">("");
  const [estadoFiltro, setEstadoFiltro] = useState<"" | "emitida" | "cobrada">("");

  // Preview de factura de obra
  const [previewFactura, setPreviewFactura] = useState<FacturaConPagos | null>(null);
  const [previewObra, setPreviewObra]       = useState<Obra | null>(null);
  const [previewPago, setPreviewPago]       = useState<Pago | undefined>(undefined);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  // Preview de factura directa
  const [previewDirecta, setPreviewDirecta] = useState<FacturaDirectaData | null>(null);

  async function abrirFacturaObra(fila: FilaFactura) {
    if (!fila.obra_id) return;
    setLoadingPreview(fila.id);
    try {
      const [facturasRes, obraRes] = await Promise.all([
        getFacturasByObra(fila.obra_id),
        getObraById(fila.obra_id),
      ]);
      const factura = facturasRes.find((f: FacturaConPagos) => f.id === fila.factura_id);
      const pago    = factura?.pagos.find((p: Pago) => p.id === fila.pago_id) ?? factura?.pagos[0];
      if (factura) {
        setPreviewFactura(factura);
        setPreviewObra((obraRes.data as Obra) ?? null);
        setPreviewPago(pago);
      }
    } catch {/**/ }
    setLoadingPreview(null);
  }

  const cargar = useCallback(async () => {
    if (!tenantId) return;
    setCargando(true);
    try {
      const res = await fetch(`/api/facturacion/todas?tenantId=${tenantId}`);
      if (res.ok) setFacturas(await res.json());
    } catch { /**/ }
    setCargando(false);
  }, [tenantId]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = facturas.filter((f) => {
    if (tipoFiltro && f.tipo !== tipoFiltro) return false;
    if (estadoFiltro && f.estado !== estadoFiltro) return false;
    if (busqueda) {
      const b = busqueda.toLowerCase();
      return (
        f.numero?.toLowerCase().includes(b) ||
        f.concepto?.toLowerCase().includes(b) ||
        f.cliente?.toLowerCase().includes(b) ||
        f.obra_nombre?.toLowerCase().includes(b) ||
        false
      );
    }
    return true;
  });

  const totalBase  = filtradas.reduce((s, f) => s + f.importe_base, 0);
  const totalIva   = filtradas.reduce((s, f) => s + f.importe_iva, 0);
  const totalTotal = filtradas.reduce((s, f) => s + f.importe_total, 0);
  const cobradas   = filtradas.filter((f) => f.estado === "cobrada").reduce((s, f) => s + f.importe_total, 0);

  if (!isAdmin) return null;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Todas las facturas"
        subtitle={`${filtradas.length} factura${filtradas.length !== 1 ? "s" : ""} emitidas`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total facturado", value: fmt(totalTotal) + " €", color: "#1A1A2E" },
          { label: "Base imponible",  value: fmt(totalBase)  + " €", color: "#607eaa" },
          { label: "IVA total",       value: fmt(totalIva)   + " €", color: "#3b82f6" },
          { label: "Cobrado",         value: fmt(cobradas)   + " €", color: "#10b981" },
        ].map((k) => (
          <div key={k.label} className="card p-4 text-center">
            <p className="text-xs text-content-muted font-medium uppercase tracking-wide">{k.label}</p>
            <p className="text-xl font-black mt-1" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
            <input
              className="input pl-9 text-sm"
              placeholder="Buscar por número, concepto, cliente..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-content-muted" /></button>}
          </div>
          <select className="input text-sm py-2 w-36" value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as any)}>
            <option value="">Todos los tipos</option>
            <option value="obra">De obras</option>
            <option value="directa">Directas</option>
          </select>
          <select className="input text-sm py-2 w-36" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as any)}>
            <option value="">Todos los estados</option>
            <option value="emitida">Emitidas</option>
            <option value="cobrada">Cobradas</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-base font-bold text-content-primary mb-2">
            {busqueda || tipoFiltro || estadoFiltro ? "Sin resultados" : "Sin facturas emitidas"}
          </h3>
          <p className="text-sm text-content-secondary">
            {busqueda || tipoFiltro || estadoFiltro ? "Prueba con otros filtros." : "Las facturas emitidas aparecerán aquí."}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Cabecera tabla */}
          <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-4 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-bold text-content-muted uppercase tracking-wide">
            <span>Nº</span>
            <span>Concepto / Cliente</span>
            <span>Origen</span>
            <span className="text-right">Base</span>
            <span className="text-right">Total</span>
            <span>Estado</span>
          </div>

          {filtradas.map((f, i) => (
            <div
              key={f.id}
              className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-2 sm:gap-4 px-4 py-3 items-center border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
            >
              {/* Número */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: f.tipo === "directa" ? "#EEF2F8" : "#f0fdf4" }}>
                  {f.tipo === "directa"
                    ? <FileText className="w-3.5 h-3.5" style={{ color: "#607eaa" }} />
                    : <Building2 className="w-3.5 h-3.5" style={{ color: "#16a34a" }} />
                  }
                </div>
                <span className="font-bold text-sm text-content-primary whitespace-nowrap">{f.numero}</span>
              </div>

              {/* Concepto + cliente */}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-content-primary truncate">{f.concepto}</p>
                <p className="text-xs text-content-muted truncate">{f.cliente} {f.fecha ? `· ${fmtDate(f.fecha)}` : ""}</p>
              </div>

              {/* Origen */}
              <div className="min-w-0">
                {f.tipo === "directa" ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">Directa</span>
                ) : (
                  <p className="text-xs text-content-secondary truncate">
                    🏗️ {f.obra_nombre ?? "—"}
                  </p>
                )}
              </div>

              {/* Base */}
              <div className="text-right">
                <p className="text-xs text-content-muted">{fmt(f.importe_base)} €</p>
                <p className="text-xs text-content-muted">+IVA {fmt(f.importe_iva)} €</p>
              </div>

              {/* Total */}
              <div className="text-right">
                <p className="font-bold text-sm text-content-primary whitespace-nowrap">{fmt(f.importe_total)} €</p>
              </div>

              {/* Estado + Ver */}
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap"
                  style={{ background: ESTADO_COLOR[f.estado]?.bg ?? "#f3f4f6", color: ESTADO_COLOR[f.estado]?.text ?? "#6b7280" }}>
                  {ESTADO_COLOR[f.estado]?.label ?? f.estado}
                </span>
                <button
                  onClick={() => {
                    if (f.tipo === "directa" && f.directa_data) {
                      setPreviewDirecta(f.directa_data);
                    } else {
                      abrirFacturaObra(f);
                    }
                  }}
                  disabled={loadingPreview === f.id}
                  className="p-1.5 rounded-lg hover:bg-primary-light text-content-muted hover:text-primary transition-colors flex-shrink-0"
                  title="Ver factura"
                >
                  {loadingPreview === f.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}

          {/* Totales pie */}
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-2 sm:gap-4 px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="sm:col-span-3 text-xs font-bold text-content-muted uppercase tracking-wide">
              TOTAL ({filtradas.length} facturas)
            </div>
            <div className="text-right text-xs font-bold text-content-primary">{fmt(totalBase)} €</div>
            <div className="text-right text-sm font-black text-content-primary">{fmt(totalTotal)} €</div>
            <div />
          </div>
        </div>
      )}

      {/* Preview factura de obra */}
      {previewFactura && tenantId && (
        <InvoicePreview
          factura={previewFactura}
          obra={previewObra}
          tenantId={tenantId}
          pago={previewPago}
          onClose={() => { setPreviewFactura(null); setPreviewObra(null); setPreviewPago(undefined); }}
        />
      )}

      {/* Preview factura directa */}
      {previewDirecta && tenantId && (
        <FacturaDirectaPreviewOverlay
          factura={previewDirecta}
          tenantId={tenantId}
          onClose={() => setPreviewDirecta(null)}
        />
      )}
    </div>
  );
}
