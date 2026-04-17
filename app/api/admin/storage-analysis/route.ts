/**
 * GET /api/admin/storage-analysis
 *
 * Análisis detallado de almacenamiento:
 * - Uso actual desglosado por obra
 * - Promedio de MB por obra
 * - Proyección de crecimiento a futuro
 *
 * Útil para estimar si InsForge será suficiente en 5-12 meses
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/insforge/auth";
import insforge from "@/lib/insforge/client";

interface ObraStorage {
  obra_id: string;
  obra_nombre: string;
  archivos_count: number;
  documentos_count: number;
  archivos_bytes: number;
  documentos_bytes: number;
  total_bytes: number;
  total_mb: number;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const tenantId = session.user.tenant_id;

    // 1. Obtener todas las obras del tenant
    const { data: obras } = await insforge.database
      .from("obras")
      .select("id, nombre")
      .eq("tenant_id", tenantId);

    if (!obras || obras.length === 0) {
      return NextResponse.json({
        totalUsageBytes: 0,
        totalUsageMB: 0,
        obraBreakdown: [],
        stats: {
          obraCount: 0,
          avgMBPerObra: 0,
          maxUsageObra: null,
          minUsageObra: null,
          medianMBPerObra: 0,
        },
        projection: {
          currentMB: 0,
          estimatedIn3Months: 0,
          estimatedIn6Months: 0,
          estimatedIn12Months: 0,
          assumptions: "Sin obras en el sistema aún",
        },
      });
    }

    let totalBytes = 0;
    const obraBreakdown: ObraStorage[] = [];
    const obraMBArray: number[] = [];

    // 2. Para cada obra, sumar archivos + documentos
    for (const obra of obras) {
      const { data: archivos } = await insforge.database
        .from("archivos")
        .select("tamano_bytes")
        .eq("obra_id", obra.id);

      const { data: documentos } = await insforge.database
        .from("documentos")
        .select("tamano_bytes")
        .eq("obra_id", obra.id);

      const archivosBytes = (archivos || []).reduce(
        (sum: number, a: any) => sum + (a.tamano_bytes || 0),
        0
      );

      const documentosBytes = (documentos || []).reduce(
        (sum: number, d: any) => sum + (d.tamano_bytes || 0),
        0
      );

      const totalObraBytes = archivosBytes + documentosBytes;
      const totalObraMB = totalObraBytes / (1024 * 1024);

      totalBytes += totalObraBytes;
      obraMBArray.push(totalObraMB);

      obraBreakdown.push({
        obra_id: obra.id,
        obra_nombre: obra.nombre,
        archivos_count: archivos?.length || 0,
        documentos_count: documentos?.length || 0,
        archivos_bytes: archivosBytes,
        documentos_bytes: documentosBytes,
        total_bytes: totalObraBytes,
        total_mb: Math.round(totalObraMB * 100) / 100,
      });
    }

    // 3. Calcular estadísticas
    const totalMB = totalBytes / (1024 * 1024);
    const avgMBPerObra = obraMBArray.length > 0 ? obraMBArray.reduce((a, b) => a + b, 0) / obraMBArray.length : 0;

    // Ordenar para mediana
    const sortedMB = [...obraMBArray].sort((a, b) => a - b);
    const medianMBPerObra = sortedMB.length > 0
      ? sortedMB[Math.floor(sortedMB.length / 2)]
      : 0;

    const maxUsage = obraBreakdown.reduce((max, o) => o.total_mb > max.total_mb ? o : max, obraBreakdown[0]);
    const minUsage = obraBreakdown.reduce((min, o) => o.total_mb < min.total_mb ? o : min, obraBreakdown[0]);

    // 4. Proyecciones (muy aproximadas, dependen de:
    //    - Velocidad de crecimiento de obras
    //    - Promedio de fotos/videos por obra
    //    - Efectividad de compresión)
    const assumptions = `
Basado en:
- Obras actuales: ${obras.length}
- Promedio por obra: ${avgMBPerObra.toFixed(1)} MB
- Mediana por obra: ${medianMBPerObra.toFixed(1)} MB (mejor estimador si hay outliers)

NOTA: Estas proyecciones son ESTIMACIONES basadas en el crecimiento lineal.
El crecimiento real puede variar mucho según:
  • Número de nuevas obras por mes
  • Fotos/vídeos promedio por obra
  • Calidad de compresión (actualmente muy agresiva)
  • Retención vs. limpieza de archivos antiguos
    `.trim();

    // Proyección simple: si tenemos X obras con Y MB promedio
    // En 3 meses (+50% obras) → X*1.5 * Y MB
    // En 6 meses (+100%) → X*2 * Y MB
    // En 12 meses (+200%) → X*3 * Y MB
    const estimatedIn3Months = totalMB * 1.5;
    const estimatedIn6Months = totalMB * 2.0;
    const estimatedIn12Months = totalMB * 3.0;

    // 5. Respuesta
    return NextResponse.json({
      totalUsageBytes: totalBytes,
      totalUsageMB: Math.round(totalMB * 100) / 100,
      totalUsageGB: Math.round((totalMB / 1024) * 100) / 100,
      obraBreakdown: obraBreakdown.sort((a, b) => b.total_mb - a.total_mb),
      stats: {
        obraCount: obras.length,
        avgMBPerObra: Math.round(avgMBPerObra * 100) / 100,
        medianMBPerObra: Math.round(medianMBPerObra * 100) / 100,
        maxUsageObra: {
          nombre: maxUsage.obra_nombre,
          mb: maxUsage.total_mb,
        },
        minUsageObra: {
          nombre: minUsage.obra_nombre,
          mb: minUsage.total_mb,
        },
      },
      projection: {
        currentMB: Math.round(totalMB * 100) / 100,
        estimatedIn3Months: Math.round(estimatedIn3Months * 100) / 100,
        estimatedIn6Months: Math.round(estimatedIn6Months * 100) / 100,
        estimatedIn12Months: Math.round(estimatedIn12Months * 100) / 100,
        assumptions,
      },
      insforgeInfo: {
        bucketName: "obras-media",
        currentProvider: "InsForge (S3/R2 compatible)",
        softLimit: "Teóricamente ilimitado, pero costos aumentan con uso",
        recommendation: "Revisar esta análisis cada 3 meses para detectar tendencias",
      },
    });
  } catch (error: any) {
    console.error("[storage-analysis]", error);
    return NextResponse.json(
      { error: error?.message ?? "Error al analizar almacenamiento" },
      { status: 500 }
    );
  }
}
