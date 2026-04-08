"use client";

import { useEffect, useState, useRef, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore, useTenantId } from "@/lib/stores/auth-store";
import { getArchivosByObra, createArchivoRecord, deleteArchivo, getObraById } from "@/lib/insforge/database";
import {
  subirFoto, subirVideo, validarTamanoArchivo,
  detectarTipoArchivo, getMediaUrl, eliminarArchivo,
} from "@/lib/insforge/storage";
import type { Archivo } from "@/types";
import {
  Camera, Images, X, ZoomIn, Loader2, ArrowLeft,
  Play, Trash2, ImageOff, AlertTriangle,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils/format";

// ─── Caché global de URLs para la sesión ────────────────────────────────────
const urlCache: Record<string, string> = {};

// ─── Componente thumbnail individual ─────────────────────────────────────────
function MediaThumb({
  archivo,
  onOpen,
  onDelete,
}: {
  archivo: Archivo;
  onOpen: (archivo: Archivo, url: string) => void;
  onDelete: (archivo: Archivo) => void;
}) {
  const [url,     setUrl]     = useState<string | null>(urlCache[archivo.id] ?? null);
  const [loading, setLoading] = useState(!urlCache[archivo.id]);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    if (urlCache[archivo.id]) { setUrl(urlCache[archivo.id]); setLoading(false); return; }
    getMediaUrl(archivo.url_storage).then((u) => {
      if (u) { urlCache[archivo.id] = u; setUrl(u); }
      else    setError(true);
      setLoading(false);
    });
  }, [archivo.id, archivo.url_storage]);

  const isVideo = archivo.tipo === "video";

  return (
    <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 group">

      {/* Contenido principal */}
      {loading ? (
        <div className="w-full h-full flex items-center justify-center animate-pulse bg-gray-200">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : error || !url ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gray-100">
          <ImageOff className="w-6 h-6 text-gray-300" />
          <span className="text-[10px] text-gray-400">Sin vista previa</span>
        </div>
      ) : isVideo ? (
        <button
          onClick={() => onOpen(archivo, url)}
          className="w-full h-full block"
          aria-label="Ver vídeo"
        >
          <video
            src={url}
            className="w-full h-full object-cover"
            muted playsInline preload="metadata"
          />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-md">
              <Play className="w-6 h-6 text-gray-800 ml-0.5" fill="currentColor" />
            </div>
          </div>
        </button>
      ) : (
        <button
          onClick={() => onOpen(archivo, url)}
          className="w-full h-full block"
          aria-label="Ver foto"
        >
          <img
            src={url}
            alt="Foto de obra"
            className="w-full h-full object-cover"
            draggable={false}
          />
          {/* Hover overlay desktop */}
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <ZoomIn className="w-7 h-7 text-white" />
          </div>
        </button>
      )}

      {/* Botón eliminar — siempre visible en móvil (pequeño), más visible en hover desktop */}
      {!loading && !error && url && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(archivo); }}
          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center
                     opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity
                     hover:bg-red-500/80 active:bg-red-500 active:scale-90"
          title="Eliminar"
          aria-label="Eliminar archivo"
        >
          <Trash2 className="w-3.5 h-3.5 text-white" />
        </button>
      )}
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({
  archivo,
  url,
  onClose,
  onDelete,
}: {
  archivo: Archivo;
  url: string;
  onClose: () => void;
  onDelete: () => void;
}) {
  const isVideo = archivo.tipo === "video";
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {archivo.created_at && (
            <span className="text-xs text-white/70">{formatDateTime(archivo.created_at)}</span>
          )}

          {/* Botón eliminar en lightbox */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-red-500/80 transition-colors"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/80">¿Eliminar?</span>
              <button
                onClick={onDelete}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors"
              >
                Sí
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Media */}
        {isVideo ? (
          <video
            src={url}
            controls autoPlay playsInline
            className="w-full rounded-2xl max-h-[75vh] bg-black"
          />
        ) : (
          <img
            src={url}
            alt="Foto de obra"
            className="w-full rounded-2xl max-h-[75vh] object-contain bg-black"
            draggable={false}
          />
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
function FotosInner() {
  const router    = useRouter();
  const params    = useSearchParams();
  const obraId    = params.get("obra");

  const user     = useAuthStore((s) => s.user);
  const tenantId = useTenantId();

  const [obraNombre,     setObraNombre]     = useState("");
  const [archivos,       setArchivos]       = useState<Archivo[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [isUploading,    setIsUploading]    = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadError,    setUploadError]    = useState<string | null>(null);
  const [lightbox,       setLightbox]       = useState<{ archivo: Archivo; url: string } | null>(null);
  const [deleting,       setDeleting]       = useState<string | null>(null);

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

      const tipo = detectarTipoArchivo(file);
      const upFn = tipo === "video" ? subirVideo : subirFoto;
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

  async function handleDelete(archivo: Archivo) {
    setDeleting(archivo.id);
    setLightbox(null);

    // Borra de storage e invalidar caché
    await eliminarArchivo(archivo.url_storage);
    delete urlCache[archivo.id];

    // Borra el registro de BD
    await deleteArchivo(archivo.id);

    // Actualiza estado local
    setArchivos((prev) => prev.filter((a) => a.id !== archivo.id));
    setDeleting(null);
  }

  const canUpload = !isUploading && !!obraId;
  const fotos   = archivos.filter((a) => a.tipo !== "video");
  const videos  = archivos.filter((a) => a.tipo === "video");

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-28">

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
        <div className="flex items-center gap-3 bg-danger-light text-danger-foreground text-sm rounded-xl px-4 py-3 mb-4">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{uploadError}</span>
          <button onClick={() => setUploadError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Contenido ── */}
      {isLoading ? (
        /* Skeleton grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-gray-200 animate-pulse" />
          ))}
        </div>

      ) : archivos.length === 0 ? (
        <div className="card p-10 flex flex-col items-center text-center gap-4">
          <div className="icon-container w-14 h-14">
            <Camera className="w-7 h-7" />
          </div>
          <div>
            <p className="font-semibold text-content-primary mb-1">Sin fotos ni vídeos</p>
            <p className="text-sm text-content-secondary">Sube el primer archivo de esta obra</p>
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
        <div className="space-y-6">

          {/* Fotos */}
          {fotos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-4 h-4 text-content-muted" />
                <span className="text-xs font-semibold text-content-muted uppercase tracking-wide">
                  Fotos · {fotos.length}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {fotos.map((archivo) => (
                  <MediaThumb
                    key={archivo.id}
                    archivo={archivo}
                    onOpen={(a, url) => setLightbox({ archivo: a, url })}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Vídeos */}
          {videos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Play className="w-4 h-4 text-content-muted" />
                <span className="text-xs font-semibold text-content-muted uppercase tracking-wide">
                  Vídeos · {videos.length}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {videos.map((archivo) => (
                  <MediaThumb
                    key={archivo.id}
                    archivo={archivo}
                    onOpen={(a, url) => setLightbox({ archivo: a, url })}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Overlay eliminando */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl px-6 py-5 flex items-center gap-3 shadow-xl">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-content-primary">Eliminando…</span>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          archivo={lightbox.archivo}
          url={lightbox.url}
          onClose={() => setLightbox(null)}
          onDelete={() => handleDelete(lightbox.archivo)}
        />
      )}
    </div>
  );
}

// ─── Suspense wrapper ────────────────────────────────────────────────────────
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
