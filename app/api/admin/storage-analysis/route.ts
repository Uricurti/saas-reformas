/**
 * GET /api/admin/storage-analysis?tenantId=xxx
 * Análisis detallado de almacenamiento desglosado por obra + proyección
 */

import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

function adminHeaders() {
  return { "Content-Type": "application/json", "x-api-key": SERVICE_KEY };
}

async function dbQuery(path: string): Promise<any[]> {
  const res = await fetch(`${INSFORGE_URL}${path}`, { headers: adminHeaders() });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

export async function GET(request: NextRequest) {
  const tenantId = new URL(request.url).searchParams.get("tenantId");
  if (!tenantId) {
    return NextResponse.json({ error: "Falta tenantId" }, { status: 400 });
  }

  try {
    // Obtener todas las obras del tenant
    const obras = await dbQuery(
      `/api/database/records/obras?tenant_id=eq.${tenantId}&select=id,nombre`
    );

    if (!obras.length) {
      return NextResponse.json({
        totalUsageMB: 0, totalUsageGB: 0, obraBreakdown: [],
        stats: { obraCount: 0, avgMBPerObra: 0, medianMBPerObra: 0 },
        projection: { currentMB: 0, estimatedIn3Months: 0, estimatedIn6Months: 0, estimatedIn12Months: 0 },
      });
    }

    // Para cada obra, obtener archivos + documentos
    const obraBreakdown = await Promise.all(
      obras.map(async (obra) => {
        const [archivos, documentos] = await Promise.all([
          dbQuery(`/api/database/records/archivos?obra_id=eq.${obra.id}&select=tamano_bytes`),
          dbQuery(`/api/database/records/documentos?obra_id=eq.${obra.id}&select=tamano_bytes`),
        ]);

        const archivosBytes   = archivos.reduce((s, a) => s + (a.tamano_bytes || 0), 0);
        const documentosBytes = documentos.reduce((s, d) => s + (d.tamano_bytes || 0), 0);
        const totalBytes = archivosBytes + documentosBytes;

        return {
          obra_id:          obra.id,
          obra_nombre:      obra.nombre,
          archivos_count:   archivos.length,
          documentos_count: documentos.length,
          total_bytes:      totalBytes,
          total_mb:         Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
        };
      })
    );

    const totalBytes = obraBreakdown.reduce((s, o) => s + o.total_bytes, 0);
    const totalMB    = totalBytes / (1024 * 1024);

    const mbs = obraBreakdown.map((o) => o.total_mb).sort((a, b) => a - b);
    const avgMB    = mbs.length ? mbs.reduce((a, b) => a + b, 0) / mbs.length : 0;
    const medianMB = mbs.length ? mbs[Math.floor(mbs.length / 2)] : 0;

    return NextResponse.json({
      totalUsageBytes: totalBytes,
      totalUsageMB:    Math.round(totalMB * 100) / 100,
      totalUsageGB:    Math.round((totalMB / 1024) * 100) / 100,
      obraBreakdown:   obraBreakdown.sort((a, b) => b.total_mb - a.total_mb),
      stats: {
        obraCount:       obras.length,
        avgMBPerObra:    Math.round(avgMB * 100) / 100,
        medianMBPerObra: Math.round(medianMB * 100) / 100,
        maxUsageObra:    obraBreakdown[0] ?? null,
        minUsageObra:    obraBreakdown[obraBreakdown.length - 1] ?? null,
      },
      projection: {
        currentMB:           Math.round(totalMB * 100) / 100,
        estimatedIn3Months:  Math.round(totalMB * 1.5 * 100) / 100,
        estimatedIn6Months:  Math.round(totalMB * 2.0 * 100) / 100,
        estimatedIn12Months: Math.round(totalMB * 3.0 * 100) / 100,
      },
    });
  } catch (error: any) {
    console.error("[storage-analysis]", error);
    return NextResponse.json({ error: error?.message ?? "Error" }, { status: 500 });
  }
}
