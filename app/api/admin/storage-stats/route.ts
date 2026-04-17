/**
 * GET /api/admin/storage-stats?tenantId=xxx
 * Calcula estadísticas de almacenamiento actuales
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
    // Obtener archivos y documentos con sus tamaños
    const [archivos, documentos] = await Promise.all([
      dbQuery(`/api/database/records/archivos?tenant_id=eq.${tenantId}&select=tamano_bytes,tipo`),
      dbQuery(`/api/database/records/documentos?tenant_id=eq.${tenantId}&select=tamano_bytes`),
    ]);

    const archivosBytes = archivos.reduce((sum, a) => sum + (a.tamano_bytes || 0), 0);
    const documentosBytes = documentos.reduce((sum, d) => sum + (d.tamano_bytes || 0), 0);
    const totalBytes = archivosBytes + documentosBytes;

    const fotos  = archivos.filter((a) => a.tipo === "foto").length;
    const videos = archivos.filter((a) => a.tipo === "video").length;

    const totalMB = totalBytes / (1024 * 1024);
    const totalGB = totalMB / 1024;

    return NextResponse.json({
      totalBytes,
      totalMB:        Math.round(totalMB * 100) / 100,
      totalGB:        Math.round(totalGB * 100) / 100,
      archivosCount:  archivos.length,
      documentosCount: documentos.length,
      fotosCount:     fotos,
      videosCount:    videos,
      archivosBytes,
      documentosBytes,
    });
  } catch (error: any) {
    console.error("[storage-stats]", error);
    return NextResponse.json({ error: error?.message ?? "Error" }, { status: 500 });
  }
}
