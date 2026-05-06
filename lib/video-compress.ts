/**
 * Compresión de vídeo usando WebCodecs + Canvas + mp4-muxer 5.1.3.
 *
 * Compatible con:
 *   - iOS Safari 16.4+  ✅
 *   - Android Chrome 94+ ✅
 *   - Chrome/Edge desktop ✅
 *   - Firefox ❌ (WebCodecs no soportado → lanza error descriptivo)
 *
 * Si el archivo ya pesa ≤ 40 MB, se devuelve sin comprimir.
 *
 * Parches iOS Safari documentados:
 *   1. meta.info = null en frames delta → mp4-muxer crash → convertir a undefined
 *   2. chunk.duration = null → addVideoChunkRaw lanza error → usar addVideoChunkRaw
 *      con duración calculada desde diferencia de timestamps
 *   3. Bitrate acotado a MAX_VIDEO_BITRATE para el hardware encoder del iPhone
 *   4. Audio omitido para archivos > SKIP_AUDIO_MB para evitar OOM en iOS
 */

const TARGET_MB          = 40;
const TARGET_BYTES       = TARGET_MB * 1024 * 1024;
const AUDIO_BITRATE      = 128_000;       // bps
const MAX_DIM            = 1280;          // px lado mayor máximo
const PLAYBACK_RATE      = 2;             // 2× velocidad de captura
const MAX_VIDEO_BITRATE  = 2_500_000;     // 2.5 Mbps — límite seguro para hardware iOS
const SKIP_AUDIO_MB      = 80;            // Omitir audio si el fichero es mayor (evita OOM)
const FRAME_US           = Math.round(1_000_000 / 30); // 33 333 μs = 1 frame a 30 fps

// Codecs en orden de preferencia (menor perfil primero = más compatible en móvil)
const H264_CODECS = [
  "avc1.42001F",  // Baseline Level 3.1 — el más compatible, ideal para 720p
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

  if (file.size <= TARGET_BYTES) return file;

  if (!webCodecsDisponible()) {
    throw new Error(
      "WebCodecs no disponible en este navegador. Usa Chrome o Safari 16.4+ para subir vídeos grandes."
    );
  }

  onProgress?.("Analizando vídeo…", 2);

  // ── 1. <video> en el DOM — obligatorio para requestVideoFrameCallback ─────
  const objectUrl = URL.createObjectURL(file);
  const video     = document.createElement("video");
  video.muted       = true;
  video.playsInline = true;
  video.preload     = "auto";
  video.style.cssText =
    "position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;top:-9999px;left:-9999px;";
  document.body.appendChild(video);
  video.src = objectUrl;

  function cleanup() {
    try { video.pause(); }                    catch { /* ok */ }
    try { document.body.removeChild(video); } catch { /* ok */ }
    URL.revokeObjectURL(objectUrl);
  }

  try {
    // ── 2. Esperar metadatos ──────────────────────────────────────────────────
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () =>
        reject(new Error(`Error cargando vídeo: ${video.error?.message ?? "desconocido"}`));
      setTimeout(() => reject(new Error("Timeout cargando metadatos (>30 s)")), 30_000);
    });

    const duracion = video.duration;
    const srcW     = video.videoWidth;
    const srcH     = video.videoHeight;

    if (!srcW || !srcH || !duracion || !isFinite(duracion)) {
      throw new Error(`Metadatos inválidos (w=${srcW} h=${srcH} dur=${duracion})`);
    }

    // ── 3. Dimensiones de salida (max 1280 px, múltiplos de 2) ───────────────
    const escala = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
    const outW   = Math.round(srcW * escala / 2) * 2;
    const outH   = Math.round(srcH * escala / 2) * 2;

    // ── 4. Bitrate acotado ───────────────────────────────────────────────────
    const videoBitrate = Math.max(
      300_000,
      Math.min(
        MAX_VIDEO_BITRATE,
        Math.floor((TARGET_BYTES * 8 - AUDIO_BITRATE * duracion) / duracion)
      )
    );

    // ── 5. Extraer audio (omitir si el fichero es demasiado grande) ──────────
    onProgress?.("Extrayendo audio…", 5);
    const fileMB = file.size / (1024 * 1024);
    let audioBuffer: AudioBuffer | null = null;

    if (fileMB <= SKIP_AUDIO_MB) {
      try {
        const AudioCtx  = window.AudioContext ?? (window as any).webkitAudioContext;
        const audioCtx  = new AudioCtx() as AudioContext;
        const arrayBuf  = await file.arrayBuffer();
        audioBuffer     = await audioCtx.decodeAudioData(arrayBuf);
        audioCtx.close();
      } catch (e) {
        console.warn("[video-compress] Audio no extraído:", e);
        audioBuffer = null;
      }
    } else {
      console.info(
        `[video-compress] ${Math.round(fileMB)} MB > ${SKIP_AUDIO_MB} MB → audio omitido (ahorro de memoria en iOS)`
      );
    }

    // ── 6. ¿Soporta el navegador AAC en AudioEncoder? ───────────────────────
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

    // ── 7. Buscar el codec H.264 soportado (menor nivel primero) ────────────
    let codec: string | null = null;
    for (const c of H264_CODECS) {
      try {
        const s = await VideoEncoder.isConfigSupported({
          codec: c, width: outW, height: outH, bitrate: videoBitrate,
        });
        if (s.supported) { codec = c; break; }
      } catch { /* siguiente */ }
    }
    if (!codec) {
      throw new Error(
        `Este dispositivo no soporta codificación H.264 via WebCodecs. ` +
        `(${outW}×${outH} @ ${Math.round(videoBitrate / 1000)} kbps)`
      );
    }

    // ── 8. Muxer ─────────────────────────────────────────────────────────────
    const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
    const target = new ArrayBufferTarget();
    const muxer  = new Muxer({
      target,
      video: { codec: "avc", width: outW, height: outH },
      ...(audioSoportado && audioBuffer
        ? {
            audio: {
              codec:            "aac",
              sampleRate:       audioBuffer.sampleRate,
              numberOfChannels: Math.min(audioBuffer.numberOfChannels, 2),
            },
          }
        : {}),
      fastStart:              "in-memory",
      firstTimestampBehavior: "offset",
    });

    // ── 9. VideoEncoder ──────────────────────────────────────────────────────
    // CRÍTICO: throw en callbacks de WebCodecs se pierde silenciosamente.
    // Guardamos el error en una variable y lo relanzamos después del flush().
    let videoEncoderError: Error | null = null;
    let videoChunksRecibidos = 0;
    let lastChunkTs          = -1; // para calcular duración entre chunks

    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          // Parche 1 — Safari: meta.info = null en delta frames → crash mp4-muxer
          if (meta && (meta as any).info === null) (meta as any).info = undefined;

          // Parche 2 — iOS Safari: chunk.duration = null → addVideoChunkRaw lanza error
          // Solución: usamos addVideoChunkRaw directamente con duración calculada.
          const chunkTs = chunk.timestamp;
          const dur =
            chunk.duration != null && chunk.duration > 0
              ? chunk.duration
              : lastChunkTs >= 0
                ? Math.max(1_000, chunkTs - lastChunkTs)
                : FRAME_US;
          lastChunkTs = chunkTs;

          const buf = new Uint8Array(chunk.byteLength);
          chunk.copyTo(buf);
          (muxer as any).addVideoChunkRaw(
            buf,
            chunk.type,
            chunkTs,
            dur,
            meta ?? undefined,
          );
          videoChunksRecibidos++;
        } catch (e) {
          // Guardamos el primer error; los siguientes se ignoran
          if (!videoEncoderError) videoEncoderError = e as Error;
        }
      },
      error: (e) => {
        if (!videoEncoderError) {
          videoEncoderError = e;
          console.error("[video-compress] VideoEncoder error:", e);
        }
      },
    });

    videoEncoder.configure({
      codec,
      width:     outW,
      height:    outH,
      bitrate:   videoBitrate,
      framerate: 30,
    } as any);

    // ── 10. Canvas ───────────────────────────────────────────────────────────
    const canvas = document.createElement("canvas");
    canvas.width  = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) throw new Error("No se pudo crear el contexto 2D del canvas");

    // ── 11. Captura de frames ─────────────────────────────────────────────────
    onProgress?.("Comprimiendo vídeo…", 10);

    let framesEnviados = 0;

    await new Promise<void>((resolve, reject) => {
      let frameCount   = 0;
      let lastFrameTs  = -1;       // garantiza timestamps estrictamente crecientes
      const totalFrames = Math.ceil(duracion * 30);
      const videoEl    = video as any;

      function processFrame(_now: number, metadata: { mediaTime: number }) {
        if (videoEncoderError) { reject(videoEncoderError); return; }
        try {
          ctx.drawImage(video, 0, 0, outW, outH);

          // Timestamp en microsegundos, estrictamente creciente
          let ts = Math.round(metadata.mediaTime * 1_000_000);
          if (ts <= lastFrameTs) ts = lastFrameTs + FRAME_US;
          lastFrameTs = ts;

          const frame = new VideoFrame(canvas, { timestamp: ts });
          videoEncoder.encode(frame, { keyFrame: frameCount % 60 === 0 });
          frame.close();
          framesEnviados++;
          frameCount++;

          const pct = Math.min(88, 10 + Math.round((frameCount / totalFrames) * 78));
          if (frameCount % 20 === 0) onProgress?.("Comprimiendo vídeo…", pct);

          videoEl.requestVideoFrameCallback(processFrame);
        } catch (e) {
          reject(e);
        }
      }

      video.addEventListener("ended", () => resolve(), { once: true });
      video.addEventListener(
        "error",
        (e) => reject(new Error(`Error reproduciendo: ${(e as ErrorEvent).message ?? "desconocido"}`)),
        { once: true }
      );

      if ("requestVideoFrameCallback" in video) {
        videoEl.requestVideoFrameCallback(processFrame);
      } else {
        // Fallback: timeupdate (menos preciso pero funcional)
        let fallbackLastTs = -1;
        let fallbackCount  = 0;
        const vid = video as HTMLVideoElement;
        vid.addEventListener("timeupdate", () => {
          if (videoEncoderError) return;
          ctx.drawImage(vid, 0, 0, outW, outH);
          let ts = Math.round(vid.currentTime * 1_000_000);
          if (ts <= fallbackLastTs) ts = fallbackLastTs + FRAME_US;
          fallbackLastTs = ts;

          const frame = new VideoFrame(canvas, { timestamp: ts });
          videoEncoder.encode(frame, { keyFrame: fallbackCount % 60 === 0 });
          frame.close();
          framesEnviados++;
          fallbackCount++;
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

    // Verificar que el encoder realmente produjo datos
    if (videoEncoderError) {
      throw new Error(
        `Error en el encoder de vídeo: ${(videoEncoderError as Error).message ?? String(videoEncoderError)}`
      );
    }
    if (videoChunksRecibidos === 0) {
      throw new Error(
        `El encoder no produjo ningún chunk ` +
        `(${framesEnviados} frames, codec ${codec}, ${outW}×${outH}, ` +
        `${Math.round(videoBitrate / 1000)} kbps). Prueba a actualizar Safari.`
      );
    }

    // ── 12. Audio ─────────────────────────────────────────────────────────────
    if (audioSoportado && audioBuffer) {
      onProgress?.("Procesando audio…", 93);

      let audioEncoderError: Error | null = null;
      const numChannels = Math.min(audioBuffer.numberOfChannels, 2);

      const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          try {
            // Mismo parche: duration puede ser null en algunos browsers
            const dur =
              chunk.duration != null && chunk.duration > 0
                ? chunk.duration
                : Math.round((4096 / audioBuffer!.sampleRate) * 1_000_000);
            const buf = new Uint8Array(chunk.byteLength);
            chunk.copyTo(buf);
            (muxer as any).addAudioChunkRaw(buf, chunk.type, chunk.timestamp, dur, meta ?? undefined);
          } catch { /* no fatal — vídeo sigue siendo válido sin audio */ }
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
        if (audioEncoderError) break;
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

      if (audioEncoderError) {
        console.warn("[video-compress] Audio encoder falló (no fatal):", audioEncoderError);
      }
    }

    // ── 13. Finalizar y generar Blob ──────────────────────────────────────────
    onProgress?.("Generando archivo…", 97);
    muxer.finalize();

    const blob   = new Blob([target.buffer], { type: "video/mp4" });
    const nombre = file.name.replace(/\.[^.]+$/, "") + "_comprimido.mp4";

    if (blob.size < 10_000) {
      throw new Error(
        `El archivo comprimido está vacío (${blob.size} bytes, ` +
        `${videoChunksRecibidos} chunks de vídeo). Actualiza el navegador o usa Chrome.`
      );
    }

    onProgress?.("¡Listo!", 100);
    return new File([blob], nombre, { type: "video/mp4" });

  } finally {
    cleanup();
  }
}
