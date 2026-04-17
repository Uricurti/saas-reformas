"use client";

import { useEffect, useState } from "react";
import { HardDrive, RefreshCw, Image, FileVideo, FileText, AlertCircle,
         TrendingUp, Camera, Video, Building2, Zap } from "lucide-react";
import { useTenantId } from "@/lib/stores/auth-store";

interface ObraStats {
  id: string; nombre: string; estado: string;
  totalBytes: number; totalMB: number;
  archivosBytes: number; documentosBytes: number;
  fotosCount: number; videosCount: number; docsCount: number;
}

interface StorageStats {
  totalBytes: number; totalMB: number; totalGB: number;
  quotaBytes: number; quotaMB: number; quotaGB: number;
  usedPct: number;
  archivosBytes: number; documentosBytes: number;
  fotosBytes: number; videosBytes: number;
  archivosCount: number; documentosCount: number;
  fotosCount: number; videosCount: number;
  avgFotoKB: number; avgVideoMB: number;
  obrasConMedia: number;
  bytesUltimos30: number; mbUltimos30: number;
  porObra: ObraStats[];
}

/* ─── Paleta ───────────────────────────────────────────── */
const P   = "#607eaa";
const PBG = "#EEF2F8";
const B   = "#EBEBEF";

/* ─── Helpers ──────────────────────────────────────────── */
function fmtBytes(b: number) {
  if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (b >= 1024 * 1024)        return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}

function pct(part: number, total: number) {
  return total > 0 ? Math.min((part / total) * 100, 100) : 0;
}

/* ─── Sub-componentes ──────────────────────────────────── */
function MiniStat({ icon, label, value, sub, color, bg, m }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color: string; bg: string; m: boolean;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: `1px solid ${B}`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)",
      padding: m ? "14px 16px" : "18px 20px",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{ width: m ? 38 : 44, height: m ? 38 : 44, borderRadius: 11, flexShrink: 0, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{label}</p>
        <p style={{ fontSize: m ? 20 : 24, fontWeight: 700, color: "#1A1A2E", margin: "2px 0 0", lineHeight: 1.1 }}>{value}</p>
        {sub && <p style={{ fontSize: 11, color: "#94A3B8", margin: "3px 0 0" }}>{sub}</p>}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, note, color, m }: {
  icon: React.ReactNode; label: string; value: string; note: string; color: string; m: boolean;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, border: `1px solid ${B}`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      padding: m ? "14px 16px" : "16px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
          {icon}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B" }}>{label}</span>
      </div>
      <p style={{ fontSize: m ? 22 : 26, fontWeight: 800, color: "#1A1A2E", margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 11, color: "#94A3B8", margin: "5px 0 0" }}>{note}</p>
    </div>
  );
}

export default function AlmacenamientoPage() {
  const tenantId  = useTenantId();
  const [data,    setData]    = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [spin,    setSpin]    = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { if (tenantId) load(); }, [tenantId]);

  const load = async (manual = false) => {
    if (!tenantId) return;
    if (manual) setSpin(true); else setLoading(true);
    try {
      const res = await fetch(`/api/admin/storage-stats?tenantId=${tenantId}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar");
    } finally { setLoading(false); setSpin(false); }
  };

  const pad = isMobile ? "16px" : "24px 28px";

  if (loading) return (
    <div style={{ padding: pad, color: "#94A3B8", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 260, fontSize: 14 }}>
      Cargando estadísticas...
    </div>
  );

  if (error || !data) return (
    <div style={{ padding: pad }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px", color: "#991B1B", fontSize: 13 }}>
        <AlertCircle size={15} />{error ?? "Error al cargar"}
      </div>
    </div>
  );

  const usedColor = data.usedPct >= 80 ? "#EF4444" : data.usedPct >= 60 ? "#F59E0B" : "#10B981";

  return (
    <div style={{ padding: pad, maxWidth: 960 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: isMobile ? 16 : 22, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: "#1A1A2E", margin: 0 }}>Almacenamiento</h1>
          <p style={{ fontSize: 13, color: "#94A3B8", margin: "3px 0 0" }}>Uso actual del sistema · referencia {data.quotaGB} GB</p>
        </div>
        <button
          onClick={() => load(true)} disabled={spin}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#fff", border: `1px solid ${B}`, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "#4A5568", cursor: spin ? "default" : "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", opacity: spin ? 0.6 : 1, flexShrink: 0 }}
        >
          <RefreshCw size={13} style={{ animation: spin ? "spin 0.8s linear infinite" : "none" }} />
          {spin ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {/* ── Barra cuota principal ── */}
      <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${B}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: isMobile ? "16px" : "20px 24px", marginBottom: isMobile ? 12 : 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: PBG, display: "flex", alignItems: "center", justifyContent: "center", color: P }}>
              <HardDrive size={18} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1A2E", margin: 0 }}>Espacio total usado</p>
              <p style={{ fontSize: 11, color: "#94A3B8", margin: 0 }}>de {data.quotaGB} GB de referencia</p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: "#1A1A2E", margin: 0, lineHeight: 1 }}>
              {data.totalGB >= 0.1 ? `${data.totalGB.toFixed(2)} GB` : `${data.totalMB.toFixed(0)} MB`}
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: usedColor, margin: 0 }}>{data.usedPct}% usado</p>
          </div>
        </div>
        {/* Barra apilada fotos + docs */}
        <div style={{ width: "100%", background: "#F0F0F4", borderRadius: 99, height: 10, overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${pct(data.fotosBytes + data.videosBytes, data.quotaBytes)}%`, background: `linear-gradient(90deg, ${P}CC, ${P})`, transition: "width 0.7s cubic-bezier(0.34,1.56,0.64,1)" }} />
          <div style={{ width: `${pct(data.documentosBytes, data.quotaBytes)}%`, background: "linear-gradient(90deg, #10B981CC, #10B981)", transition: "width 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s" }} />
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 99, background: P }} />
            <span style={{ fontSize: 11, color: "#64748B" }}>Fotos/vídeos · {fmtBytes(data.fotosBytes + data.videosBytes)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 99, background: "#10B981" }} />
            <span style={{ fontSize: 11, color: "#64748B" }}>Documentos · {fmtBytes(data.documentosBytes)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>Libre: {fmtBytes(data.quotaBytes - data.totalBytes)}</span>
          </div>
        </div>
      </div>

      {/* ── Cards principales ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 12, marginBottom: isMobile ? 12 : 16 }}>
        <MiniStat icon={<Camera size={isMobile ? 16 : 18} />} label="Fotos" value={String(data.fotosCount)} sub={fmtBytes(data.fotosBytes)} color={P} bg={PBG} m={isMobile} />
        <MiniStat icon={<Video size={isMobile ? 16 : 18} />} label="Vídeos" value={String(data.videosCount)} sub={fmtBytes(data.videosBytes)} color="#8B5CF6" bg="#EDE9FE" m={isMobile} />
        <MiniStat icon={<FileText size={isMobile ? 16 : 18} />} label="Documentos" value={String(data.documentosCount)} sub={fmtBytes(data.documentosBytes)} color="#10B981" bg="#D1FAE5" m={isMobile} />
        <MiniStat icon={<Building2 size={isMobile ? 16 : 18} />} label="Obras con media" value={String(data.obrasConMedia)} sub="con archivos subidos" color="#F59E0B" bg="#FEF3C7" m={isMobile} />
      </div>

      {/* ── Métricas originales ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 12, marginBottom: isMobile ? 12 : 16 }}>
        <MetricCard icon={<Camera size={13} />} label="Peso medio foto" value={`${data.avgFotoKB} KB`} note="Tras compresión WebP" color={P} m={isMobile} />
        <MetricCard icon={<FileVideo size={13} />} label="Peso medio vídeo" value={`${data.avgVideoMB} MB`} note="Tras compresión 720p" color="#8B5CF6" m={isMobile} />
        <MetricCard icon={<TrendingUp size={13} />} label="Subido 30 días" value={fmtBytes(data.bytesUltimos30)} note="Actividad reciente" color="#10B981" m={isMobile} />
        <MetricCard
          icon={<Zap size={13} />}
          label="Eficiencia compresión"
          value={data.videosCount > 0 ? "~88%" : data.fotosCount > 0 ? "~85%" : "—"}
          note="Reducción vs. original"
          color="#F59E0B"
          m={isMobile}
        />
      </div>

      {/* ── Desglose por obra ── */}
      {data.porObra.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 16, border: `1px solid ${B}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: isMobile ? "16px" : "20px 24px", marginBottom: isMobile ? 12 : 16 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#1A1A2E", margin: "0 0 16px" }}>Almacenamiento por obra</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.porObra.map((o, i) => {
              const obraPct = pct(o.totalBytes, data.totalBytes);
              const barColor = i === 0 ? P : i === 1 ? "#8B5CF6" : i === 2 ? "#10B981" : "#94A3B8";
              return (
                <div key={o.id}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", flexShrink: 0, width: 18 }}>{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.nombre}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: o.estado === "activa" ? "#10B981" : "#94A3B8", background: o.estado === "activa" ? "#D1FAE5" : "#F3F4F6", padding: "1px 7px", borderRadius: 99, flexShrink: 0 }}>
                        {o.estado}
                      </span>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1A1A2E" }}>{fmtBytes(o.totalBytes)}</span>
                      <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 5 }}>({obraPct.toFixed(0)}%)</span>
                    </div>
                  </div>
                  <div style={{ width: "100%", background: "#F0F0F4", borderRadius: 99, height: 5, overflow: "hidden" }}>
                    <div style={{ width: `${obraPct}%`, height: "100%", background: barColor, borderRadius: 99, transition: "width 0.5s ease" }} />
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>📷 {o.fotosCount} · 🎥 {o.videosCount} · 📄 {o.docsCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Info del sistema ── */}
      <div style={{ background: `${PBG}`, borderRadius: 14, border: `1px solid ${P}22`, padding: isMobile ? "14px" : "16px 20px" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#1c3879", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
          <HardDrive size={14} /> Sistema de almacenamiento
        </p>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 4 : 6 }}>
          {[
            ["Proveedor",          "InsForge (S3/R2) · Sin tope real"],
            ["Límite por archivo", "~50 MB máximo"],
            ["Compresión fotos",   "WebP automático · máx. 1 MB"],
            ["Compresión vídeos",  "720p H.264 · 80-90% reducción"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#607eaa", fontWeight: 600, flexShrink: 0 }}>{k}:</span>
              <span style={{ fontSize: 12, color: "#1c3879" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
