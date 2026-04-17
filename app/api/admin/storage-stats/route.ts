/**
 * GET /api/admin/storage-stats
 * Calcula estadísticas de almacenamiento actuales
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/insforge/auth";
import insforge from "@/lib/insforge/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const tenantId = session.user.tenant_id;

    // Obtener archivos
    const { data: archivos } = await insforge.database
      .from("archivos")
      .select("tamano_bytes, tipo, created_at")
      .eq("tenant_id", tenantId);

    // Obtener documentos
    const { data: documentos } = await insforge.database
      .from("documentos")
      .select("tamano_bytes, created_at")
      .eq("tenant_id", tenantId);

    // Calcular totales
    const archivosBytes = (archivos || []).reduce((sum, a: any) => sum + (a.tamano_bytes || 0), 0);
    const documentosBytes = (documentos || []).reduce((sum, d: any) => sum + (d.tamano_bytes || 0), 0);
    const totalBytes = archivosBytes + documentosBytes;

    // Desglose por tipo
    const fotos = (archivos || []).filter((a: any) => a.tipo === "foto").length;
    const videos = (archivos || []).filter((a: any) => a.tipo === "video").length;

    const totalMB = totalBytes / (1024 * 1024);
    const totalGB = totalMB / 1024;

    return NextResponse.json({
      totalBytes,
      totalMB: Math.round(totalMB * 100) / 100,
      totalGB: Math.round(totalGB * 100) / 100,
      archivosCount: archivos?.length || 0,
      documentosCount: documentos?.length || 0,
      fotosCount: fotos,
      videosCount: videos,
      archivosBytes,
      documentosBytes,
    });
  } catch (error: any) {
    console.error("[storage-stats]", error);
    return NextResponse.json(
      { error: error?.message ?? "Error" },
      { status: 500 }
    );
  }
}
