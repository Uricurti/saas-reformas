"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import {
  getFacturacionDashboard,
  getPagosPendientesYEmitidos,
  getObrasActivas,
  getFacturasByObra,
  updatePago,
} from "@/lib/insforge/database";
import type { PagoConContexto } from "@/types";
import dynamic from "next/dynamic";
import {
  TrendingUp, TrendingDown, Euro, CheckCircle2, Clock, Calendar,
  AlertTriangle, AlertCircle, ChevronRight, Loader2, Building2,
} from "lucide-react";

// ─── Recharts lazy-loaded ─────────────────────────────────────────────────────
const AreaChart       = dynamic(() => import("recharts").then((m) => m.AreaChart),       { ssr: false });
const Area            = dynamic(() => import("recharts").then((m) => m.Area),            { ssr: false });
const XAxis           = dynamic(() => import("recharts").then((m) => m.XAxis),           { ssr: false });
const YAxis           = dynamic(() => import("recharts").then((m) => m.YAxis),           { ssr: false });
const CartesianGrid   = dynamic(() => import("recharts").then((m) => m.CartesianGrid),   { ssr: false });
const Tooltip         = dynamic(() => import("recharts").then((m) => m.Tooltip),         { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const PieChart        = dynamic(() => import("recharts").then((m) => m.PieChart),        { ssr: false });
const Pie             = dynamic(() => import("recharts").then((m) => m.Pie),             { ssr: false });
const Cell            = dynamic(() => import("recharts").then((m) => m.Cell),            { ssr: false });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtEuro(n: number) {
  return `${fmt(n)} €`;
}
function diasDesde(fecha: string) {
  const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
  return diff;
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, subUp, icon: Icon, iconBg, iconColor,
}: {
  label: string; value: string; sub?: string; subUp?: boolean | null;
  icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16, padding: "20px 22px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>{label}</span>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon style={{ width: 18, height: 18, color: iconColor }} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", letterSpacing: "-0.5px" }}>{value}</div>
        {sub && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
            {subUp === true  && <TrendingUp   style={{ width: 13, height: 13, color: "#10b981" }} />}
            {subUp === false && <TrendingDown style={{ width: 13, height: 13, color: "#ef4444" }} />}
            <span style={{ fontSize: 12, color: subUp === true ? "#10b981" : subUp === false ? "#ef4444" : "#9ca3af" }}>
              {sub}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Alerta pago ──────────────────────────────────────────────────────────────
function AlertaPago({ pago, onCobrar }: { pago: PagoConContexto; onCobrar: () => void }) {
  const dias = pago.fecha_prevista ? diasDesde(pago.fecha_prevista) : null;
  const vencido = dias !== null && dias > 0;
  const hoy     = dias !== null && dias === 0;

  const color   = vencido ? "#ef4444" : hoy ? "#f59e0b" : "#3b82f6";
  const bg      = vencido ? "#fef2f2" : hoy ? "#fffbeb" : "#eff6ff";
  const label   = vencido ? `Venció hace ${dias}d` : hoy ? "Vence hoy" : dias !== null ? `Vence en ${Math.abs(dias)}d` : "";
  const icon    = vencido ? AlertCircle : hoy ? AlertTriangle : Clock;
  const Icon    = icon;

  const [saving, setSaving] = useState(false);
  async function handleCobrar() {
    setSaving(true);
    await updatePago(pago.id, { estado: "cobrada", fecha_cobro: new Date().toISOString().split("T")[0] });
    onCobrar();
    setSaving(false);
  }

  return (
    <div style={{ background: bg, border: `1.5px solid ${color}30`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <Icon style={{ width: 18, height: 18, color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {pago.obra_nombre}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>{pago.factura_concepto} · {pago.concepto}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color }}>{fmt(pago.importe_total)} €</div>
        <div style={{ fontSize: 11, color }}>{label}</div>
      </div>
      <button onClick={handleCobrar} disabled={saving}
        style={{ background: color, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 600, fontSize: 12, cursor: saving ? "default" : "pointer", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
        {saving ? <Loader2 style={{ width: 12, height: 12 }} /> : <CheckCircle2 style={{ width: 12, height: 12 }} />}
        Cobrar
      </button>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e293b", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>{MESES[parseInt(label, 10) - 1] ?? label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "#cbd5e1" }}>{p.name}:</span>
          <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>{fmt(p.value)} €</span>
        </div>
      ))}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function FacturacionPage() {
  const router   = useRouter();
  const isAdmin  = useIsAdmin();
  const tenantId = useTenantId();

  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof getFacturacionDashboard>> | null>(null);
  const [alertas, setAlertas] = useState<PagoConContexto[]>([]);
  const [obrasData, setObrasData] = useState<{ nombre: string; facturado: number; cobrado: number }[]>([]);

  const anio = new Date().getFullYear();
  const anioAnterior = anio - 1;

  const cargar = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    const [dash, pagos, obras] = await Promise.all([
      getFacturacionDashboard(tenantId),
      getPagosPendientesYEmitidos(tenantId),
      getObrasActivas(tenantId),
    ]);
    setDashboard(dash);

    // Filtrar alertas: vencidos o próximos 7 días
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const en7 = new Date(hoy); en7.setDate(en7.getDate() + 7);
    const alertasFiltradas = pagos.filter((p) => {
      if (!p.fecha_prevista) return false;
      const d = new Date(p.fecha_prevista); d.setHours(0, 0, 0, 0);
      return d <= en7;
    });
    setAlertas(alertasFiltradas);

    // Top obras con facturación
    if (obras.data && obras.data.length > 0) {
      const obrasList = obras.data as any[];
      const factsPerObra = await Promise.all(
        obrasList.slice(0, 8).map(async (o) => {
          const facts = await getFacturasByObra(o.id);
          const allP = facts.flatMap((f) => f.pagos);
          return {
            nombre: o.nombre,
            facturado: allP.reduce((s, p) => s + p.importe_total, 0),
            cobrado: allP.filter((p) => p.estado === "cobrada").reduce((s, p) => s + p.importe_total, 0),
          };
        })
      );
      setObrasData(factsPerObra.filter((o) => o.facturado > 0).sort((a, b) => b.facturado - a.facturado));
    }

    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (!isAdmin) { router.replace("/obras"); return; }
    cargar();
  }, [isAdmin, cargar]);

  if (!isAdmin) return null;

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 36, height: 36, color: "#2563eb", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  const d = dashboard!;
  const chartData = d.porMes.map((m, i) => ({
    mes: String(i + 1).padStart(2, "0"),
    "Este año": m.facturado,
    "Cobrado": m.cobrado,
    "Año anterior": m.anioAnterior,
  }));

  // Calcular delta mes actual vs mes anterior
  const deltaRaw   = d.facturadoMesAnterior > 0
    ? ((d.facturadoEsteMes - d.facturadoMesAnterior) / d.facturadoMesAnterior) * 100
    : null;
  const deltaStr   = deltaRaw !== null ? `${deltaRaw >= 0 ? "+" : ""}${deltaRaw.toFixed(1)}% vs mes anterior` : "Sin datos mes anterior";
  const deltaUp    = deltaRaw !== null ? deltaRaw >= 0 : null;

  // Donut data
  const cobrado   = d.totalCobrado;
  const emitido   = d.porMes.reduce((s, m) => s + m.facturado, 0) - cobrado > 0 ?
    d.porMes.reduce((s, m) => {
      // emitida = facturado - cobrado (aproximado)
      return s;
    }, 0) : 0;
  const pendiente = d.totalFacturado - d.totalCobrado;
  const donutData = [
    { name: "Cobrado",  value: cobrado,  color: "#10b981" },
    { name: "Pendiente", value: pendiente, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "20px 20px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1200, margin: "0 auto" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Facturación</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#9ca3af" }}>Resumen económico · {anio}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f1f5f9", borderRadius: 10, padding: "6px 14px" }}>
            <Calendar style={{ width: 14, height: 14, color: "#64748b" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Año {anio}</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px" }}>

        {/* Panel de alertas */}
        {alertas.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <AlertTriangle style={{ width: 16, height: 16, color: "#f59e0b" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                Pagos urgentes
              </span>
              <span style={{ background: "#fef3c7", color: "#b45309", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "1px 8px" }}>
                {alertas.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alertas.map((p) => (
                <AlertaPago key={p.id} pago={p} onCobrar={cargar} />
              ))}
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
          <KpiCard
            label="Total facturado"
            value={fmtEuro(d.totalFacturado)}
            sub={`${anio}`}
            subUp={null}
            icon={Euro}
            iconBg="#eff6ff"
            iconColor="#2563eb"
          />
          <KpiCard
            label="Total cobrado"
            value={fmtEuro(d.totalCobrado)}
            sub={d.totalFacturado > 0 ? `${Math.round((d.totalCobrado / d.totalFacturado) * 100)}% del total` : undefined}
            subUp={null}
            icon={CheckCircle2}
            iconBg="#f0fdf4"
            iconColor="#16a34a"
          />
          <KpiCard
            label="Pendiente de cobro"
            value={fmtEuro(pendiente)}
            sub={pendiente > 0 ? `${Math.round((pendiente / (d.totalFacturado || 1)) * 100)}% sin cobrar` : "Todo cobrado"}
            subUp={pendiente > 0 ? false : true}
            icon={Clock}
            iconBg="#fffbeb"
            iconColor="#d97706"
          />
          <KpiCard
            label="Este mes"
            value={fmtEuro(d.facturadoEsteMes)}
            sub={deltaStr}
            subUp={deltaUp}
            icon={TrendingUp}
            iconBg="#faf5ff"
            iconColor="#7c3aed"
          />
        </div>

        {/* Gráfico + Top obras */}
        <div style={{ display: "grid", gridTemplateColumns: obrasData.length > 0 ? "1fr 340px" : "1fr", gap: 16, marginBottom: 20 }}>
          {/* Gráfico de área */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Evolución mensual</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Facturado y cobrado por mes</div>
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                {[
                  { color: "#6366f1", label: `${anio}` },
                  { color: "#10b981", label: "Cobrado" },
                  { color: "#cbd5e1", label: `${anioAnterior}` },
                ].map((l) => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradEsteAnio" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCobrado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="mes" tickFormatter={(v) => MESES[parseInt(v, 10) - 1] ?? v}
                    tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${fmt(v)}`} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Año anterior" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 4" fill="none" dot={false} />
                  <Area type="monotone" dataKey="Este año" stroke="#6366f1" strokeWidth={2.5} fill="url(#gradEsteAnio)" dot={false} activeDot={{ r: 5, fill: "#6366f1" }} />
                  <Area type="monotone" dataKey="Cobrado" stroke="#10b981" strokeWidth={2} fill="url(#gradCobrado)" dot={false} activeDot={{ r: 5, fill: "#10b981" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top obras */}
          {obrasData.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Top obras</span>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>Facturado / Cobrado</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {obrasData.slice(0, 7).map((o, i) => {
                  const pct = o.facturado > 0 ? Math.round((o.cobrado / o.facturado) * 100) : 0;
                  return (
                    <div key={i} style={{ padding: "10px 0", borderBottom: i < obrasData.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Building2 style={{ width: 13, height: 13, color: "#2563eb" }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {o.nombre}
                          </span>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{fmtEuro(o.facturado)}</div>
                          <div style={{ fontSize: 11, color: "#10b981" }}>{fmtEuro(o.cobrado)} cobrado</div>
                        </div>
                      </div>
                      <div style={{ height: 4, background: "#f1f5f9", borderRadius: 9, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#10b981" : "#2563eb", borderRadius: 9, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Fila inferior: Resumen de cobros + Donut */}
        <div style={{ display: "grid", gridTemplateColumns: donutData.length > 0 ? "1fr 300px" : "1fr", gap: 16 }}>
          {/* Resumen mensual table */}
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Detalle mensual</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>MES</th>
                    <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>FACTURADO</th>
                    <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>COBRADO</th>
                    <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>AÑO ANT.</th>
                    <th style={{ textAlign: "right", padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "#9ca3af" }}>VAR.</th>
                  </tr>
                </thead>
                <tbody>
                  {d.porMes.map((m, i) => {
                    const variacion = m.anioAnterior > 0 ? ((m.facturado - m.anioAnterior) / m.anioAnterior) * 100 : null;
                    const mesActual = i + 1 === new Date().getMonth() + 1;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #f9fafb", background: mesActual ? "#fafbff" : "transparent" }}>
                        <td style={{ padding: "8px 10px", fontWeight: mesActual ? 700 : 500, color: mesActual ? "#2563eb" : "#374151" }}>
                          {MESES[i]}
                          {mesActual && <span style={{ fontSize: 10, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "0 4px", marginLeft: 4 }}>Actual</span>}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: m.facturado > 0 ? "#111827" : "#d1d5db" }}>
                          {m.facturado > 0 ? fmtEuro(m.facturado) : "—"}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: m.cobrado > 0 ? "#10b981" : "#d1d5db", fontWeight: 600 }}>
                          {m.cobrado > 0 ? fmtEuro(m.cobrado) : "—"}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#9ca3af" }}>
                          {m.anioAnterior > 0 ? fmtEuro(m.anioAnterior) : "—"}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>
                          {variacion !== null ? (
                            <span style={{ fontSize: 12, fontWeight: 600, color: variacion >= 0 ? "#10b981" : "#ef4444" }}>
                              {variacion >= 0 ? "↑" : "↓"} {Math.abs(variacion).toFixed(0)}%
                            </span>
                          ) : <span style={{ color: "#d1d5db" }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Donut chart */}
          {donutData.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Estado de cobros</div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>Distribución del total facturado</div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ position: "relative", width: 180, height: 180 }}>
                  <PieChart width={180} height={180}>
                    <Pie
                      data={donutData}
                      cx={85} cy={85}
                      innerRadius={55} outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmtEuro(v)} />
                  </PieChart>
                  {/* Centro */}
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                      {d.totalFacturado > 0 ? `${Math.round((cobrado / d.totalFacturado) * 100)}%` : "0%"}
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>cobrado</div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                {donutData.map((d) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "#374151" }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{fmtEuro(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
