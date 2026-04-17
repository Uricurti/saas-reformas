/**
 * POST /api/media/compress-and-upload
 *
 * Fallback para comprimir vídeos en servidor cuando:
 * 1. Cliente intenta comprimir pero falla (típicamente iOS)
 * 2. Vídeo sin comprimir > 40MB en iOS
 *
 * Flujo:
 * 1. Cliente envía vídeo original (> 50MB OK)
 * 2. Servidor comprime a 720p H.264
 * 3. Servidor sube a InsForge
 * 4. Devuelve URL final
 *
 * NOTA: Esta es una solución heavy. En producción considera:
 * - Cola de comprensión asincrónica (Bull, RabbitMQ)
 * - Worker separado para no bloquear Vercel
 * - Caché de vídeos comprimidos
 */

import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { auth } from "@/lib/insforge/auth";
import { uploadViaPresigned } from "@/lib/insforge/storage";

const execAsync = promisify(exec);

// Timeout corto — si falla, que el cliente lo reintente
const COMPRESSION_TIMEOUT_MS = 30000; // 30 segundos máximo

/**
 * Comprime un archivo de vídeo usando ffmpeg en servidor
 * Entrada: cualquier formato, salida: MP4 720p 28 CRF
 */
async function comprimirVideoEnServidor(
  inputPath: string,
  outputPath: string
): Promise<void> {
  const command = `ffmpeg -i "${inputPath}" -vf "scale=-2:min(720\\,ih)" -c:v libx264 -crf 28 -preset fast -movflags +faststart -c:a aac -b:a 96k "${outputPath}" -y 2>&1`;

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Compresión de vídeo agotó timeout (30s)"));
      }, COMPRESSION_TIMEOUT_MS);

      exec(command, (error, stdout, stderr) => {
        clearTimeout(timeout);
        if (error) {
          console.error("[compress-video] ffmpeg error:", stderr);
          reject(error);
        } else {
          resolve();
        }
      });
    });
  } catch (error: any) {
    throw new Error(`Error comprimiendo vídeo: ${error?.message ?? "desconocido"}`);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let tempInputPath: string | null = null;
  let tempOutputPath: string | null = null;

  try {
    const formData = await request.formData();
    const videoFile = formData.get("video") as File;
    const tenantId = formData.get("tenantId") as string;
    const obraId = formData.get("obraId") as string;
    const userId = formData.get("userId") as string;

    if (!videoFile || !tenantId || !obraId || !userId) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos" },
        { status: 400 }
      );
    }

    if (!videoFile.type.startsWith("video/")) {
      return NextResponse.json(
        { error: "El archivo debe ser un vídeo" },
        { status: 400 }
      );
    }

    const mb = videoFile.size / (1024 * 1024);
    if (mb > 200) {
      return NextResponse.json(
        { error: `Vídeo demasiado grande (${Math.round(mb)} MB). Máximo 200 MB sin comprimir.` },
        { status: 413 }
      );
    }

    console.log(`[compress-and-upload] Procesando vídeo: ${videoFile.name} (${Math.round(mb)} MB)`);

    // 1. Guardar archivo temporal
    const tmpDir = os.tmpdir();
    const ext = videoFile.name.split(".").pop() || "mp4";
    tempInputPath = path.join(tmpDir, `video_input_${Date.now()}.${ext}`);
    tempOutputPath = path.join(tmpDir, `video_output_${Date.now()}.mp4`);

    const buffer = await videoFile.arrayBuffer();
    fs.writeFileSync(tempInputPath, Buffer.from(buffer));

    // 2. Comprimir
    console.log(`[compress-and-upload] Comprimiendo ${videoFile.name}...`);
    await comprimirVideoEnServidor(tempInputPath, tempOutputPath);

    // 3. Leer resultado comprimido
    const comprimidoBuffer = fs.readFileSync(tempOutputPath);
    const comprimidoMB = (comprimidoBuffer.length / (1024 * 1024)).toFixed(2);
    const compressionRatio = ((1 - comprimidoBuffer.length / videoFile.size) * 100).toFixed(0);

    console.log(
      `[compress-and-upload] Compresión exitosa: ${mb} MB → ${comprimidoMB} MB (${compressionRatio}% reducción)`
    );

    // 4. Subir a InsForge
    const storagePath = `${tenantId}/${obraId}/${userId}/${Date.now()}_compressed.mp4`;
    const blob = new Blob([comprimidoBuffer], { type: "video/mp4" });
    const comprimidoFile = new File([blob], "video.mp4", { type: "video/mp4" });

    const { storedPath, error } = await uploadViaPresigned(
      comprimidoFile,
      storagePath,
      "video/mp4"
    );

    if (error || !storedPath) {
      return NextResponse.json(
        { error: `Error subiendo vídeo: ${error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: storedPath,
      tamano: comprimidoBuffer.length,
      tamanomB: parseFloat(comprimidoMB),
      compressionRatio: parseInt(compressionRatio),
      originalMB: parseFloat(mb.toFixed(2)),
      message: `Vídeo comprimido exitosamente: ${mb} MB → ${comprimidoMB} MB`,
    });
  } catch (error: any) {
    console.error("[compress-and-upload] Error:", error);
    return NextResponse.json(
      {
        error: error?.message ?? "Error procesando vídeo",
        hint: "El vídeo es demasiado grande o el servidor está sobrecargado. Intenta con un clip más corto.",
      },
      { status: 500 }
    );
  } finally {
    // Limpiar archivos temporales
    if (tempInputPath && fs.existsSync(tempInputPath)) {
      try {
        fs.unlinkSync(tempInputPath);
      } catch (e) {
        console.warn("[compress-and-upload] No se pudo eliminar temp input:", e);
      }
    }
    if (tempOutputPath && fs.existsSync(tempOutputPath)) {
      try {
        fs.unlinkSync(tempOutputPath);
      } catch (e) {
        console.warn("[compress-and-upload] No se pudo eliminar temp output:", e);
      }
    }
  }
}
