"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { AlertCircle, TrendingUp, BarChart3 } from "lucide-react";

interface StorageAnalysis {
  totalUsageBytes: number;
  totalUsageMB: number;
  totalUsageGB: number;
  obraBreakdown: Array<{
    obra_id: string;
    obra_nombre: string;
    archivos_count: number;
    documentos_count: number;
    archivos_bytes: number;
    documentos_bytes: number;
    total_bytes: number;
    total_mb: number;
  }>;
  stats: {
    obraCount: number;
    avgMBPerObra: number;
    medianMBPerObra: number;
    maxUsageObra: { nombre: string; mb: number };
    minUsageObra: { nombre: string; mb: number };
  };
  projection: {
    currentMB: number;
    estimatedIn3Months: number;
    estimatedIn6Months: number;
    estimatedIn12Months: number;
    assumptions: string;
  };
  insforgeInfo: {
    bucketName: string;
    currentProvider: string;
    softLimit: string;
    recommendation: string;
  };
}

export default function AnalisisAlmacenamientoPage() {
  const [analysis, setAnalysis] = useState<StorageAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/storage-analysis");
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setAnalysis(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar análisis");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Análisis de almacenamiento" />
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-500">Cargando análisis...</div>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="p-6">
        <PageHeader title="Análisis de almacenamiento" />
        <div className="alert alert-error">
          <AlertCircle className="w-5 h-5" />
          <span>{error ?? "Error al cargar datos"}</span>
        </div>
      </div>
    );
  }

  const { stats, projection, insforgeInfo, obraBreakdown } = analysis;

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Análisis de almacenamiento"
        subtitle="Estadísticas y proyección de crecimiento"
      />

      {/* Resumen actual */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Almacenamiento actual</div>
          <div className="text-3xl font-bold text-gray-900">
            {analysis.totalUsageGB > 0
              ? `${analysis.totalUsageGB.toFixed(2)} GB`
              : `${analysis.totalUsageMB.toFixed(1)} MB`}
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Número de obras</div>
          <div className="text-3xl font-bold text-gray-900">{stats.obraCount}</div>
          <div className="text-xs text-gray-500 mt-1">
            Promedio: {stats.avgMBPerObra.toFixed(1)} MB/obra
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Uso mayor</div>
          <div className="text-lg font-bold text-gray-900">
            {stats.maxUsageObra.nombre}
          </div>
          <div className="text-sm text-gray-600">
            {stats.maxUsageObra.mb.toFixed(1)} MB
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-gray-600 mb-1">Uso menor</div>
          <div className="text-lg font-bold text-gray-900">
            {stats.minUsageObra.nombre}
          </div>
          <div className="text-sm text-gray-600">
            {stats.minUsageObra.mb.toFixed(1)} MB
          </div>
        </div>
      </div>

      {/* Proyección */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Proyección de crecimiento (lineal estimada)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs text-blue-600 font-semibold">Ahora</div>
            <div className="text-2xl font-bold text-blue-900 mt-1">
              {projection.currentMB > 1024
                ? `${(projection.currentMB / 1024).toFixed(2)} GB`
                : `${projection.currentMB.toFixed(1)} MB`}
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-xs text-green-600 font-semibold">En 3 meses</div>
            <div className="text-2xl font-bold text-green-900 mt-1">
              {projection.estimatedIn3Months > 1024
                ? `${(projection.estimatedIn3Months / 1024).toFixed(2)} GB`
                : `${projection.estimatedIn3Months.toFixed(1)} MB`}
            </div>
          </div>

          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-xs text-yellow-600 font-semibold">En 6 meses</div>
            <div className="text-2xl font-bold text-yellow-900 mt-1">
              {projection.estimatedIn6Months > 1024
                ? `${(projection.estimatedIn6Months / 1024).toFixed(2)} GB`
                : `${projection.estimatedIn6Months.toFixed(1)} MB`}
            </div>
          </div>

          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="text-xs text-orange-600 font-semibold">En 12 meses</div>
            <div className="text-2xl font-bold text-orange-900 mt-1">
              {projection.estimatedIn12Months > 1024
                ? `${(projection.estimatedIn12Months / 1024).toFixed(2)} GB`
                : `${projection.estimatedIn12Months.toFixed(1)} MB`}
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-700 font-mono whitespace-pre-wrap">
          {projection.assumptions}
        </div>
      </div>

      {/* InsForge info */}
      <div className="card mb-6 bg-blue-50 border border-blue-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Información InsForge</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Bucket:</span>
            <span className="font-mono text-gray-900">{insforgeInfo.bucketName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Proveedor:</span>
            <span className="font-mono text-gray-900">{insforgeInfo.currentProvider}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Límite:</span>
            <span className="text-gray-900">{insforgeInfo.softLimit}</span>
          </div>
          <div className="pt-2 border-t border-blue-200">
            <span className="text-gray-600">Recomendación:</span>
            <div className="text-gray-900 font-semibold">
              {insforgeInfo.recommendation}
            </div>
          </div>
        </div>
      </div>

      {/* Desglose por obra */}
      {obraBreakdown.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Desglose por obra
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-2 text-gray-600 font-semibold">
                    Obra
                  </th>
                  <th className="text-right px-4 py-2 text-gray-600 font-semibold">
                    Fotos
                  </th>
                  <th className="text-right px-4 py-2 text-gray-600 font-semibold">
                    Documentos
                  </th>
                  <th className="text-right px-4 py-2 text-gray-600 font-semibold">
                    Total MB
                  </th>
                  <th className="text-right px-4 py-2 text-gray-600 font-semibold">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {obraBreakdown.map((obra) => {
                  const percentage = analysis.totalUsageMB > 0
                    ? ((obra.total_mb / analysis.totalUsageMB) * 100).toFixed(1)
                    : "0";
                  return (
                    <tr
                      key={obra.obra_id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-900 font-medium">
                        {obra.obra_nombre}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {obra.archivos_count}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {obra.documentos_count}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {obra.total_mb.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {percentage}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={fetchAnalysis}
        className="btn btn-secondary mt-6"
      >
        Actualizar análisis
      </button>
    </div>
  );
}
