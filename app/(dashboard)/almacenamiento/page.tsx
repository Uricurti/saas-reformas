"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { HardDrive, RefreshCw, Image, FileVideo, FileText, AlertCircle } from "lucide-react";
import { useTenantId } from "@/lib/stores/auth-store";

interface StorageStats {
  totalBytes: number;
  totalMB: number;
  totalGB: number;
  archivosCount: number;
  documentosCount: number;
  fotosCount: number;
  videosCount: number;
  archivosBytes: number;
  documentosBytes: number;
}

const PRIMARY    = "#607eaa";
const PRIMARY_BG = "#EEF2F8";
const BG_APP     = "#F5F4F1";
const BORDER     = "#EBEBEF";

function StatCard({
  icon, label, value, sub, color = PRIMARY, bgColor = PRIMARY_BG,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  color?: string; bgColor?: string;
}) {
  return (
    <div
      style={{
        background: "#fff", borderRadius: 16, border: `1px solid ${BORDER}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
        padding: "20px 24px",
        display: "flex", alignItems: "flex-start", gap: 16,
      }}
    >
      <div
        style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: bgColor, display: "flex", alignItems: "center",
          justifyContent: "center", color,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          {label}
        </p>
        <p style={{ fontSize: 26, fontWeight: 700, color: "#1A1A2E", lineHeight: 1.1 }}>
          {value}
        </p>
        {sub && (
          <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>{sub}</p>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ label, bytes, totalBytes, color, icon }: {
  label: string; bytes: number; totalBytes: number; color: string; icon: React.ReactNode;
}) {
  const mb  = bytes / (1024 * 1024);
  const pct = totalBytes > 0 ? (bytes / totalBytes) * 100 : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
            {icon}
          </div>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#1A1A2E" }}>{label}</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A2E" }}>
            {mb >= 1000 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`}
          </span>
          <span style={{ fontSize: 12, color: "#94A3B8", marginLeft: 6 }}>
            ({pct.toFixed(1)}%)
          </span>
        </div>
      </div>
      <div style={{ width: "100%", background: "#F0F0F4", borderRadius: 99, height: 8, overflow: "hidden" }}>
        <div
          style={{
            height: "100%", borderRadius: 99, width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}CC, ${color})`,
            transition: "width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 13, color: "#64748B" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>{value}</span>
    </div>
  );
}

export default function AlmacenamientoPage() {
  const tenantId = useTenantId();
  const [stats,   setStats]   = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (tenantId) fetchStats();
  }, [tenantId]);

  const fetchStats = async (manual = false) => {
    if (!tenantId) return;
    if (manual) setRefreshing(true); else setLoading(true);
    try {
      const res = await fetch(`/api/admin/storage-stats?tenantId=${tenantId}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar estadísticas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader title="Almacenamiento" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#94A3B8" }}>
          Cargando estadísticas...
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{ padding: 24 }}>
        <PageHeader title="Almacenamiento" />
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 12, padding: "12px 16px", color: "#991B1B" }}>
          <AlertCircle size={16} />
          <span style={{ fontSize: 14 }}>{error ?? "Error al cargar datos"}</span>
        </div>
      </div>
    );
  }

  const totalLabel = stats.totalGB >= 0.1
    ? `${stats.totalGB.toFixed(2)} GB`
    : `${stats.totalMB.toFixed(1)} MB`;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 900 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A1A2E", margin: 0 }}>Almacenamiento</h1>
        <p style={{ fontSize: 14, color: "#94A3B8", margin: "4px 0 0" }}>Estadísticas de uso actual del sistema</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <StatCard
          icon={<HardDrive size={20} />}
          label="Total usado"
          value={totalLabel}
          sub={`${stats.totalBytes.toLocaleString("es-ES")} bytes`}
          color={PRIMARY}
          bgColor={PRIMARY_BG}
        />
        <StatCard
          icon={<Image size={20} />}
          label="Fotos y vídeos"
          value={String(stats.archivosCount)}
          sub={`📷 ${stats.fotosCount} fotos · 🎥 ${stats.videosCount} vídeos`}
          color="#10B981"
          bgColor="#D1FAE5"
        />
        <StatCard
          icon={<FileText size={20} />}
          label="Documentos"
          value={String(stats.documentosCount)}
          sub="PDFs, planos, contratos"
          color="#F59E0B"
          bgColor="#FEF3C7"
        />
      </div>

      {/* Desglose visual */}
      <div
        style={{
          background: "#fff", borderRadius: 16, border: `1px solid ${BORDER}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "20px 24px", marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1A1A2E", margin: "0 0 20px" }}>
          Desglose por tipo
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <ProgressBar
            label="Archivos (fotos y vídeos)"
            bytes={stats.archivosBytes}
            totalBytes={stats.totalBytes}
            color={PRIMARY}
            icon={<FileVideo size={14} />}
          />
          <ProgressBar
            label="Documentos"
            bytes={stats.documentosBytes}
            totalBytes={stats.totalBytes}
            color="#10B981"
            icon={<FileText size={14} />}
          />
        </div>
      </div>

      {/* Info del sistema */}
      <div
        style={{
          background: "#fff", borderRadius: 16, border: `1px solid ${BORDER}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)", padding: "20px 24px", marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1A1A2E", margin: "0 0 4px" }}>
          Sistema de almacenamiento
        </h2>
        <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 16px" }}>Configuración e información del proveedor</p>
        <div>
          <InfoRow label="Proveedor" value="InsForge (S3/R2 compatible)" />
          <InfoRow label="Límite por archivo" value="~50 MB" />
          <InfoRow label="Compresión fotos" value="Automática → WebP máx. 1 MB" />
          <InfoRow label="Compresión vídeos" value="Automática → 720p H.264 (80-90% reducción)" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
            <span style={{ fontSize: 13, color: "#64748B" }}>Capacidad total</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#10B981" }}>Sin tope — escala según uso</span>
          </div>
        </div>
      </div>

      {/* Botón actualizar */}
      <button
        onClick={() => fetchStats(true)}
        disabled={refreshing}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "#fff", border: `1px solid ${BORDER}`,
          borderRadius: 10, padding: "9px 18px",
          fontSize: 13, fontWeight: 600, color: "#4A5568",
          cursor: refreshing ? "default" : "pointer",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          opacity: refreshing ? 0.6 : 1, transition: "all 0.15s",
        }}
      >
        <RefreshCw size={14} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
        {refreshing ? "Actualizando..." : "Actualizar"}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
