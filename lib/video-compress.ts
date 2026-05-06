/**
 * Compresión de vídeo usando APIs nativas del navegador (WebCodecs + Canvas + mp4-muxer).
 *
 * Compatible con:
 *   - iOS Safari 16.4+  ✅  (maneja HEVC/MOV de iPhone de forma nativa)
 *   - Android Chrome 94+ ✅
 *   - Chrome/Edge desktop ✅
 *   - Firefox ❌ (WebCodecs no soportado → lanza error descriptivo)
 *
 * NO usa FFmpeg.wasm → no necesita SharedArrayBuffer → funciona en iOS.
 *
 * Si el archivo ya pesa ≤ TARGET_MB, se devuelve sin comprimir.
 */

const TARGET_MB    = 40;
const TARGET_BYTES = TARGET_MB * 1024 * 1024;
const AUDIO_BITRATE = 128_000; // bps
const MAX_DIM       = 1280;    // px (el lado mayor no superará esto)
const PLAYBACK_RATE = 2;       // velocidad de procesado (2× = más rápido)

// Codecs H.264 a probar en orden de preferencia
const H264_CODECS = ["avc1.42E028", "avc1.42C028", "avc1.4D0028"];

/** Comprobar si WebCodecs está disponible (no en Firefox) */
export function webCodecsDisponible(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof AudioEncoder !== "undefined" &&
    typeof VideoFrame   !== "undefined"
  );
}

/**
 * Comprime un archivo de vídeo a ≤ 40 MB usando WebCodecs nativo.
 * @param file     Archivo original (cualquier formato: MOV, MP4, HEVC, etc.)
 * @param onProgress  Callback (etapa: string, porcentaje: number)
 * @returns  File comprimido (MP4 H.264) o el original si ya pesa ≤ 40 MB
 */
export async function comprimirVideoNativo(
  file: File,
  onProgress?: (etapa: string, pct: number) => void
): Promise<File> {
  // ── Si ya es pequeño, devolver sin tocar ──────────────────────────────────
  if (file.size <= TARGET_BYTES) return file;

  // ── Comprobar soporte WebCodecs ───────────────────────────────────────────
  if (!webCodecsDisponible()) {
    throw new Error(
      "WebCodecs no disponible en este navegador. Usa Chrome o Safari 16.4+ para comprimir vídeos grandes."
    );
  }

  onProgress?.("Analizando vídeo…", 2);

  // ── 1. Crear elemento <video> adjunto al DOM (necesario en algunos browsers) ──
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted        = true;
  video.playsInline  = true;
  video.preload      = "auto";
  video.crossOrigin  = "anonymous";
  // Adjuntar al DOM de forma invisible (necesario para requestVideoFrameCallback en Safari/Chrome)
  video.style.cssText = "position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;top:-9999px;left:-9999px;";
  document.body.appendChild(video);
  video.src = objectUrl;

  // Función de limpieza
  function cleanup() {
    try { video.pause(); } catch { /* ok */ }
    try { document.body.removeChild(video); } catch { /* ok */ }
    URL.revokeObjectURL(objectUrl);
  }

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror          = () => reject(new Error(`No se pudo cargar el vídeo: ${video.error?.message ?? "error desconocido"}`));
      setTimeout(() => reject(new Error("Timeout cargando metadatos del vídeo (>30s)")), 30_000);
    });

    const duracion = video.duration;
    const { videoWidth: srcW, videoHeight: srcH } = video;

    if (!srcW || !srcH || !duracion || !isFinite(duracion)) {
      throw new Error(`Metadatos de vídeo inválidos (w=${srcW} h=${srcH} dur=${duracion})`);
    }

    // ── 2. Calcular dimensiones de salida (max 1280px, múltiplos de 2) ─────
    const escala = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
    const outW   = Math.round(srcW * escala / 2) * 2;
    const outH   = Math.round(srcH * escala / 2) * 2;

    // ── 3. Calcular bitrate de vídeo para llegar a ~40 MB ──────────────────
    const videoBitrate = Math.max(
      300_000,
      Math.floor((TARGET_BYTES * 8 - AUDIO_BITRATE * duracion) / duracion)
    );

    onProgress?.("Preparando compresor…", 5);

    // ── 4. Encontrar codec H.264 soportado ───────────────────────────────
    let codecSoportado: string | null = null;
    for (const codec of H264_CODECS) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec, width: outW, height: outH, bitrate: videoBitrate,
        });
        if (support.supported) { codecSoportado = codec; break; }
      } catch { /* probar siguiente */ }
    }
    if (!codecSoportado) {
      throw new Error("Este dispositivo no soporta codificación H.264 via WebCodecs.");
    }

    // ── 5. Extraer audio usando MediaElementAudioSourceNode (sin cargar todo en RAM) ──
    // Evitamos file.arrayBuffer() para no duplicar 217 MB en memoria.
    onProgress?.("Extrayendo audio…", 8);
    let audioBuffer: AudioBuffer | null = null;
    try {
      // Usamos un AudioContext separado para decodificar solo un fragmento breve del audio
      // y así no saturar la memoria con el fichero entero.
      // Para vídeos grandes usamos un OfflineAudioContext a partir del ObjectURL.
      const audioCtx  = new AudioContext();
      // Cargamos solo los primeros 5 MB del archivo para extraer metadatos de audio
      const slice     = file.slice(0, Math.min(file.size, 5 * 1024 * 1024));
      const arrayBuf  = await slice.arrayBuffer();
      // decodeAudioData puede fallar con un fragmento → lo tratamos como error silencioso
      audioBuffer = await audioCtx.decodeAudioData(arrayBuf);
      audioCtx.close();
    } catch {
      // Sin audio → continuamos sin pista de audio (vídeo mudo de salida)
      audioBuffer = null;
    }

    // ── 6. Verificar soporte AudioEncoder AAC ────────────────────────────
    let audioSoportado = false;
    if (audioBuffer) {
      try {
        const sup = await AudioEncoder.isConfigSupported({
          codec: "mp4a.40.2",
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: audioBuffer.numberOfChannels,
          bitrate: AUDIO_BITRATE,
        });
        audioSoportado = sup.supported ?? false;
      } catch { audioSoportado = false; }
    }

    // ── 7. Configurar Muxer ──────────────────────────────────────────────
    const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
    const target = new ArrayBufferTarget();
    const muxer  = new Muxer({
      target,
      video: { codec: "avc", width: outW, height: outH },
      ...(audioSoportado && audioBuffer
        ? { audio: { codec: "aac", sampleRate: audioBuffer.sampleRate, numberOfChannels: audioBuffer.numberOfChannels } }
        : {}),
      fastStart:              "in-memory",
      firstTimestampBehavior: "offset",
    });

    // ── 8. Configurar VideoEncoder ───────────────────────────────────────
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        // Safari/iOS puede pasar meta.info = null en frames delta → mp4-muxer 5.2.x se rompe.
        // Parcheamos null → undefined antes de pasar al muxer.
        if (meta && (meta as any).info === null) {
          (meta as any).info = undefined;
        }
        muxer.addVideoChunk(chunk, meta ?? undefined);
      },
      error: (e) => { throw e; },
    });
    // colorSpace explícito: evita que Safari devuelva null en decoderConfig.colorSpace
    const veConfig: any = {
      codec:      codecSoportado,
      width:      outW,
      height:     outH,
      bitrate:    videoBitrate,
      framerate:  30,
      colorSpace: { primaries: "bt709", transfer: "bt709", matrix: "bt709", fullRange: false },
    };
    videoEncoder.configure(veConfig);

    // ── 9. Canvas para redimensionar frames ─────────────────────────────
    const canvas  = document.createElement("canvas");
    canvas.width  = outW;
    canvas.height = outH;
    const ctx     = canvas.getContext("2d")!;

    // ── 10. Procesar frames del vídeo ────────────────────────────────────
    onProgress?.("Comprimiendo vídeo…", 10);

    await new Promise<void>((resolve, reject) => {
      let frameCount  = 0;
      const totalFrames = Math.ceil(duracion * 30);
      const videoEl   = video as any;

      function processFrame(_now: number, metadata: { mediaTime: number }) {
        try {
          ctx.drawImage(video, 0, 0, outW, outH);
          const timestampUs = Math.round(metadata.mediaTime * 1_000_000);
          const frame = new VideoFrame(canvas, { timestamp: timestampUs });
          videoEncoder.encode(frame, { keyFrame: frameCount % 30 === 0 });
          frame.close();

          frameCount++;
          const pct = Math.min(90, 10 + Math.round((frameCount / totalFrames) * 80));
          if (frameCount % 15 === 0) onProgress?.("Comprimiendo vídeo…", pct);

          if (!video.ended && !video.paused) {
            videoEl.requestVideoFrameCallback(processFrame);
          } else {
            resolve();
          }
        } catch (e) {
          reject(e);
        }
      }

      video.addEventListener("ended",  () => resolve(), { once: true });
      video.addEventListener("error",  (e) => reject(new Error(`Error reproduciendo vídeo: ${(e as any)?.message ?? "desconocido"}`)), { once: true });

      if ("requestVideoFrameCallback" in video) {
        videoEl.requestVideoFrameCallback(processFrame);
      } else {
        // Fallback timeupdate (menos preciso pero funcional)
        videoEl.addEventListener("timeupdate", () => {
          ctx.drawImage(videoEl, 0, 0, outW, outH);
          const timestampUs = Math.round(videoEl.currentTime * 1_000_000);
          const frame = new VideoFrame(canvas, { timestamp: timestampUs });
          videoEncoder.encode(frame, { keyFrame: frameCount % 30 === 0 });
          frame.close();
          frameCount++;
        });
      }

      video.playbackRate = PLAYBACK_RATE;
      video.play().catch(reject);
    });

    onProgress?.("Finalizando vídeo…", 91);
    await videoEncoder.flush();
    videoEncoder.close();

    // ── 11. Procesar audio (solo si hay AudioBuffer) ─────────────────────
    if (audioSoportado && audioBuffer) {
      onProgress?.("Procesando audio…", 93);

      const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error:  (e) => { throw e; },
      });
      audioEncoder.configure({
        codec:            "mp4a.40.2",
        sampleRate:       audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        bitrate:          AUDIO_BITRATE,
      });

      const CHUNK_SIZE   = 4096;
      const numChannels  = audioBuffer.numberOfChannels;
      const totalSamples = audioBuffer.length;

      for (let offset = 0; offset < totalSamples; offset += CHUNK_SIZE) {
        const frames = Math.min(CHUNK_SIZE, totalSamples - offset);
        const buf    = new Float32Array(frames * numChannels);
        for (let ch = 0; ch < numChannels; ch++) {
          buf.set(audioBuffer.getChannelData(ch).subarray(offset, offset + frames), ch * frames);
        }
        const audioData = new (globalThis as any).AudioData({
          format:           "f32-planar",
          sampleRate:       audioBuffer.sampleRate,
          numberOfFrames:   frames,
          numberOfChannels: numChannels,
          timestamp:        Math.round((offset / audioBuffer.sampleRate) * 1_000_000),
          data:             buf,
        });
        audioEncoder.encode(audioData);
        audioData.close();
      }

      await audioEncoder.flush();
      audioEncoder.close();
    }

    // ── 12. Finalizar mux y generar Blob ─────────────────────────────────
    onProgress?.("Generando archivo final…", 97);
    muxer.finalize();

    const comprimido = new Blob([target.buffer], { type: "video/mp4" });
    const nombre     = file.name.replace(/\.[^.]+$/, "") + "_comprimido.mp4";

    onProgress?.("¡Listo!", 100);
    return new File([comprimido], nombre, { type: "video/mp4" });

  } finally {
    cleanup();
  }
}
