"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useIsAdmin, useTenantId } from "@/lib/stores/auth-store";
import {
  getFinanzasDashboard, type DashboardFinanzas,
  getPagosPendientesYEmitidos,
  updatePago,
} from "@/lib/insforge/database";
import type { PagoConContexto } from "@/types";
import dynamic from "next/dynamic";
import {
  TrendingUp, TrendingDown, Euro, CheckCircle2, Clock,
  AlertTriangle, AlertCircle, Loader2, Users, ShoppingCart,
  BarChart3, Target,
} from "lucide-react";

// ─── Recharts lazy ────────────────────────────────────────────────────────────
const AreaChart           = dynamic(() => import("recharts").then(m => m.AreaChart),           { ssr: false });
const Area                = dynamic(() => import("recharts").then(m => m.Area),                { ssr: false });
const XAxis               = dynamic(() => import("recharts").then(m => m.XAxis),               { ssr: false });
const YAxis               = dynamic(() => import("recharts").then(m => m.YAxis),               { ssr: false });
const CartesianGrid       = dynamic(() => import("recharts").then(m => m.CartesianGrid),       { ssr: false });
const Tooltip             = dynamic(() => import("recharts").then(m => m.Tooltip),             { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(m => m.ResponsiveContainer), { ssr: false });
const BarChart            = dynamic(() => import("recharts").then(m => m.BarChart),            { ssr: false });
const Bar                 = dynamic(() => import("recharts").then(m => m.Bar),                 { ssr: false });
const PieChart            = dynamic(() => import("recharts").then(m => m.PieChart),            { ssr: false });
const Pie                 = dynamic(() => import("recharts").then(m => m.Pie),                 { ssr: false });
const Cell                = dynamic(() => import("recharts").then(m => m.Cell),                { ssr: false });

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const P   = "#607eaa";   // primary
const PL  = "#EEF2F8";   // primary light
const PD  = "#1c3879";   // primary dark
const ACC = "#26bbec";   // accent turquoise
const BG  = "#F5F4F1";   // app bg

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function fmt(n: number) { return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmtEuro(n: number) { return `${fmt(n)} €`; }
function diasDesde(fecha: string) { return Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000); }

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, subUp, icon: Icon, iconBg, iconColor, accent }: {
  label: string; value: string; sub?: string; subUp?: boolean | null;
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
        {sub && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
            {subUp === true  && <TrendingUp   style={{ width: 12, height: 12, color: "#10b981" }} />}
            {subUp === false && <TrendingDown style={{ width: 12, height: 12, color: "#EF4444" }} />}
            <span style={{ fontSize: 11, color: subUp === true ? "#10b981" : subUp === false ? "#EF4444" : "#94A3B8" }}>{sub}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Alerta pago ──────────────────────────────────────────────────────────────
function AlertaPago({ pago, onCobrar }: { pago: PagoConContexto; onCobrar: () => void }) {
  const dias    = pago.fecha_prevista ? diasDesde(pago.fecha_prevista) : null;
  const vencido = dias !== null && dias > 0;
  const hoy     = dias !== null && dias === 0;
  const color   = vencido ? "#EF4444" : hoy ? "#F59E0B" : P;
  const bg      = vencido ? "#fef2f2" : hoy ? "#fffbeb" : PL;
  const label   = vencido ? `Venció hace ${dias}d` : hoy ? "Vence hoy" : dias !== null ? `Vence en ${Math.abs(dias)}d` : "";
  const Icon    = vencido ? AlertCircle : hoy ? AlertTriangle : Clock;
  const [saving, setSaving] = useState(false);

  async function handleCobrar() {
    setSaving(true);
    await updatePago(pago.id, { estado: "cobrada", fecha_cobro: new Date().toISOString().split("T")[0] });
    onCobrar();
    setSaving(false);
  }

  return (
    <div style={{ background: bg, border: `1.5px solid ${color}25`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon style={{ width: 16, height: 16, color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {pago.obra_nombre}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {pago.factura_concepto} · {pago.concepto}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color }}>{fmt(pago.importe_total)} €</div>
          {label && <div style={{ fontSize: 10, color }}>{label}</div>}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={handleCobrar} disabled={saving}
          style={{ background: color, color: "#fff", border: "none", borderRadius: 8, padding: "6px 16px", fontWeight: 600, fontSize: 12, cursor: saving ? "default" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          {saving ? <Loader2 style={{ width: 12, height: 12 }} /> : <CheckCircle2 style={{ width: 12, height: 12 }} />}
          Cobrar
        </button>
      </div>
    </div>
  );
}

// ─── Tooltip custom ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e293b", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>{MESES[parseInt(label, 10) - 1] ?? label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color || p.fill, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#cbd5e1" }}>{p.name}:</span>
          <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>{fmt(p.value)} €</span>
        </div>
      ))}
    </div>
  );
}

// ─── Sección card wrapper ─────────────────────────────────────────────────────
function Section({ title, sub, children, action, compact }: { title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode; compact?: boolean }) {
  const p = compact ? "14px 14px" : "20px";
  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: p, boxShadow: "0 1px 3px rgba(96,126,170,0.07)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: compact ? 12 : 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1A2E" }}>{title}</div>
          {sub && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function FinanzasPage() {
  const router   = useRouter();
  const isAdmin  = useIsAdmin();
  const tenantId = useTenantId();
  const anio     = new Date().getFullYear();

  const [loading,   setLoading]  = useState(true);
  const [dash,      setDash]     = useState<DashboardFinanzas | null>(null);
  const [alertas,   setAlertas]  = useState<PagoConContexto[]>([]);
  const [isMobile,  setIsMobile] = useState(false);
  const [showAB,    setShowAB]   = useState(false);  // Toggle A/B view

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const cargar = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const [d, pagos] = await Promise.all([
      getFinanzasDashboard(tenantId),
      getPagosPendientesYEmitidos(tenantId),
    ]);
    setDash(d);
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const en7 = new Date(hoy); en7.setDate(en7.getDate() + 7);
    setAlertas(pagos.filter(p => {
      if (!p.fecha_prevista) return false;
      const d2 = new Date(p.fecha_prevista); d2.setHours(0,0,0,0);
      return d2 <= en7;
    }));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (!isAdmin) { router.replace("/obras"); return; }
    cargar();
  }, [isAdmin, cargar]);

  if (!isAdmin) return null;
  if (loading) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", background: BG }}>
      <div style={{ textAlign: "center" }}>
        <Loader2 style={{ width: 36, height: 36, color: P, animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
        <div style={{ fontSize: 14, color: "#94A3B8" }}>Cargando datos...</div>
      </div>
    </div>
  );

  const d = dash!;
  const deltaRaw = d.facturadoMesAnterior > 0
    ? ((d.facturadoEsteMes - d.facturadoMesAnterior) / d.facturadoMesAnterior) * 100
    : null;
  const deltaStr = deltaRaw !== null ? `${deltaRaw >= 0 ? "+" : ""}${deltaRaw.toFixed(1)}% vs mes anterior` : "Sin datos anterior";

  // Chart data (adapta según el modo A/B)
  const chartData = d.porMes.map((m, i) => {
    const base = {
      mes: String(i + 1).padStart(2, "0"),
      "Coste emp.": m.costeEmpleados,
      "Coste mat.": m.costeMateriales,
      "Año anterior": m.anioAnterior,
    };

    if (!showAB) {
      return {
        ...base,
        "Facturado": m.facturado,
        "Cobrado": m.cobrado,
      };
    } else {
      return {
        ...base,
        "Fact. Track A": m.facturadoA,
        "Fact. Track B": m.facturadoB,
        "Cobrado A": m.cobradoA,
        "Cobrado B": m.cobradoB,
      };
    }
  });

  // Donut
  const donutData = [
    { name: "Cobrado",   value: d.totalCobrado,   color: "#10b981" },
    { name: "Pendiente", value: d.pendienteCobro,  color: "#F59E0B" },
  ].filter(x => x.value > 0);

  // Costes donut
  const costesData = [
    { name: "Empleados",  value: d.costeEmpleados,  color: P },
    { name: "Materiales", value: d.costeMateriales, color: ACC },
  ].filter(x => x.value > 0);

  const hayDatos = d.totalFacturado > 0 || d.costeEmpleados > 0;

  return (
    <div style={{ minHeight: "100vh", background: BG, paddingBottom: 100 }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E8E8EC", padding: isMobile ? "14px 16px 12px" : "18px 24px 16px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: PL, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp style={{ width: 20, height: 20, color: P }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1A1A2E" }}>Finanzas</h1>
              <p style={{ margin: 0, fontSize: 12, color: "#94A3B8" }}>Resumen económico · {anio}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: PL, borderRadius: 10, padding: "6px 14px" }}>
            <BarChart3 style={{ width: 14, height: 14, color: P }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: P }}>Año {anio}</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: isMobile ? "14px 12px" : "20px 16px" }}>

        {/* ── Alertas ─────────────────────────────────────────── */}
        {alertas.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 18, marginBottom: 20, boxShadow: "0 1px 3px rgba(96,126,170,0.07)", borderLeft: `4px solid #F59E0B` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <AlertTriangle style={{ width: 16, height: 16, color: "#F59E0B" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E" }}>Pagos urgentes</span>
              <span style={{ background: "#fef3c7", color: "#b45309", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "1px 8px" }}>{alertas.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alertas.map(p => <AlertaPago key={p.id} pago={p} onCobrar={cargar} />)}
            </div>
          </div>
        )}

        {/* ── KPIs principales + Toggle A/B ──────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1A1A2E" }}>Resumen facturación</h2>
          <button onClick={() => setShowAB(!showAB)}
            style={{
              background: showAB ? "#e0f2fe" : "#f3f4f6",
              color: showAB ? "#0369a1" : "#6b7280",
              border: `1.5px solid ${showAB ? "#bae6fd" : "#e5e7eb"}`,
              borderRadius: 10, padding: "6px 12px",
              fontSize: 12, fontWeight: 600,
              cursor: "pointer", transition: "all 0.2s"
            }}>
            {showAB ? "Desglose A/B" : "Vista total"}
          </button>
        </div>

        {!showAB ? (
          /* Vista de totales */
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 12, marginBottom: isMobile ? 14 : 20 }}>
            <KpiCard label="Total facturado" value={fmtEuro(d.totalFacturado)}
              sub={`año ${anio}`} subUp={null} accent={P}
              icon={Euro} iconBg={PL} iconColor={P} />
            <KpiCard label="Total cobrado" value={fmtEuro(d.totalCobrado)}
              sub={d.totalFacturado > 0 ? `${Math.round((d.totalCobrado / d.totalFacturado) * 100)}% del total` : undefined}
              subUp={null} accent="#10b981"
              icon={CheckCircle2} iconBg="#f0fdf4" iconColor="#16a34a" />
            <KpiCard label="Pendiente cobro" value={fmtEuro(d.pendienteCobro)}
              sub={d.pendienteCobro > 0 ? "Por cobrar" : "¡Todo cobrado! 🎉"}
              subUp={d.pendienteCobro === 0 ? true : false} accent="#F59E0B"
              icon={Clock} iconBg="#fffbeb" iconColor="#d97706" />
            <KpiCard label="Este mes" value={fmtEuro(d.facturadoEsteMes)}
              sub={deltaStr} subUp={deltaRaw !== null ? deltaRaw >= 0 : null} accent="#7c3aed"
              icon={TrendingUp} iconBg="#faf5ff" iconColor="#7c3aed" />
          </div>
        ) : (
          /* Vista A/B Split */
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 12, marginBottom: isMobile ? 14 : 20 }}>
            {/* Track A */}
            <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 3px rgba(96,126,170,0.08)", borderTop: "3px solid #2563eb" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#4A5568", fontWeight: 500 }}>Track A — Facturado (con IVA)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A2E", marginTop: 6 }}>{fmtEuro(d.totalFacturadoA)}</div>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                  🧾
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8", paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span>Cobrado:</span>
                  <strong>{fmtEuro(d.totalCobradoA)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Pendiente:</span>
                  <strong>{fmtEuro(d.pendienteCobrosA)}</strong>
                </div>
              </div>
            </div>

            {/* Track B */}
            <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 3px rgba(96,126,170,0.08)", borderTop: "3px solid #f59e0b" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#4A5568", fontWeight: 500 }}>Track B — Efectivo (sin IVA)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A2E", marginTop: 6 }}>{fmtEuro(d.totalFacturadoB)}</div>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                  💵
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#94A3B8", paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span>Cobrado:</span>
                  <strong>{fmtEuro(d.totalCobradoB)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Pendiente:</span>
                  <strong>{fmtEuro(d.pendienteCobrosB)}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── KPIs costes y margen ───────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 12, marginBottom: isMobile ? 14 : 20 }}>
          <KpiCard label="Coste empleados" value={fmtEuro(d.costeEmpleados)}
            sub="Jornales año actual" subUp={null} accent={P}
            icon={Users} iconBg={PL} iconColor={P} />
          <KpiCard label="Coste materiales" value={fmtEuro(d.costeMateriales)}
            sub="Materiales con precio" subUp={null} accent={ACC}
            icon={ShoppingCart} iconBg="#e8f8fd" iconColor={ACC} />
          <KpiCard
            label="Margen bruto"
            value={fmtEuro(d.margenBruto)}
            sub={d.totalFacturado > 0 ? `${d.margenPct.toFixed(1)}% del total facturado` : "Sin datos"}
            subUp={d.margenBruto >= 0}
            accent={d.margenBruto >= 0 ? "#10b981" : "#EF4444"}
            icon={Target}
            iconBg={d.margenBruto >= 0 ? "#f0fdf4" : "#fef2f2"}
            iconColor={d.margenBruto >= 0 ? "#16a34a" : "#EF4444"}
          />
          <KpiCard label="Obras activas" value={String(d.porObra.length)}
            sub="Con facturación" subUp={null} accent={PD}
            icon={BarChart3} iconBg={PL} iconColor={PD} />
        </div>

        {/* ── Gráfico evolución + Top obras ──────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: (isMobile || d.porObra.length === 0) ? "1fr" : "1fr 300px", gap: 16, marginBottom: 16 }}>
          <Section title="Evolución mensual" sub={showAB ? `Track A/B · ${anio} vs ${anio - 1}` : `Facturado, cobrado y costes · ${anio} vs ${anio - 1}`} compact={isMobile}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
              {(!showAB ? [
                { color: P,        label: `Facturado ${anio}` },
                { color: "#10b981",label: "Cobrado" },
                { color: P + "70", label: `${anio - 1}`, dashed: true as true },
                { color: "#F59E0B",label: "Coste emp." },
                { color: ACC,      label: "Coste mat." },
              ] : [
                { color: "#2563eb",label: "Fact. Track A" },
                { color: "#f59e0b",label: "Fact. Track B" },
                { color: "#10b981",label: "Cobrado A" },
                { color: "#84cc16",label: "Cobrado B" },
                { color: P + "70", label: `${anio - 1}`, dashed: true as true },
              ]).map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: l.dashed ? 0 : "50%", background: l.color, flexShrink: 0, borderBottom: l.dashed ? `2px dashed ${l.color}` : "none", display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{l.label}</span>
                </div>
              ))}
            </div>
            <div style={{ height: isMobile ? 180 : 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gFact" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={P}        stopOpacity={0.15} />
                      <stop offset="95%" stopColor={P}        stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gCob" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981"  stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981"  stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="mes" tickFormatter={v => MESES[parseInt(v,10)-1] ?? v}
                    tick={{ fontSize: isMobile ? 9 : 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${fmt(v)}`} tick={{ fontSize: 9, fill: "#94A3B8" }}
                    axisLine={false} tickLine={false} width={isMobile ? 40 : 55} />
                  <Tooltip content={<CustomTooltip />} />
                  {!showAB ? (
                    <>
                      <Area type="monotone" dataKey="Año anterior" stroke={P + "55"} strokeWidth={1.5}
                        strokeDasharray="4 4" fill="none" dot={false} />
                      <Area type="monotone" dataKey="Facturado" stroke={P} strokeWidth={2.5}
                        fill="url(#gFact)" dot={false} activeDot={{ r: 5, fill: P }} />
                      <Area type="monotone" dataKey="Cobrado" stroke="#10b981" strokeWidth={2}
                        fill="url(#gCob)" dot={false} activeDot={{ r: 5, fill: "#10b981" }} />
                      <Area type="monotone" dataKey="Coste emp." stroke="#F59E0B" strokeWidth={1.5}
                        fill="none" dot={false} strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="Coste mat." stroke={ACC} strokeWidth={1.5}
                        fill="none" dot={false} strokeDasharray="3 3" />
                    </>
                  ) : (
                    <>
                      <Area type="monotone" dataKey="Año anterior" stroke={P + "55"} strokeWidth={1.5}
                        strokeDasharray="4 4" fill="none" dot={false} />
                      <Area type="monotone" dataKey="Fact. Track A" stroke="#2563eb" strokeWidth={2.5}
                        fill="none" dot={false} activeDot={{ r: 5, fill: "#2563eb" }} />
                      <Area type="monotone" dataKey="Fact. Track B" stroke="#f59e0b" strokeWidth={2}
                        fill="none" dot={false} activeDot={{ r: 5, fill: "#f59e0b" }} />
                      <Area type="monotone" dataKey="Cobrado A" stroke="#10b981" strokeWidth={1.5}
                        fill="none" dot={false} strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="Cobrado B" stroke="#84cc16" strokeWidth={1.5}
                        fill="none" dot={false} strokeDasharray="3 3" />
                    </>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Top obras */}
          {d.porObra.length > 0 && (
            <Section title="Top obras" sub="Facturado · Cobrado · Margen" compact={isMobile}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {d.porObra.slice(0, 7).map((o, i) => {
                  const pct    = o.facturado > 0 ? Math.round((o.cobrado / o.facturado) * 100) : 0;
                  const margenOk = o.margen >= 0;
                  return (
                    <div key={o.obra_id} style={{ padding: "10px 0", borderBottom: i < d.porObra.length - 1 ? "1px solid #F5F4F1" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>
                          {o.obra_nombre}
                        </span>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A2E" }}>{fmtEuro(o.facturado)}</div>
                          <div style={{ fontSize: 11, color: margenOk ? "#10b981" : "#EF4444", fontWeight: 600 }}>
                            Margen: {fmtEuro(o.margen)}
                          </div>
                        </div>
                      </div>
                      <div style={{ height: 4, background: "#E8E8EC", borderRadius: 9, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#10b981" : P, borderRadius: 9, transition: "width 0.4s" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{pct}% cobrado</div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>

        {/* ── Costes por mes (barras) + Donuts ────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 16, marginBottom: 16, alignItems: "start" }}>
          <Section title="Facturado vs Costes" sub="Comparativa mensual ingresos y gastos" compact={isMobile}>
            <div style={{ height: isMobile ? 160 : 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }} barGap={2} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="mes" tickFormatter={v => MESES[parseInt(v,10)-1] ?? v}
                    tick={{ fontSize: isMobile ? 9 : 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${fmt(v)}`} tick={{ fontSize: 9, fill: "#94A3B8" }}
                    axisLine={false} tickLine={false} width={isMobile ? 40 : 55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Facturado" fill={P}        radius={[4,4,0,0]} maxBarSize={28} />
                  <Bar dataKey="Coste emp." fill="#F59E0B" radius={[4,4,0,0]} maxBarSize={28} />
                  <Bar dataKey="Coste mat." fill={ACC}     radius={[4,4,0,0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Donuts */}
          <div style={isMobile
            ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }
            : { display: "flex", flexDirection: "column", gap: 16, minWidth: 260 }
          }>
            {donutData.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 1px 3px rgba(96,126,170,0.07)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E", marginBottom: 2 }}>Estado cobros</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 12 }}>Cobrado vs pendiente</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
                    <PieChart width={90} height={90}>
                      <Pie data={donutData} cx={41} cy={41} innerRadius={28} outerRadius={42} paddingAngle={3} dataKey="value">
                        {donutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                    </PieChart>
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1A1A2E" }}>
                        {d.totalFacturado > 0 ? `${Math.round((d.totalCobrado / d.totalFacturado) * 100)}%` : "0%"}
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    {donutData.map(item => (
                      <div key={item.name} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
                          <span style={{ fontSize: 12, color: "#4A5568" }}>{item.name}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#1A1A2E" }}>{fmtEuro(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {costesData.length > 0 && (
              <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 1px 3px rgba(96,126,170,0.07)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E", marginBottom: 2 }}>Estructura de costes</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 12 }}>Empleados vs materiales</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
                    <PieChart width={90} height={90}>
                      <Pie data={costesData} cx={41} cy={41} innerRadius={28} outerRadius={42} paddingAngle={3} dataKey="value">
                        {costesData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                    </PieChart>
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#1A1A2E" }}>Costes</div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    {costesData.map(item => (
                      <div key={item.name} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
                          <span style={{ fontSize: 12, color: "#4A5568" }}>{item.name}</span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#1A1A2E" }}>{fmtEuro(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Tabla mensual detallada ─────────────────────────── */}
        <Section title="Detalle mensual" sub={`Todos los meses de ${anio} con comparativa ${anio - 1}`} compact={isMobile}>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 12 : 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${PL}` }}>
                  {(isMobile
                    ? ["Mes","Facturado","Cobrado","Margen"]
                    : ["Mes","Facturado","Cobrado","Coste emp.","Coste mat.","Margen","Año ant.","Var."]
                  ).map(h => (
                    <th key={h} style={{ padding: isMobile ? "6px 8px" : "7px 10px", textAlign: h === "Mes" ? "left" : "right", fontSize: isMobile ? 10 : 11, fontWeight: 600, color: "#94A3B8", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.porMes.map((m, i) => {
                  const mesActual = i + 1 === new Date().getMonth() + 1;
                  const variacion = m.anioAnterior > 0 ? ((m.facturado - m.anioAnterior) / m.anioAnterior) * 100 : null;
                  const margenOk  = m.margen >= 0;
                  const pd = isMobile ? "6px 8px" : "8px 10px";
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #f9fafb", background: mesActual ? PL + "70" : "transparent" }}>
                      <td style={{ padding: pd, fontWeight: mesActual ? 700 : 500, color: mesActual ? P : "#374151", whiteSpace: "nowrap" }}>
                        {MESES[i]}
                        {mesActual && !isMobile && <span style={{ fontSize: 10, background: PL, color: P, borderRadius: 4, padding: "0 5px", marginLeft: 4, fontWeight: 700 }}>Actual</span>}
                        {mesActual && isMobile && <span style={{ display: "inline-block", width: 6, height: 6, background: P, borderRadius: "50%", marginLeft: 4, verticalAlign: "middle" }} />}
                      </td>
                      <td style={{ padding: pd, textAlign: "right", fontWeight: 600, color: m.facturado > 0 ? "#1A1A2E" : "#d1d5db" }}>{m.facturado > 0 ? fmtEuro(m.facturado) : "—"}</td>
                      <td style={{ padding: pd, textAlign: "right", color: m.cobrado > 0 ? "#10b981" : "#d1d5db", fontWeight: 600 }}>{m.cobrado > 0 ? fmtEuro(m.cobrado) : "—"}</td>
                      {!isMobile && <td style={{ padding: pd, textAlign: "right", color: m.costeEmpleados > 0 ? "#F59E0B" : "#d1d5db" }}>{m.costeEmpleados > 0 ? fmtEuro(m.costeEmpleados) : "—"}</td>}
                      {!isMobile && <td style={{ padding: pd, textAlign: "right", color: m.costeMateriales > 0 ? ACC : "#d1d5db" }}>{m.costeMateriales > 0 ? fmtEuro(m.costeMateriales) : "—"}</td>}
                      <td style={{ padding: pd, textAlign: "right", fontWeight: 700, color: margenOk ? "#10b981" : "#EF4444" }}>
                        {m.margen !== 0 ? fmtEuro(m.margen) : "—"}
                      </td>
                      {!isMobile && <td style={{ padding: pd, textAlign: "right", color: "#94A3B8" }}>{m.anioAnterior > 0 ? fmtEuro(m.anioAnterior) : "—"}</td>}
                      {!isMobile && (
                        <td style={{ padding: pd, textAlign: "right" }}>
                          {variacion !== null
                            ? <span style={{ fontSize: 12, fontWeight: 600, color: variacion >= 0 ? "#10b981" : "#EF4444" }}>{variacion >= 0 ? "↑" : "↓"}{Math.abs(variacion).toFixed(0)}%</span>
                            : <span style={{ color: "#d1d5db" }}>—</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Estado vacío */}
        {!hayDatos && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#94A3B8" }}>
            <TrendingUp style={{ width: 48, height: 48, margin: "0 auto 16px", opacity: 0.3 }} />
            <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>Sin datos de facturación</p>
            <p style={{ fontSize: 14, margin: 0 }}>Crea tu primera factura en la ficha de una obra.</p>
          </div>
        )}
      </div>
    </div>
  );
}
