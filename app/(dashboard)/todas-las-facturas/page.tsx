"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import { getFacturasByObra, getObraById } from "@/lib/insforge/database";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Loader2, Search, X, FileText, Building2, Receipt, Eye,
  ChevronUp, ChevronDown, ChevronsUpDown, Download, Filter,
  Euro, TrendingUp, CheckCircle2, Clock, ChevronLeft, ChevronRight,
  SlidersHorizontal,
} from "lucide-react";

// ─── Icono Google Drive (SVG oficial) ────────────────────────────────────────
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
import { InvoicePreview } from "@/components/modules/facturacion/InvoicePreview";
import { FacturaDirectaPreviewOverlay } from "@/components/modules/presupuestos/FacturaDirectaPreviewOverlay";
import { type FacturaDirectaData } from "@/components/modules/presupuestos/FacturaDirectaCard";
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
  gdrive_url: string | null;
  directa_data?: FacturaDirectaData;
};

type SortField = "numero" | "fecha" | "cliente" | "importe_base" | "importe_total" | "estado";
type SortDir   = "asc" | "desc";

const PER_PAGE_OPTIONS = [15, 25, 50, 100];

// ─── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${meses[parseInt(m)-1]} ${y}`;
}
function fmtMes(d: string | null) {
  if (!d) return "—";
  const [y, m] = d.split("-");
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${meses[parseInt(m)-1]} ${y}`;
}

const ESTADO_CFG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  emitida: { bg: "#EEF2F8", text: "#607eaa", dot: "#607eaa", label: "Emitida" },
  cobrada: { bg: "#f0fdf4", text: "#16a34a", dot: "#16a34a", label: "Cobrada" },
};

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 opacity-30" />;
  return sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
}

// ─── Export CSV ─────────────────────────────────────────────────────────────────
function exportCSV(rows: FilaFactura[]) {
  const headers = ["Nº Factura","Fecha","Cliente","Concepto","Tipo","Origen","Base (€)","IVA (€)","Total (€)","Estado"];
  const lines = rows.map((f) => [
    f.numero ?? "",
    f.fecha ?? "",
    f.cliente ?? "",
    f.concepto ?? "",
    f.tipo === "directa" ? "Directa" : "Obra",
    f.obra_nombre ?? "—",
    fmt(f.importe_base),
    fmt(f.importe_iva),
    fmt(f.importe_total),
    ESTADO_CFG[f.estado]?.label ?? f.estado,
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `facturas_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── Botón Drive (subir / ver) ───────────────────────────────────────────────────
function BtnDriveIngreso({
  rowId, factura_id, fecha, gdrive_url: initialUrl, onUploaded,
}: {
  rowId: string;
  factura_id: string;
  fecha: string | null;
  gdrive_url: string | null;
  onUploaded: (rowId: string, url: string) => void;
}) {
  const [state, setState] = useState<"idle" | "uploading" | "done">(initialUrl ? "done" : "idle");
  const [url, setUrl]     = useState<string | null>(initialUrl);

  async function upload(e: React.MouseEvent) {
    e.stopPropagation();
    setState("uploading");
    const fechaCobro = fecha ?? new Date().toISOString().split("T")[0];
    try {
      const res  = await fetch("/api/gdrive/export-ingreso", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-secret": "obramat-sync-2026-secret" },
        body: JSON.stringify({ factura_id, fecha_cobro: fechaCobro }),
      });
      const data = await res.json();
      if (res.ok && data.gdrive_url) {
        setUrl(data.gdrive_url);
        setState("done");
        onUploaded(rowId, data.gdrive_url);
      } else {
        setState("idle");
        alert(data.error ?? "Error al subir a Drive");
      }
    } catch {
      setState("idle");
    }
  }

  if (state === "done" && url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" title="Ver en Google Drive"
        className="p-1.5 rounded-lg hover:bg-green-50 transition-colors flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}>
        <GoogleDriveIcon size={14} />
      </a>
    );
  }
  if (state === "uploading") {
    return (
      <span className="p-1.5 flex items-center justify-center">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
      </span>
    );
  }
  return (
    <button onClick={upload} title="Subir a Google Drive"
      className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center">
      <GoogleDriveIcon size={14} />
    </button>
  );
}

// ─── Chip de filtro activo ───────────────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-light text-primary border border-primary/20">
      {label}
      <button onClick={onRemove} className="hover:text-danger transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────────
export default function TodasLasFacturasPage() {
  const router   = useRouter();
  const isAdmin  = useIsAdmin();
  const tenantId = useTenantId();

  useEffect(() => { if (isAdmin === false) router.replace("/dashboard"); }, [isAdmin, router]);

  // ── Datos
  const [facturas, setFacturas] = useState<FilaFactura[]>([]);
  const [cargando, setCargando] = useState(true);

  // ── Filtros básicos
  const [busqueda,      setBusqueda]      = useState("");
  const [tipoFiltro,    setTipoFiltro]    = useState<"" | "obra" | "directa">("");
  const [estadoFiltro,  setEstadoFiltro]  = useState<"" | "emitida" | "cobrada">("");

  // ── Filtros avanzados
  const [mostrarAvanzados, setMostrarAvanzados] = useState(false);
  const [anioFiltro,    setAnioFiltro]    = useState("");
  const [mesFiltro,     setMesFiltro]     = useState("");
  const [fechaDesde,    setFechaDesde]    = useState("");
  const [fechaHasta,    setFechaHasta]    = useState("");
  const [importeMin,    setImporteMin]    = useState("");
  const [importeMax,    setImporteMax]    = useState("");

  // ── Ordenación
  const [sortField, setSortField] = useState<SortField>("fecha");
  const [sortDir,   setSortDir]   = useState<SortDir>("desc");

  // ── Paginación
  const [pagina,   setPagina]   = useState(1);
  const [porPagina, setPorPagina] = useState(25);

  // ── Previews
  const [previewFactura,  setPreviewFactura]  = useState<FacturaConPagos | null>(null);
  const [previewObra,     setPreviewObra]     = useState<Obra | null>(null);
  const [previewPago,     setPreviewPago]     = useState<Pago | undefined>(undefined);
  const [loadingPreview,  setLoadingPreview]  = useState<string | null>(null);
  const [previewDirecta,  setPreviewDirecta]  = useState<FacturaDirectaData | null>(null);

  const busquedaRef = useRef<HTMLInputElement>(null);

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
    } catch { /**/ }
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

  // Actualizar gdrive_url en local state tras subir
  const handleDriveUploaded = useCallback((rowId: string, url: string) => {
    setFacturas((prev) => prev.map((f) => f.id === rowId ? { ...f, gdrive_url: url } : f));
  }, []);

  // Reset página al cambiar filtros
  useEffect(() => { setPagina(1); }, [busqueda, tipoFiltro, estadoFiltro, anioFiltro, mesFiltro, fechaDesde, fechaHasta, importeMin, importeMax]);

  // ── Opciones de filtro dinámicas
  const aniosDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const f of facturas) if (f.fecha) set.add(f.fecha.slice(0, 4));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [facturas]);

  const mesesDisponibles = useMemo(() => {
    const set = new Map<string, string>();
    for (const f of facturas) {
      if (!f.fecha) continue;
      if (anioFiltro && !f.fecha.startsWith(anioFiltro)) continue;
      const key = f.fecha.slice(0, 7);
      if (!set.has(key)) set.set(key, fmtMes(f.fecha));
    }
    return Array.from(set.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [facturas, anioFiltro]);

  const clientesDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const f of facturas) if (f.cliente) set.add(f.cliente);
    return Array.from(set).sort();
  }, [facturas]);

  // ── Ordenación
  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  }

  // ── Filtrado + ordenación (todas las filas)
  const filtradas = useMemo(() => {
    const minVal = importeMin ? parseFloat(importeMin.replace(",", ".")) : null;
    const maxVal = importeMax ? parseFloat(importeMax.replace(",", ".")) : null;

    let lista = facturas.filter((f) => {
      if (tipoFiltro   && f.tipo    !== tipoFiltro)   return false;
      if (estadoFiltro && f.estado  !== estadoFiltro) return false;
      if (anioFiltro   && (!f.fecha || !f.fecha.startsWith(anioFiltro)))   return false;
      if (mesFiltro    && (!f.fecha || !f.fecha.startsWith(mesFiltro)))    return false;
      if (fechaDesde   && f.fecha   && f.fecha < fechaDesde)   return false;
      if (fechaHasta   && f.fecha   && f.fecha > fechaHasta)   return false;
      if (minVal !== null && f.importe_total < minVal) return false;
      if (maxVal !== null && f.importe_total > maxVal) return false;
      if (busqueda) {
        const b = busqueda.toLowerCase();
        return (
          f.numero?.toLowerCase().includes(b)     ||
          f.concepto?.toLowerCase().includes(b)   ||
          f.cliente?.toLowerCase().includes(b)    ||
          f.obra_nombre?.toLowerCase().includes(b)||
          (f.fecha ? fmtDate(f.fecha).toLowerCase().includes(b) : false)
        );
      }
      return true;
    });

    lista.sort((a, b) => {
      let va: any, vb: any;
      switch (sortField) {
        case "numero":
          va = parseInt(a.numero?.match(/(\d+)$/)?.[1] ?? "0", 10);
          vb = parseInt(b.numero?.match(/(\d+)$/)?.[1] ?? "0", 10);
          break;
        case "fecha":       va = a.fecha ?? ""; vb = b.fecha ?? ""; break;
        case "cliente":     va = a.cliente?.toLowerCase() ?? ""; vb = b.cliente?.toLowerCase() ?? ""; break;
        case "importe_base": va = a.importe_base; vb = b.importe_base; break;
        case "importe_total": va = a.importe_total; vb = b.importe_total; break;
        case "estado":      va = a.estado; vb = b.estado; break;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return lista;
  }, [facturas, tipoFiltro, estadoFiltro, anioFiltro, mesFiltro, fechaDesde, fechaHasta, importeMin, importeMax, busqueda, sortField, sortDir]);

  // ── KPIs (sobre todas las filtradas)
  const totalBase   = filtradas.reduce((s, f) => s + f.importe_base,  0);
  const totalIva    = filtradas.reduce((s, f) => s + f.importe_iva,   0);
  const totalTotal  = filtradas.reduce((s, f) => s + f.importe_total, 0);
  const cobradas    = filtradas.filter((f) => f.estado === "cobrada").reduce((s, f) => s + f.importe_total, 0);
  const pendiente   = totalTotal - cobradas;
  const tasaCobro   = totalTotal > 0 ? Math.round((cobradas / totalTotal) * 100) : 0;

  // ── Paginación
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginaReal   = Math.min(pagina, totalPaginas);
  const paginadas    = filtradas.slice((paginaReal - 1) * porPagina, paginaReal * porPagina);

  // ── Filtros activos (para mostrar chips)
  const hayFiltros = !!(busqueda || tipoFiltro || estadoFiltro || anioFiltro || mesFiltro || fechaDesde || fechaHasta || importeMin || importeMax);
  const nFiltrosAvanzados = [anioFiltro, mesFiltro, fechaDesde, fechaHasta, importeMin, importeMax].filter(Boolean).length;

  function limpiarTodo() {
    setBusqueda(""); setTipoFiltro(""); setEstadoFiltro("");
    setAnioFiltro(""); setMesFiltro("");
    setFechaDesde(""); setFechaHasta("");
    setImporteMin(""); setImporteMax("");
  }

  if (!isAdmin) return null;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-content-primary">Todas las facturas</h1>
          <p className="text-sm text-content-muted mt-0.5">
            {cargando ? "Cargando…" : `${filtradas.length} de ${facturas.length} facturas${hayFiltros ? " · filtradas" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(filtradas)}
            disabled={filtradas.length === 0}
            className="btn-ghost text-sm gap-1.5 disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            onClick={cargar}
            className="btn-ghost text-sm gap-1.5"
            title="Recargar datos"
          >
            <Loader2 className={`w-4 h-4 ${cargando ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Facturas",       value: String(filtradas.length), icon: Receipt,      color: "#1A1A2E", bg: "#f3f4f6" },
          { label: "Facturado",      value: fmt(totalTotal) + " €",   icon: Euro,         color: "#607eaa", bg: "#EEF2F8" },
          { label: "Base imponible", value: fmt(totalBase)  + " €",   icon: FileText,     color: "#374151", bg: "#f9fafb" },
          { label: "IVA total",      value: fmt(totalIva)   + " €",   icon: TrendingUp,   color: "#3b82f6", bg: "#eff6ff" },
          { label: "Cobrado",        value: fmt(cobradas)   + " €",   icon: CheckCircle2, color: "#16a34a", bg: "#f0fdf4" },
          { label: "Pendiente",      value: fmt(pendiente)  + " €",   icon: Clock,        color: pendiente > 0 ? "#d97706" : "#9ca3af", bg: pendiente > 0 ? "#fffbeb" : "#f9fafb" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-content-muted font-medium">{label}</p>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
            </div>
            <p className="text-base font-black leading-tight" style={{ color }}>{value}</p>
            {label === "Cobrado" && (
              <div className="mt-1.5">
                <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${tasaCobro}%` }} />
                </div>
                <p className="text-xs text-content-muted mt-0.5">{tasaCobro}% cobrado</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="card p-4 space-y-3">

        {/* Fila principal */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
            <input
              ref={busquedaRef}
              className="input pl-9 text-sm"
              placeholder="Buscar nº factura, cliente, concepto, obra..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button onClick={() => setBusqueda("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-content-muted" />
              </button>
            )}
          </div>

          {/* Estado — chips */}
          <div className="flex items-center gap-1">
            {(["", "emitida", "cobrada"] as const).map((v) => (
              <button key={v} onClick={() => setEstadoFiltro(v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${estadoFiltro === v ? "bg-primary text-white" : "bg-gray-100 text-content-muted hover:bg-gray-200"}`}>
                {v === "" ? "Todos" : ESTADO_CFG[v]?.label}
              </button>
            ))}
          </div>

          {/* Tipo — chips */}
          <div className="flex items-center gap-1">
            {([
              { v: "" as const,        label: "Ambos" },
              { v: "obra" as const,    label: "Obras" },
              { v: "directa" as const, label: "Directas" },
            ]).map(({ v, label }) => (
              <button key={v} onClick={() => setTipoFiltro(v)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${tipoFiltro === v ? "bg-primary text-white" : "bg-gray-100 text-content-muted hover:bg-gray-200"}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Botón filtros avanzados */}
          <button
            onClick={() => setMostrarAvanzados((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${mostrarAvanzados || nFiltrosAvanzados > 0 ? "border-primary bg-primary-light text-primary" : "border-gray-200 text-content-muted hover:border-primary hover:text-primary"}`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
            {nFiltrosAvanzados > 0 && (
              <span className="bg-primary text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">{nFiltrosAvanzados}</span>
            )}
          </button>

          {hayFiltros && (
            <button onClick={limpiarTodo} className="flex items-center gap-1 text-xs text-danger font-semibold hover:opacity-70 transition-opacity">
              <X className="w-3 h-3" /> Limpiar todo
            </button>
          )}
        </div>

        {/* Chips de filtros activos */}
        {hayFiltros && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
            {busqueda      && <FilterChip label={`"${busqueda}"`}                    onRemove={() => setBusqueda("")} />}
            {estadoFiltro  && <FilterChip label={ESTADO_CFG[estadoFiltro]?.label}   onRemove={() => setEstadoFiltro("")} />}
            {tipoFiltro    && <FilterChip label={tipoFiltro === "obra" ? "Obras" : "Directas"} onRemove={() => setTipoFiltro("")} />}
            {anioFiltro    && <FilterChip label={`Año ${anioFiltro}`}               onRemove={() => { setAnioFiltro(""); setMesFiltro(""); }} />}
            {mesFiltro     && <FilterChip label={fmtMes(mesFiltro + "-01")}         onRemove={() => setMesFiltro("")} />}
            {fechaDesde    && <FilterChip label={`Desde ${fmtDate(fechaDesde)}`}    onRemove={() => setFechaDesde("")} />}
            {fechaHasta    && <FilterChip label={`Hasta ${fmtDate(fechaHasta)}`}    onRemove={() => setFechaHasta("")} />}
            {importeMin    && <FilterChip label={`Mín. ${importeMin} €`}            onRemove={() => setImporteMin("")} />}
            {importeMax    && <FilterChip label={`Máx. ${importeMax} €`}            onRemove={() => setImporteMax("")} />}
          </div>
        )}
      </div>

      {/* ── Panel filtros avanzados (card separado para evitar overflow del layout) ── */}
      {mostrarAvanzados && (
        <div className="card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-semibold text-content-muted mb-1">Año</label>
            <select className="input text-sm py-1.5 w-full" value={anioFiltro}
              onChange={(e) => { setAnioFiltro(e.target.value); setMesFiltro(""); }}>
              <option value="">Todos</option>
              {aniosDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-content-muted mb-1">Mes</label>
            <select className="input text-sm py-1.5 w-full" value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}>
              <option value="">Todos</option>
              {mesesDisponibles.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-content-muted mb-1">Fecha desde</label>
            <input type="date" className="input text-sm py-1.5 w-full" value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-content-muted mb-1">Fecha hasta</label>
            <input type="date" className="input text-sm py-1.5 w-full" value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-content-muted mb-1">Importe mín. (€)</label>
            <input type="number" className="input text-sm py-1.5 w-full" placeholder="0"
              value={importeMin} onChange={(e) => setImporteMin(e.target.value)} min="0" step="0.01" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-content-muted mb-1">Importe máx. (€)</label>
            <input type="number" className="input text-sm py-1.5 w-full" placeholder="∞"
              value={importeMax} onChange={(e) => setImporteMax(e.target.value)} min="0" step="0.01" />
          </div>
        </div>
      )}

      {/* ── Tabla ───────────────────────────────────────────────────────── */}
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
            {hayFiltros ? "Sin resultados" : "Sin facturas emitidas"}
          </h3>
          <p className="text-sm text-content-secondary">
            {hayFiltros ? "Prueba ajustando los filtros." : "Las facturas emitidas aparecerán aquí."}
          </p>
          {hayFiltros && (
            <button onClick={limpiarTodo} className="mt-4 btn-ghost text-sm text-primary">
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">

          {/* Cabecera tabla */}
          <div className="hidden lg:grid gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-bold text-content-muted uppercase tracking-wide"
            style={{ gridTemplateColumns: "140px 80px 1fr 160px auto 90px 90px 100px 120px 36px 36px" }}>
            <button onClick={() => toggleSort("numero")}       className="flex items-center gap-1 hover:text-primary transition-colors">Nº Factura      <SortIcon field="numero"       sortField={sortField} sortDir={sortDir} /></button>
            <button onClick={() => toggleSort("fecha")}        className="flex items-center gap-1 hover:text-primary transition-colors">Fecha           <SortIcon field="fecha"        sortField={sortField} sortDir={sortDir} /></button>
            <button onClick={() => toggleSort("cliente")}      className="flex items-center gap-1 hover:text-primary transition-colors">Cliente / Concepto <SortIcon field="cliente"    sortField={sortField} sortDir={sortDir} /></button>
            <span>Origen</span>
            <span className="text-right">Mes</span>
            <button onClick={() => toggleSort("importe_base")} className="flex items-center gap-1 justify-end hover:text-primary transition-colors">Base            <SortIcon field="importe_base"  sortField={sortField} sortDir={sortDir} /></button>
            <span className="text-right">IVA</span>
            <button onClick={() => toggleSort("importe_total")} className="flex items-center gap-1 justify-end hover:text-primary transition-colors">Total           <SortIcon field="importe_total" sortField={sortField} sortDir={sortDir} /></button>
            <button onClick={() => toggleSort("estado")}       className="flex items-center gap-1 hover:text-primary transition-colors">Estado          <SortIcon field="estado"       sortField={sortField} sortDir={sortDir} /></button>
            <span title="Google Drive" className="flex justify-center"><GoogleDriveIcon size={14} /></span>
            <span />
          </div>

          {/* Filas */}
          {paginadas.map((f) => (
            <div key={f.id}
              className="grid grid-cols-1 lg:grid-cols-[140px_80px_1fr_160px_auto_90px_90px_100px_120px_36px_36px] gap-2 lg:gap-2 px-4 py-3 items-center border-b border-gray-50 last:border-0 hover:bg-blue-50/30 transition-colors group"
            >
              {/* Nº + tipo icono */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: f.tipo === "directa" ? "#EEF2F8" : "#f0fdf4" }}>
                  {f.tipo === "directa"
                    ? <FileText className="w-3.5 h-3.5" style={{ color: "#607eaa" }} />
                    : <Building2 className="w-3.5 h-3.5" style={{ color: "#16a34a" }} />}
                </div>
                <span className="font-bold text-sm text-content-primary whitespace-nowrap">{f.numero ?? "—"}</span>
              </div>

              {/* Fecha */}
              <div className="lg:block">
                <p className="text-xs font-semibold text-content-primary whitespace-nowrap">{fmtDate(f.fecha)}</p>
              </div>

              {/* Cliente + Concepto */}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-content-primary truncate">{f.cliente}</p>
                <p className="text-xs text-content-muted truncate">{f.concepto}</p>
              </div>

              {/* Origen */}
              <div className="min-w-0">
                {f.tipo === "directa" ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium whitespace-nowrap">
                    <FileText className="w-3 h-3" /> Directa
                  </span>
                ) : (
                  <p className="text-xs text-content-secondary truncate">🏗️ {f.obra_nombre ?? "—"}</p>
                )}
              </div>

              {/* Mes / año */}
              <div className="hidden lg:block text-right">
                {f.fecha && (
                  <span className="text-xs text-content-muted whitespace-nowrap">{fmtMes(f.fecha)}</span>
                )}
              </div>

              {/* Base */}
              <div className="text-right">
                <p className="text-xs font-medium text-content-secondary whitespace-nowrap">{fmt(f.importe_base)} €</p>
              </div>

              {/* IVA */}
              <div className="text-right">
                <p className="text-xs text-content-muted whitespace-nowrap">+{fmt(f.importe_iva)} €</p>
              </div>

              {/* Total */}
              <div className="text-right">
                <p className="font-bold text-sm text-content-primary whitespace-nowrap">{fmt(f.importe_total)} €</p>
              </div>

              {/* Estado */}
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
                  style={{ background: ESTADO_CFG[f.estado]?.bg ?? "#f3f4f6", color: ESTADO_CFG[f.estado]?.text ?? "#6b7280" }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ESTADO_CFG[f.estado]?.dot ?? "#6b7280" }} />
                  {ESTADO_CFG[f.estado]?.label ?? f.estado}
                </span>
              </div>

              {/* Drive */}
              <div className="flex justify-center">
                <BtnDriveIngreso
                  rowId={f.id}
                  factura_id={f.factura_id}
                  fecha={f.fecha}
                  gdrive_url={f.gdrive_url}
                  onUploaded={handleDriveUploaded}
                />
              </div>

              {/* Ver */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    if (f.tipo === "directa" && f.directa_data) setPreviewDirecta(f.directa_data);
                    else abrirFacturaObra(f);
                  }}
                  disabled={loadingPreview === f.id}
                  className="p-1.5 rounded-lg hover:bg-primary-light text-content-muted hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                  title="Ver factura"
                >
                  {loadingPreview === f.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}

          {/* ── Pie: totales + paginación ── */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-t border-gray-200">
            {/* Totales */}
            <div className="flex items-center gap-4 text-xs text-content-muted">
              <span><strong className="text-content-primary">{filtradas.length}</strong> facturas</span>
              <span>Base: <strong className="text-content-primary">{fmt(totalBase)} €</strong></span>
              <span>IVA: <strong className="text-content-primary">{fmt(totalIva)} €</strong></span>
              <span className="font-bold text-sm text-content-primary">Total: {fmt(totalTotal)} €</span>
            </div>

            {/* Paginación */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-content-muted">
                <span>Filas:</span>
                <select className="input text-xs py-1 px-2 w-16" value={porPagina}
                  onChange={(e) => { setPorPagina(Number(e.target.value)); setPagina(1); }}>
                  {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <span className="text-xs text-content-muted whitespace-nowrap">
                {(paginaReal - 1) * porPagina + 1}–{Math.min(paginaReal * porPagina, filtradas.length)} de {filtradas.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={paginaReal <= 1}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {/* Números de página */}
                {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                  let p: number;
                  if (totalPaginas <= 5) p = i + 1;
                  else if (paginaReal <= 3) p = i + 1;
                  else if (paginaReal >= totalPaginas - 2) p = totalPaginas - 4 + i;
                  else p = paginaReal - 2 + i;
                  return (
                    <button key={p} onClick={() => setPagina(p)}
                      className={`w-7 h-7 rounded text-xs font-semibold transition-colors ${p === paginaReal ? "bg-primary text-white" : "hover:bg-gray-200 text-content-muted"}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={paginaReal >= totalPaginas}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Previews ────────────────────────────────────────────────────── */}
      {previewFactura && tenantId && (
        <InvoicePreview
          factura={previewFactura}
          obra={previewObra}
          tenantId={tenantId}
          pago={previewPago}
          onClose={() => { setPreviewFactura(null); setPreviewObra(null); setPreviewPago(undefined); }}
        />
      )}
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
