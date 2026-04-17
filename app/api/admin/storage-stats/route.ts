/**
 * GET /api/admin/storage-stats?tenantId=xxx
 * Estadísticas completas de almacenamiento: totales, desglose por obra y métricas
 */

import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

const QUOTA_BYTES = 1.5 * 1024 * 1024 * 1024; // 1.5 GB referencia visual

function hdr() {
  return { "Content-Type": "application/json", "x-api-key": SERVICE_KEY };
}

async function q(path: string): Promise<any[]> {
  const res = await fetch(`${INSFORGE_URL}${path}`, { headers: hdr() });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

export async function GET(request: NextRequest) {
  const tenantId = new URL(request.url).searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "Falta tenantId" }, { status: 400 });

  try {
    // Obtener obras, archivos y documentos en paralelo
    const [obras, archivos, documentos] = await Promise.all([
      q(`/api/database/records/obras?tenant_id=eq.${tenantId}&select=id,nombre,estado`),
      q(`/api/database/records/archivos?tenant_id=eq.${tenantId}&select=tamano_bytes,tipo,obra_id,created_at`),
      q(`/api/database/records/documentos?tenant_id=eq.${tenantId}&select=tamano_bytes,obra_id,created_at`),
    ]);

    // Totales globales
    const archivosBytes   = archivos.reduce((s, a) => s + (a.tamano_bytes || 0), 0);
    const documentosBytes = documentos.reduce((s, d) => s + (d.tamano_bytes || 0), 0);
    const totalBytes      = archivosBytes + documentosBytes;

    const fotos  = archivos.filter((a) => a.tipo === "foto");
    const videos = archivos.filter((a) => a.tipo === "video");

    const fotosBytes  = fotos.reduce((s, a)  => s + (a.tamano_bytes || 0), 0);
    const videosBytes = videos.reduce((s, a) => s + (a.tamano_bytes || 0), 0);

    const avgFotoKB  = fotos.length  > 0 ? (fotosBytes  / fotos.length  / 1024).toFixed(0) : "0";
    const avgVideoMB = videos.length > 0 ? (videosBytes / videos.length / (1024 * 1024)).toFixed(1) : "0";

    // Desglose por obra (top 10 por tamaño)
    const obraMap = new Map<string, { nombre: string; estado: string; archivosBytes: number; documentosBytes: number; fotosCount: number; videosCount: number; docsCount: number }>();
    for (const o of obras) {
      obraMap.set(o.id, { nombre: o.nombre, estado: o.estado, archivosBytes: 0, documentosBytes: 0, fotosCount: 0, videosCount: 0, docsCount: 0 });
    }
    for (const a of archivos) {
      const o = obraMap.get(a.obra_id);
      if (o) {
        o.archivosBytes += a.tamano_bytes || 0;
        if (a.tipo === "foto") o.fotosCount++; else o.videosCount++;
      }
    }
    for (const d of documentos) {
      const o = obraMap.get(d.obra_id);
      if (o) { o.documentosBytes += d.tamano_bytes || 0; o.docsCount++; }
    }

    const porObra = Array.from(obraMap.entries())
      .map(([id, v]) => ({
        id, nombre: v.nombre, estado: v.estado,
        totalBytes:      v.archivosBytes + v.documentosBytes,
        totalMB:         Math.round((v.archivosBytes + v.documentosBytes) / (1024 * 1024) * 10) / 10,
        archivosBytes:   v.archivosBytes,
        documentosBytes: v.documentosBytes,
        fotosCount:      v.fotosCount,
        videosCount:     v.videosCount,
        docsCount:       v.docsCount,
      }))
      .filter((o) => o.totalBytes > 0)
      .sort((a, b) => b.totalBytes - a.totalBytes)
      .slice(0, 10);

    // Crecimiento últimos 30 días
    const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recientes = [...archivos, ...documentos].filter((a) => a.created_at >= hace30);
    const bytesUltimos30 = recientes.reduce((s, a) => s + (a.tamano_bytes || 0), 0);

    const totalMB  = totalBytes / (1024 * 1024);
    const totalGB  = totalMB / 1024;
    const quotaMB  = QUOTA_BYTES / (1024 * 1024);
    const quotaGB  = quotaMB / 1024;
    const usedPct  = Math.min((totalBytes / QUOTA_BYTES) * 100, 100);

    return NextResponse.json({
      // Totales
      totalBytes, totalMB: Math.round(totalMB * 100) / 100,
      totalGB:    Math.round(totalGB * 100) / 100,
      quotaBytes: QUOTA_BYTES, quotaMB, quotaGB,
      usedPct:    Math.round(usedPct * 10) / 10,

      // Desglose por tipo
      archivosBytes, documentosBytes, fotosBytes, videosBytes,
      archivosCount: archivos.length,
      documentosCount: documentos.length,
      fotosCount: fotos.length,
      videosCount: videos.length,

      // Métricas
      avgFotoKB:     Number(avgFotoKB),
      avgVideoMB:    Number(avgVideoMB),
      obrasConMedia: porObra.length,
      bytesUltimos30,
      mbUltimos30:   Math.round(bytesUltimos30 / (1024 * 1024) * 10) / 10,

      // Por obra
      porObra,
    });
  } catch (error: any) {
    console.error("[storage-stats]", error);
    return NextResponse.json({ error: error?.message ?? "Error" }, { status: 500 });
  }
}
