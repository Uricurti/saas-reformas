"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore, useTenantId } from "@/lib/stores/auth-store";
import { getArchivosByObra, createArchivoRecord, getObraById } from "@/lib/insforge/database";
import {
  subirFoto, subirVideo, validarTamanoArchivo,
  detectarTipoArchivo, getPublicStorageUrl,
} from "@/lib/insforge/storage";
import type { Archivo } from "@/types";
import { Camera, Images, X, ZoomIn, Loader2, ArrowLeft, Play, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils/format";

// ─── Inner page (requires useSearchParams) ────────────────────────────────────
function FotosInner() {
  const router      = useRouter();
  const params      = useSearchParams();
  const obraId      = params.get("obra");

  const user      = useAuthStore((s) => s.user);
  const tenantId  = useTenantId();

  const [obraNombre,    setObraNombre]    = useState("");
  const [archivos,      setArchivos]      = useState<Archivo[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isUploading,   setIsUploading]   = useState(false);
  const [uploadProgress,setUploadProgress]= useState("");
  const [ampliado,      setAmpliado]      = useState<Archivo | null>(null);
  const [uploadError,   setUploadError]   = useState<string | null>(null);

  const inputRef  = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!obraId) { router.replace("/obras"); return; }
    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraId]);

  async function cargar() {
    if (!obraId) return;
    setIsLoading(true);
    const [archRes, obraRes] = await Promise.all([
      getArchivosByObra(obraId),
      getObraById(obraId),
    ]);
    setArchivos((archRes.data as Archivo[]) ?? []);
    if (obraRes.data) setObraNombre((obraRes.data as any).nombre ?? "");
    setIsLoading(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !obraId || !tenantId || !user) return;
    setUploadError(null);
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Subiendo ${i + 1} de ${files.length}…`);

      const errorTamano = validarTamanoArchivo(file);
      if (errorTamano) { setUploadError(errorTamano); continue; }

      const tipo  = detectarTipoArchivo(file);
      const upFn  = tipo === "video" ? subirVideo : subirFoto;
      const { url, error, tamano } = await upFn(file, tenantId, obraId, user.id);

      if (error || !url) { setUploadError(error ?? "Error al subir"); continue; }

      await createArchivoRecord({
        obraId, userId: user.id, tenantId,
        tipo, urlStorage: url, tamanoByte: tamano,
      });
    }

    setIsUploading(false);
    setUploadProgress("");
    if (inputRef.current)  inputRef.current.value  = "";
    if (cameraRef.current) cameraRef.current.value = "";
    cargar();
  }

  const canUpload = !isUploading && !!obraId;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-24">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="btn-ghost p-2 -ml-2 flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-content-primary leading-tight">Fotos y vídeos</h1>
          {obraNombre && (
            <p className="text-sm text-content-muted truncate">{obraNombre}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={!canUpload}
            className="btn-secondary"
            title="Hacer foto"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Cámara</span>
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={!canUpload}
            className="btn-primary"
            title="Elegir de la galería"
          >
            <Images className="w-4 h-4" />
            <span className="hidden sm:inline">Galería</span>
          </button>
        </div>
      </div>

      {/* Inputs ocultos */}
      <input ref={inputRef}  type="file" accept="image/*,video/*" multiple onChange={handleFileChange} className="hidden" />
      <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" onChange={handleFileChange} className="hidden" />

      {/* Progreso upload */}
      {isUploading && (
        <div className="flex items-center gap-3 bg-primary-light rounded-xl px-4 py-3 mb-4">
          <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
          <span className="text-sm font-medium text-primary">{uploadProgress}</span>
        </div>
      )}

      {/* Error upload */}
      {uploadError && (
        <div className="bg-danger-light text-danger-foreground text-sm rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
          <span>{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Contenido ── */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
        </div>

      ) : archivos.length === 0 ? (
        <div className="card p-10 flex flex-col items-center text-center gap-4">
          <div className="icon-container w-14 h-14">
            <Camera className="w-7 h-7" />
          </div>
          <div>
            <p className="font-semibold text-content-primary mb-1">Sin fotos ni vídeos</p>
            <p className="text-sm text-content-secondary">
              Sube el primer archivo de esta obra
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => cameraRef.current?.click()} className="btn-secondary">
              <Camera className="w-4 h-4" /> Cámara
            </button>
            <button onClick={() => inputRef.current?.click()} className="btn-primary">
              <Images className="w-4 h-4" /> Galería
            </button>
          </div>
        </div>

      ) : (
        <>
          <p className="text-xs text-content-muted mb-3">
            {archivos.length} archivo{archivos.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {archivos.map((archivo) => {
              const esVideo = archivo.tipo === "video";
              const src     = getPublicStorageUrl(archivo.url_storage);
              return (
                <button
                  key={archivo.id}
                  onClick={() => setAmpliado(archivo)}
                  className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative group hover:ring-2 hover:ring-primary transition-all"
                >
                  {esVideo ? (
                    <>
                      <video
                        src={src}
                        className="w-full h-full object-cover"
                        muted playsInline preload="metadata"
                      />
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-white/85 flex items-center justify-center shadow-sm">
                          <Play className="w-5 h-5 text-gray-800 ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img
                      src={src}
                      alt="Foto de obra"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        // Fallback: intentar descargar vía blob si URL pública falla
                        (e.target as HTMLImageElement).style.opacity = "0.3";
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="w-6 h-6 text-white" />
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── Lightbox ── */}
      {ampliado && (
        <div
          className="modal-overlay"
          onClick={() => setAmpliado(null)}
        >
          <div
            className="relative w-full max-w-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cerrar */}
            <button
              onClick={() => setAmpliado(null)}
              className="absolute top-3 right-3 z-10 w-11 h-11 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {ampliado.tipo === "video" ? (
              <video
                src={getPublicStorageUrl(ampliado.url_storage)}
                controls
                autoPlay
                playsInline
                className="w-full rounded-2xl max-h-[80vh] bg-black"
              />
            ) : (
              <img
                src={getPublicStorageUrl(ampliado.url_storage)}
                alt="Foto de obra"
                className="w-full rounded-2xl max-h-[80vh] object-contain bg-black"
              />
            )}

            {ampliado.created_at && (
              <p className="text-center text-xs text-white/60 mt-2">
                {formatDateTime(ampliado.created_at)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Suspense wrapper (obligatorio con useSearchParams) ───────────────────────
export default function FotosPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary-light border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <FotosInner />
    </Suspense>
  );
}
