/**
 * Compresión de vídeo usando APIs nativas del navegador (WebCodecs + Canvas + mp4-muxer 5.1.3).
 *
 * Mismo enfoque que la app de compresión externa que funciona correctamente.
 *
 * Compatible con:
 *   - iOS Safari 16.4+  ✅  (HEVC/MOV de iPhone decodificado nativamente por el <video>)
 *   - Android Chrome 94+ ✅
 *   - Chrome/Edge desktop ✅
 *   - Firefox ❌ (WebCodecs no soportado → lanza error descriptivo)
 *
 * NO usa FFmpeg.wasm → no necesita SharedArrayBuffer → funciona en iOS.
 * Si el archivo ya pesa ≤ 40 MB, se devuelve sin comprimir.
 */

const TARGET_MB     = 40;
const TARGET_BYTES  = TARGET_MB * 1024 * 1024;
const AUDIO_BITRATE = 128_000; // bps
const MAX_DIM       = 1280;    // px (lado mayor máximo)
const PLAYBACK_RATE = 2;       // 2× = procesa más rápido

const H264_CODECS = ["avc1.42E028", "avc1.42C028", "avc1.4D0028"];

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
    try { video.pause(); }       catch { /* ok */ }
    try { document.body.removeChild(video); } catch { /* ok */ }
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

    // ── 4. Bitrate para llegar a ~40 MB ────────────────────────────────────
    const videoBitrate = Math.max(
      300_000,
      Math.floor((TARGET_BYTES * 8 - AUDIO_BITRATE * duracion) / duracion)
    );

    onProgress?.("Extrayendo audio…", 5);

    // ── 5. Extraer audio: cargamos el archivo completo (mismo enfoque que la
    //       app que funciona). AudioContext lo procesa en streaming interno. ─
    let audioBuffer: AudioBuffer | null = null;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuf = await file.arrayBuffer();
      audioBuffer    = await audioCtx.decodeAudioData(arrayBuf);
      audioCtx.close();
    } catch (e) {
      console.warn("[video-compress] Audio no extraído, se comprimirá sin audio:", e);
      audioBuffer = null;
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
        const s = await VideoEncoder.isConfigSupported({ codec: c, width: outW, height: outH, bitrate: videoBitrate });
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

    // ── 9. VideoEncoder ─────────────────────────────────────────────────────
    const veConfig: any = {
      codec,
      width:     outW,
      height:    outH,
      bitrate:   videoBitrate,
      framerate: 30,
    };
    let framesEnviados = 0;
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        // Parche Safari: meta.info puede ser null en frames delta → crash en mp4-muxer
        if (meta && (meta as any).info === null) (meta as any).info = undefined;
        muxer.addVideoChunk(chunk, meta ?? undefined);
      },
      error: (e) => { throw e; },
    });
    videoEncoder.configure(veConfig);

    // ── 10. Canvas ──────────────────────────────────────────────────────────
    const canvas = document.createElement("canvas");
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext("2d")!;

    // ── 11. Captura de frames con requestVideoFrameCallback ─────────────────
    onProgress?.("Comprimiendo vídeo…", 10);

    await new Promise<void>((resolve, reject) => {
      let frameCount = 0;
      const totalFrames = Math.ceil(duracion * 30);
      const videoEl    = video as any;

      function processFrame(_now: number, metadata: { mediaTime: number }) {
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
      video.addEventListener("error", (e) => reject(new Error(`Error reproduciendo: ${(e as ErrorEvent).message ?? "desconocido"}`)), { once: true });

      // Fallback para browsers sin requestVideoFrameCallback
      if ("requestVideoFrameCallback" in video) {
        videoEl.requestVideoFrameCallback(processFrame);
      } else {
        const videoFallback = video as HTMLVideoElement;
        videoFallback.addEventListener("timeupdate", () => {
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

    // ── 12. Codificar audio ─────────────────────────────────────────────────
    if (audioSoportado && audioBuffer) {
      onProgress?.("Procesando audio…", 93);

      const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
      const audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error:  (e) => { throw e; },
      });
      audioEncoder.configure({
        codec:            "mp4a.40.2",
        sampleRate:       audioBuffer.sampleRate,
        numberOfChannels: numChannels,
        bitrate:          AUDIO_BITRATE,
      });

      const CHUNK = 4096;
      for (let offset = 0; offset < audioBuffer.length; offset += CHUNK) {
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
    }

    // ── 13. Finalizar y generar Blob ────────────────────────────────────────
    onProgress?.("Generando archivo…", 97);
    muxer.finalize();

    const blob   = new Blob([target.buffer], { type: "video/mp4" });
    const nombre = file.name.replace(/\.[^.]+$/, "") + "_comprimido.mp4";

    // Verificar que el resultado tiene contenido
    if (blob.size < 10_000) {
      throw new Error(`El archivo comprimido está vacío (${blob.size} bytes). Inténtalo de nuevo.`);
    }

    onProgress?.("¡Listo!", 100);
    return new File([blob], nombre, { type: "video/mp4" });

  } finally {
    cleanup();
  }
}
