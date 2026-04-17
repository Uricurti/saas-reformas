"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { HardDrive, RefreshCw, AlertCircle } from "lucide-react";

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

export default function AlmacenamientoPage() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/storage-stats");
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar estadísticas");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Almacenamiento" />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Cargando estadísticas...</div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6">
        <PageHeader title="Almacenamiento" />
        <div className="alert alert-error">
          <AlertCircle className="w-5 h-5" />
          <span>{error ?? "Error al cargar datos"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader
        title="Almacenamiento"
        subtitle="Estadísticas de uso actual del sistema"
      />

      {/* Cards principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total usado</span>
            <HardDrive className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.totalGB > 0 ? `${stats.totalGB.toFixed(2)} GB` : `${stats.totalMB.toFixed(1)} MB`}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {stats.totalBytes.toLocaleString()} bytes
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-2">Archivos (fotos/vídeos)</div>
          <div className="text-3xl font-bold text-gray-900">{stats.archivosCount}</div>
          <div className="text-xs text-gray-500 mt-2">
            📷 {stats.fotosCount} · 🎥 {stats.videosCount}
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-2">Documentos</div>
          <div className="text-3xl font-bold text-gray-900">{stats.documentosCount}</div>
          <div className="text-xs text-gray-500 mt-2">
            PDFs, planos, imágenes
          </div>
        </div>
      </div>

      {/* Desglose */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Desglose por tipo</h3>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-700">Archivos (fotos/vídeos)</span>
              <span className="font-semibold text-gray-900">
                {(stats.archivosBytes / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{
                  width: stats.totalMB > 0
                    ? `${(stats.archivosBytes / stats.totalBytes) * 100}%`
                    : "0%",
                }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-700">Documentos</span>
              <span className="font-semibold text-gray-900">
                {(stats.documentosBytes / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{
                  width: stats.totalMB > 0
                    ? `${(stats.documentosBytes / stats.totalBytes) * 100}%`
                    : "0%",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Info sobre InsForge */}
      <div className="card p-4 bg-blue-50 border border-blue-200">
        <h3 className="font-semibold text-gray-900 mb-2">ℹ️ Sistema de almacenamiento</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• <strong>Proveedor</strong>: InsForge (S3/R2 compatible)</li>
          <li>• <strong>Límite de archivo</strong>: ~50 MB máximo</li>
          <li>• <strong>Compresión</strong>: Activa en fotos (WebP) y vídeos (720p H.264)</li>
          <li>• <strong>Escalabilidad</strong>: Sin límites de almacenamiento total</li>
        </ul>
      </div>

      <button
        onClick={fetchStats}
        className="btn btn-secondary mt-6 flex items-center gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        Actualizar
      </button>
    </div>
  );
}
