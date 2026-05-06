/**
 * Compresión de vídeo usando APIs nativas del navegador (WebCodecs + Canvas + mp4-muxer 5.1.3).
 *
 * Compatible con:
 *   - iOS Safari 16.4+  ✅
 *   - Android Chrome 94+ ✅
 *   - Chrome/Edge desktop ✅
 *   - Firefox ❌ (WebCodecs no soportado → lanza error descriptivo)
 *
 * Si el archivo ya pesa ≤ 40 MB, se devuelve sin comprimir.
 */

const TARGET_MB     = 40;
const TARGET_BYTES  = TARGET_MB * 1024 * 1024;
const AUDIO_BITRATE = 128_000;   // bps
const MAX_DIM       = 1280;      // px (lado mayor máximo)
const PLAYBACK_RATE = 2;         // 2× = procesa más rápido

// Límite de bitrate de vídeo para compatibilidad con hardware de móvil
const MAX_VIDEO_BITRATE = 2_500_000; // 2.5 Mbps

// Umbral de tamaño para omitir la extracción de audio (evita OOM en iOS)
const SKIP_AUDIO_IF_FILE_LARGER_MB = 80;

// Codecs en orden de preferencia: primero los de menor perfil/nivel (más compatibles)
const H264_CODECS = [
  "avc1.42001F",  // Baseline Level 3.1 — más compatible, perfecto para 720p
  "avc1.42E028",  // Baseline Level 4.0
  "avc1.42C028",  // Constrained Baseline Level 4.0
  "avc1.4D001F",  // Main Level 3.1
  "avc1.4D0028",  // Main Level 4.0
];

export function webCodecsDisponible(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof AudioEncoder !== "undefined" &&
    typeof VideoFrame   !== "undefined"
  );
}

export async function comprimirVideoNativo(
  file: File,
  onProgress?: (etapa: string, pct: number) => void
): Promise<File> {

  // ── Si ya pesa ≤ 40 MB, devolver sin tocar ───────────────────────────────
  if (file.size <= TARGET_BYTES) return file;

  if (!webCodecsDisponible()) {
    throw new Error(
      "WebCodecs no disponible en este navegador. Usa Chrome o Safari 16.4+ para subir vídeos grandes."
    );
  }

  onProgress?.("Analizando vídeo…", 2);

  // ── 1. Elemento <video> en DOM (necesario para requestVideoFrameCallback) ─
  const objectUrl = URL.createObjectURL(file);
  const video     = document.createElement("video");
  video.muted       = true;
  video.playsInline = true;
  video.preload     = "auto";
  video.style.cssText = "position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;top:-9999px;left:-9999px;";
  document.body.appendChild(video);
  video.src = objectUrl;

  function cleanup() {
    try { video.pause(); }                          catch { /* ok */ }
    try { document.body.removeChild(video); }       catch { /* ok */ }
    URL.revokeObjectURL(objectUrl);
  }

  try {
    // ── 2. Esperar metadatos ────────────────────────────────────────────────
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error(`Error cargando vídeo: ${video.error?.message ?? "desconocido"}`));
      setTimeout(() => reject(new Error("Timeout cargando metadatos (>30s)")), 30_000);
    });

    const duracion = video.duration;
    const srcW     = video.videoWidth;
    const srcH     = video.videoHeight;

    if (!srcW || !srcH || !duracion || !isFinite(duracion)) {
      throw new Error(`Metadatos inválidos (w=${srcW} h=${srcH} dur=${duracion})`);
    }

    // ── 3. Dimensiones de salida (max 1280px, múltiplos de 2) ──────────────
    const escala = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
    const outW   = Math.round(srcW * escala / 2) * 2;
    const outH   = Math.round(srcH * escala / 2) * 2;

    // ── 4. Bitrate acotado para llegar a ~40 MB ────────────────────────────
    // Cap a MAX_VIDEO_BITRATE para evitar fallo del encoder hardware en móvil
    const videoBitrate = Math.max(
      300_000,
      Math.min(
        MAX_VIDEO_BITRATE,
        Math.floor((TARGET_BYTES * 8 - AUDIO_BITRATE * duracion) / duracion)
      )
    );

    // ── 5. Extraer audio (solo si el fichero es pequeño — evitar OOM en iOS) ─
    onProgress?.("Extrayendo audio…", 5);
    const fileMB = file.size / (1024 * 1024);
    let audioBuffer: AudioBuffer | null = null;

    if (fileMB <= SKIP_AUDIO_IF_FILE_LARGER_MB) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuf = await file.arrayBuffer();
        audioBuffer    = await audioCtx.decodeAudioData(arrayBuf);
        audioCtx.close();
      } catch (e) {
        console.warn("[video-compress] Audio no extraído:", e);
        audioBuffer = null;
      }
    } else {
      console.info(`[video-compress] Fichero ${Math.round(fileMB)} MB > ${SKIP_AUDIO_IF_FILE_LARGER_MB} MB → audio omitido para ahorrar memoria en iOS`);
    }

    // ── 6. Verificar soporte AudioEncoder AAC ──────────────────────────────
    let audioSoportado = false;
    if (audioBuffer) {
      try {
        const s = await AudioEncoder.isConfigSupported({
          codec:            "mp4a.40.2",
          sampleRate:       audioBuffer.sampleRate,
          numberOfChannels: Math.min(audioBuffer.numberOfChannels, 2),
          bitrate:          AUDIO_BITRATE,
        });
        audioSoportado = s.supported ?? false;
      } catch { audioSoportado = false; }
    }

    onProgress?.("Preparando compresor…", 8);

    // ── 7. Codec H.264 soportado ────────────────────────────────────────────
    let codec: string | null = null;
    for (const c of H264_CODECS) {
      try {
        const s = await VideoEncoder.isConfigSupported({
          codec: c, width: outW, height: outH, bitrate: videoBitrate,
        });
        if (s.supported) { codec = c; break; }
      } catch { /* siguiente */ }
    }
    if (!codec) throw new Error("Este dispositivo no soporta codificación H.264 via WebCodecs.");

    // ── 8. Muxer ────────────────────────────────────────────────────────────
    const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
    const target = new ArrayBufferTarget();
    const muxer  = new Muxer({
      target,
      video: { codec: "avc", width: outW, height: outH },
      ...(audioSoportado && audioBuffer ? {
        audio: {
          codec:            "aac",
          sampleRate:       audioBuffer.sampleRate,
          numberOfChannels: Math.min(audioBuffer.numberOfChannels, 2),
        },
      } : {}),
      fastStart:              "in-memory",
      firstTimestampBehavior: "offset",
    });

    // ── 9. VideoEncoder con captura correcta de errores ─────────────────────
    // IMPORTANTE: throw dentro de un callback de WebCodecs se pierde silenciosamente.
    // Capturamos el error en una variable y lo relanzamos después del flush.
    let videoEncoderError: Error | null = null;
    let videoChunksRecibidos = 0;

    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          // Parche Safari: meta.info puede ser null en frames delta → crash en mp4-muxer
          if (meta && (meta as any).info === null) (meta as any).info = undefined;
          muxer.addVideoChunk(chunk, meta ?? undefined);
          videoChunksRecibidos++;
        } catch (e) {
          videoEncoderError = e as Error;
        }
      },
      error: (e) => {
        // NO usar throw aquí — se pierde. Guardamos para relanzar después del flush.
        videoEncoderError = e;
        console.error("[video-compress] VideoEncoder error:", e);
      },
    });

    videoEncoder.configure({
      codec,
      width:     outW,
      height:    outH,
      bitrate:   videoBitrate,
      framerate: 30,
    } as any);

    // ── 10. Canvas ──────────────────────────────────────────────────────────
    const canvas = document.createElement("canvas");
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext("2d")!;

    // ── 11. Captura de frames con requestVideoFrameCallback ─────────────────
    onProgress?.("Comprimiendo vídeo…", 10);

    let framesEnviados = 0;

    await new Promise<void>((resolve, reject) => {
      let frameCount = 0;
      const totalFrames = Math.ceil(duracion * 30);
      const videoEl    = video as any;

      function processFrame(_now: number, metadata: { mediaTime: number }) {
        // Si el encoder ya tiene un error, abortar
        if (videoEncoderError) { reject(videoEncoderError); return; }

        try {
          ctx.drawImage(video, 0, 0, outW, outH);
          const ts    = Math.round(metadata.mediaTime * 1_000_000);
          const frame = new VideoFrame(canvas, { timestamp: ts });
          videoEncoder.encode(frame, { keyFrame: frameCount % 60 === 0 });
          frame.close();
          framesEnviados++;
          frameCount++;

          const pct = Math.min(88, 10 + Math.round((frameCount / totalFrames) * 78));
          if (frameCount % 20 === 0) onProgress?.("Comprimiendo vídeo…", pct);

          // Siempre pedir el siguiente frame — el evento 'ended' resolverá la promesa
          videoEl.requestVideoFrameCallback(processFrame);
        } catch (e) {
          reject(e);
        }
      }

      video.addEventListener("ended", () => resolve(), { once: true });
      video.addEventListener("error", (e) => reject(
        new Error(`Error reproduciendo: ${(e as ErrorEvent).message ?? "desconocido"}`)
      ), { once: true });

      // Fallback para browsers sin requestVideoFrameCallback
      if ("requestVideoFrameCallback" in video) {
        videoEl.requestVideoFrameCallback(processFrame);
      } else {
        const videoFallback = video as HTMLVideoElement;
        videoFallback.addEventListener("timeupdate", () => {
          if (videoEncoderError) return;
          ctx.drawImage(videoFallback, 0, 0, outW, outH);
          const ts    = Math.round(videoFallback.currentTime * 1_000_000);
          const frame = new VideoFrame(canvas, { timestamp: ts });
          videoEncoder.encode(frame, { keyFrame: frameCount % 60 === 0 });
          frame.close();
          framesEnviados++;
          frameCount++;
        });
      }

      video.playbackRate = PLAYBACK_RATE;
      video.play().catch(reject);
    });

    if (framesEnviados === 0) {
      throw new Error("No se capturó ningún frame del vídeo. Prueba con otro navegador.");
    }

    onProgress?.("Finalizando vídeo…", 90);
    await videoEncoder.flush();
    videoEncoder.close();

    // ── Verificar que el encoder produjo datos ──────────────────────────────
    if (videoEncoderError) {
      throw new Error(`Error en el encoder de vídeo: ${(videoEncoderError as Error).message ?? String(videoEncoderError)}`);
    }
    if (videoChunksRecibidos === 0) {
      throw new Error(
        `El encoder de vídeo no produjo datos. ` +
        `(${framesEnviados} frames enviados, codec: ${codec}, ` +
        `${outW}×${outH}, ${Math.round(videoBitrate / 1000)} kbps). ` +
        `Prueba a actualizar Safari o usa Chrome.`
      );
    }

    // ── 12. Codificar audio ─────────────────────────────────────────────────
    if (audioSoportado && audioBuffer) {
      onProgress?.("Procesando audio…", 93);

      let audioEncoderError: Error | null = null;
      const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
      const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          try { muxer.addAudioChunk(chunk, meta); } catch { /* ignorar */ }
        },
        error: (e) => {
          audioEncoderError = e;
          console.error("[video-compress] AudioEncoder error:", e);
        },
      });
      audioEncoder.configure({
        codec:            "mp4a.40.2",
        sampleRate:       audioBuffer.sampleRate,
        numberOfChannels: numChannels,
        bitrate:          AUDIO_BITRATE,
      });

      const CHUNK = 4096;
      for (let offset = 0; offset < audioBuffer.length; offset += CHUNK) {
        if (audioEncoderError) break; // abortar si el encoder falló
        const frames = Math.min(CHUNK, audioBuffer.length - offset);
        const data   = new Float32Array(frames * numChannels);
        for (let ch = 0; ch < numChannels; ch++) {
          data.set(
            audioBuffer.getChannelData(ch).subarray(offset, offset + frames),
            ch * frames
          );
        }
        const audioData = new (globalThis as any).AudioData({
          format:           "f32-planar",
          sampleRate:       audioBuffer.sampleRate,
          numberOfFrames:   frames,
          numberOfChannels: numChannels,
          timestamp:        Math.round((offset / audioBuffer.sampleRate) * 1_000_000),
          data,
        });
        audioEncoder.encode(audioData);
        audioData.close();
      }

      await audioEncoder.flush();
      audioEncoder.close();
      // El error de audio no es fatal — el vídeo sigue siendo válido sin audio
      if (audioEncoderError) {
        console.warn("[video-compress] Audio encoder falló, se sube sin audio:", audioEncoderError);
      }
    }

    // ── 13. Finalizar y generar Blob ────────────────────────────────────────
    onProgress?.("Generando archivo…", 97);
    muxer.finalize();

    const blob   = new Blob([target.buffer], { type: "video/mp4" });
    const nombre = file.name.replace(/\.[^.]+$/, "") + "_comprimido.mp4";

    if (blob.size < 10_000) {
      throw new Error(
        `El archivo comprimido está vacío (${blob.size} bytes tras ${videoChunksRecibidos} chunks). ` +
        `Actualiza el navegador o usa Chrome.`
      );
    }

    onProgress?.("¡Listo!", 100);
    return new File([blob], nombre, { type: "video/mp4" });

  } finally {
    cleanup();
  }
}
