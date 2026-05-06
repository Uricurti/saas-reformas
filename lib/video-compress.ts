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
      "Tu navegador no soporta la compresión de vídeo automática (WebCodecs). " +
      "Usa Chrome, Safari 16.4+ o Edge para comprimir vídeos pesados."
    );
  }

  onProgress?.("Analizando vídeo…", 2);

  // ── 1. Crear elemento <video> para decodificar el archivo original ─────────
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted       = true;
  video.playsInline = true;
  video.preload     = "auto";
  video.src         = objectUrl;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror          = () => reject(new Error("No se pudo cargar el vídeo para comprimirlo"));
    setTimeout(() => reject(new Error("Timeout cargando metadatos del vídeo")), 30_000);
  });

  const duracion = video.duration;
  const { videoWidth: srcW, videoHeight: srcH } = video;

  // ── 2. Calcular dimensiones de salida (max 1280px, múltiplos de 2) ─────────
  const escala = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
  const outW   = Math.round(srcW * escala / 2) * 2;
  const outH   = Math.round(srcH * escala / 2) * 2;

  // ── 3. Calcular bitrate de vídeo para llegar a ~40 MB ─────────────────────
  // total_bits = TARGET_BYTES * 8  →  video_bits = total_bits - audio_bits
  const videoBitrate = Math.max(
    300_000, // mínimo 300 kbps
    Math.floor((TARGET_BYTES * 8 - AUDIO_BITRATE * duracion) / duracion)
  );

  onProgress?.("Preparando compresor…", 5);

  // ── 4. Encontrar codec H.264 soportado ────────────────────────────────────
  let codecSoportado: string | null = null;
  for (const codec of H264_CODECS) {
    const support = await VideoEncoder.isConfigSupported({
      codec,
      width:   outW,
      height:  outH,
      bitrate: videoBitrate,
    });
    if (support.supported) { codecSoportado = codec; break; }
  }
  if (!codecSoportado) {
    throw new Error("Este dispositivo no soporta codificación H.264. No se puede comprimir el vídeo.");
  }

  // ── 5. Extraer audio ──────────────────────────────────────────────────────
  onProgress?.("Extrayendo audio…", 8);
  let audioBuffer: AudioBuffer | null = null;
  try {
    const audioCtx  = new AudioContext();
    const arrayBuf  = await file.arrayBuffer();
    audioBuffer     = await audioCtx.decodeAudioData(arrayBuf);
    audioCtx.close();
  } catch {
    // Sin audio (vídeos mudos) → continuamos sin pista de audio
    audioBuffer = null;
  }

  // ── 6. Verificar soporte de AudioEncoder para AAC ────────────────────────
  let audioSoportado = false;
  if (audioBuffer) {
    try {
      const sup = await AudioEncoder.isConfigSupported({
        codec:      "mp4a.40.2",
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        bitrate: AUDIO_BITRATE,
      });
      audioSoportado = sup.supported ?? false;
    } catch { audioSoportado = false; }
  }

  // ── 7. Configurar Muxer ───────────────────────────────────────────────────
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

  // ── 8. Configurar VideoEncoder ────────────────────────────────────────────
  const videoChunks: EncodedVideoChunk[] = [];
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
      videoChunks.push(chunk);
    },
    error: (e) => { throw e; },
  });
  videoEncoder.configure({
    codec:      codecSoportado,
    width:      outW,
    height:     outH,
    bitrate:    videoBitrate,
    framerate:  30,
  });

  // ── 9. Canvas para redimensionar frames ───────────────────────────────────
  const canvas  = document.createElement("canvas");
  canvas.width  = outW;
  canvas.height = outH;
  const ctx     = canvas.getContext("2d")!;

  // ── 10. Procesar frames del vídeo ─────────────────────────────────────────
  onProgress?.("Comprimiendo vídeo…", 10);

  await new Promise<void>((resolve, reject) => {
    let frameCount = 0;
    const totalFrames = Math.ceil(duracion * 30); // estimado

    function processFrame(now: number, metadata: { mediaTime: number }) {
      try {
        ctx.drawImage(video, 0, 0, outW, outH);
        const timestampUs = Math.round(metadata.mediaTime * 1_000_000);
        const frame = new VideoFrame(canvas, { timestamp: timestampUs });
        const esKeyframe = frameCount % 30 === 0;
        videoEncoder.encode(frame, { keyFrame: esKeyframe });
        frame.close();

        frameCount++;
        const pct = Math.min(90, 10 + Math.round((frameCount / totalFrames) * 80));
        if (frameCount % 15 === 0) onProgress?.("Comprimiendo vídeo…", pct);

        if (!video.ended && !video.paused) {
          (video as any).requestVideoFrameCallback(processFrame);
        }
      } catch (e) {
        reject(e);
      }
    }

    video.addEventListener("ended", () => resolve(), { once: true });
    video.addEventListener("error", (e) => reject(e), { once: true });

    // Fallback para Firefox (sin requestVideoFrameCallback → error antes de llegar aquí)
    const videoEl = video as any;
    if ("requestVideoFrameCallback" in video) {
      videoEl.requestVideoFrameCallback(processFrame);
    } else {
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

  // ── 11. Procesar audio ────────────────────────────────────────────────────
  if (audioSoportado && audioBuffer) {
    onProgress?.("Procesando audio…", 93);

    const audioChunks: EncodedAudioChunk[] = [];
    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        muxer.addAudioChunk(chunk, meta);
        audioChunks.push(chunk);
      },
      error: (e) => { throw e; },
    });
    audioEncoder.configure({
      codec:            "mp4a.40.2",
      sampleRate:       audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      bitrate:          AUDIO_BITRATE,
    });

    const CHUNK_SIZE  = 4096;
    const numChannels = audioBuffer.numberOfChannels;
    const totalSamples = audioBuffer.length;

    for (let offset = 0; offset < totalSamples; offset += CHUNK_SIZE) {
      const frames = Math.min(CHUNK_SIZE, totalSamples - offset);
      const audioData = new AudioData({
        format:         "f32-planar",
        sampleRate:     audioBuffer.sampleRate,
        numberOfFrames: frames,
        numberOfChannels: numChannels,
        timestamp:      Math.round((offset / audioBuffer.sampleRate) * 1_000_000),
        data:           (() => {
          // Entrelazar canales en f32-planar (cada canal consecutivo)
          const buf = new Float32Array(frames * numChannels);
          for (let ch = 0; ch < numChannels; ch++) {
            const channelData = audioBuffer.getChannelData(ch);
            buf.set(channelData.subarray(offset, offset + frames), ch * frames);
          }
          return buf;
        })(),
      });
      audioEncoder.encode(audioData);
      audioData.close();
    }

    await audioEncoder.flush();
    audioEncoder.close();
  }

  // ── 12. Finalizar mux y generar Blob ─────────────────────────────────────
  onProgress?.("Generando archivo final…", 97);
  muxer.finalize();

  URL.revokeObjectURL(objectUrl);

  const comprimido = new Blob([target.buffer], { type: "video/mp4" });
  const nombre     = file.name.replace(/\.[^.]+$/, "") + "_comprimido.mp4";

  onProgress?.("¡Listo!", 100);
  return new File([comprimido], nombre, { type: "video/mp4" });
}
