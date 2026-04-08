"use client";

import { useEffect, useState, useRef, Suspense } from "react";
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
  Play, Trash2, ImageOff, AlertTriangle, Tag, Check,
  CheckCircle2, Circle,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils/format";

// ─── Caché de URLs en sesión ─────────────────────────────────────────────────
const urlCache: Record<string, string> = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDayKey(iso: string) {
  return iso.slice(0, 10); // "2026-04-08"
}
function formatDayHeader(dayKey: string) {
  // "martes, 8 de abril de 2026"
  const d = new Date(dayKey + "T12:00:00");
  return d.toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
function initials(nombre?: string | null) {
  if (!nombre) return "?";
  return nombre.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ─── Thumbnail individual ────────────────────────────────────────────────────
function MediaThumb({
  archivo, deleteMode, selected, onOpen, onToggleSelect,
}: {
  archivo: Archivo;
  deleteMode: boolean;
  selected: boolean;
  onOpen: (a: Archivo, url: string) => void;
  onToggleSelect: (id: string) => void;
}) {
  const [url,     setUrl]     = useState<string | null>(urlCache[archivo.id] ?? null);
  const [loading, setLoading] = useState(!urlCache[archivo.id]);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    if (urlCache[archivo.id]) { setUrl(urlCache[archivo.id]); setLoading(false); return; }
    getMediaUrl(archivo.url_storage).then((u) => {
      if (u) { urlCache[archivo.id] = u; setUrl(u); }
      else setError(true);
      setLoading(false);
    });
  }, [archivo.id, archivo.url_storage]);

  const isVideo = archivo.tipo === "video";
  const autorNombre = archivo.autor?.nombre ?? null;

  function handleClick() {
    if (deleteMode) { onToggleSelect(archivo.id); return; }
    if (url) onOpen(archivo, url);
  }

  return (
    <div
      className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 cursor-pointer select-none"
      onClick={handleClick}
      style={{ outline: selected ? "3px solid #607eaa" : "none", outlineOffset: 2 }}
    >
      {/* ── Media ── */}
      {loading ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-200 animate-pulse">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : error || !url ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gray-100">
          <ImageOff className="w-6 h-6 text-gray-300" />
          <span className="text-[10px] text-gray-400">Sin vista previa</span>
        </div>
      ) : isVideo ? (
        <>
          <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
            <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow">
              <Play className="w-5 h-5 text-gray-800 ml-0.5" fill="currentColor" />
            </div>
          </div>
        </>
      ) : (
        <>
          <img src={url} alt="Foto de obra" className="w-full h-full object-cover" draggable={false} />
          {!deleteMode && (
            <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <ZoomIn className="w-7 h-7 text-white" />
            </div>
          )}
        </>
      )}

      {/* ── Autor badge (abajo izquierda) ── */}
      {autorNombre && !deleteMode && (
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/50 rounded-full pl-0.5 pr-2 py-0.5">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[8px] font-bold leading-none">{initials(autorNombre)}</span>
          </div>
          <span className="text-white text-[9px] font-medium leading-none truncate max-w-[60px]">
            {autorNombre.split(" ")[0]}
          </span>
        </div>
      )}

      {/* ── Selector en modo eliminar ── */}
      {deleteMode && (
        <div className="absolute inset-0 bg-black/10 flex items-start justify-end p-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
            selected
              ? "bg-primary border-primary scale-110"
              : "bg-white/80 border-gray-300"
          }`}>
            {selected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
          </div>
        </div>
      )}

      {/* ── Overlay seleccionado ── */}
      {deleteMode && selected && (
        <div className="absolute inset-0 bg-primary/15 pointer-events-none" />
      )}
    </div>
  );
}

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({
  archivo, url, onClose,
}: {
  archivo: Archivo; url: string; onClose: () => void;
}) {
  const isVideo = archivo.tipo === "video";
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="relative w-full max-w-2xl mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-end gap-0.5">
            {archivo.autor?.nombre && (
              <span className="text-xs text-white/80 font-medium">{archivo.autor.nombre}</span>
            )}
            {archivo.created_at && (
              <span className="text-[11px] text-white/60">{formatDateTime(archivo.created_at)}</span>
            )}
          </div>
        </div>
        {isVideo ? (
          <video src={url} controls autoPlay playsInline className="w-full rounded-2xl max-h-[75vh] bg-black" />
        ) : (
          <img src={url} alt="Foto de obra" className="w-full rounded-2xl max-h-[75vh] object-contain bg-black" draggable={false} />
        )}
      </div>
    </div>
  );
}

// ─── Etiqueta de día (editable) ──────────────────────────────────────────────
function DayEtiqueta({
  dayKey, obraId,
}: {
  dayKey: string; obraId: string;
}) {
  const storageKey = `fotos_etiqueta_${obraId}_${dayKey}`;
  const [value,   setValue]   = useState(() => localStorage.getItem(storageKey) ?? "");
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function save() {
    const trimmed = draft.trim();
    setValue(trimmed);
    if (trimmed) localStorage.setItem(storageKey, trimmed);
    else         localStorage.removeItem(storageKey);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          onBlur={save}
          placeholder="Ej: Derribo, Electricidad…"
          className="text-xs border border-primary/40 rounded-lg px-2 py-1 outline-none focus:border-primary bg-white"
          style={{ width: 160 }}
        />
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true); }}
      className="flex items-center gap-1 group"
      title="Añadir etiqueta para este día"
    >
      {value ? (
        <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: "#EEF2F8", color: "#607eaa" }}>
          <Tag className="w-3 h-3" />
          {value}
        </span>
      ) : (
        <span className="flex items-center gap-1 text-xs text-gray-400 border border-dashed border-gray-300 px-2.5 py-0.5 rounded-full group-hover:border-primary/40 group-hover:text-primary/60 transition-colors">
          <Tag className="w-3 h-3" />
          + Etiqueta
        </span>
      )}
    </button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
function FotosInner() {
  const router   = useRouter();
  const params   = useSearchParams();
  const obraId   = params.get("obra");
  const user     = useAuthStore((s) => s.user);
  const tenantId = useTenantId();

  const [obraNombre,     setObraNombre]     = useState("");
  const [archivos,       setArchivos]       = useState<Archivo[]>([]);
  const [isLoading,      setIsLoading]      = useState(true);
  const [isUploading,    setIsUploading]    = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadError,    setUploadError]    = useState<string | null>(null);

  // Delete mode
  const [deleteMode, setDeleteMode] = useState(false);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [deleting,   setDeleting]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  // Lightbox
  const [lightbox, setLightbox] = useState<{ archivo: Archivo; url: string } | null>(null);

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
      await createArchivoRecord({ obraId, userId: user.id, tenantId, tipo, urlStorage: url, tamanoByte: tamano });
    }

    setIsUploading(false);
    setUploadProgress("");
    if (inputRef.current)  inputRef.current.value  = "";
    if (cameraRef.current) cameraRef.current.value = "";
    cargar();
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    setDeleting(true);
    setConfirmDel(false);

    const toDelete = archivos.filter((a) => selected.has(a.id));
    await Promise.all(
      toDelete.map(async (a) => {
        await eliminarArchivo(a.url_storage);
        delete urlCache[a.id];
        await deleteArchivo(a.id);
      })
    );

    setArchivos((prev) => prev.filter((a) => !selected.has(a.id)));
    setSelected(new Set());
    setDeleteMode(false);
    setDeleting(false);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exitDeleteMode() {
    setDeleteMode(false);
    setSelected(new Set());
    setConfirmDel(false);
  }

  // ── Agrupar por día ──────────────────────────────────────────────────────
  const byDay = archivos.reduce<Record<string, Archivo[]>>((acc, a) => {
    const key = getDayKey(a.created_at);
    (acc[key] = acc[key] ?? []).push(a);
    return acc;
  }, {});
  const days = Object.keys(byDay).sort((a, b) => b.localeCompare(a)); // más reciente primero

  const canUpload = !isUploading && !deleteMode && !!obraId;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-28">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="btn-ghost p-2 -ml-2 flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-content-primary leading-tight">Fotos y vídeos</h1>
          {obraNombre && <p className="text-sm text-content-muted truncate">{obraNombre}</p>}
        </div>

        {deleteMode ? (
          /* Modo eliminar: Cancelar */
          <button onClick={exitDeleteMode} className="btn-ghost text-sm gap-1.5 text-content-muted">
            <X className="w-4 h-4" /> Cancelar
          </button>
        ) : (
          /* Modo normal: subida + activar eliminar */
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => cameraRef.current?.click()} disabled={!canUpload} className="btn-secondary" title="Cámara">
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Cámara</span>
            </button>
            <button onClick={() => inputRef.current?.click()} disabled={!canUpload} className="btn-primary" title="Galería">
              <Images className="w-4 h-4" />
              <span className="hidden sm:inline">Galería</span>
            </button>
            {archivos.length > 0 && (
              <button
                onClick={() => { setDeleteMode(true); setConfirmDel(false); }}
                className="btn-ghost text-sm gap-1.5 text-danger hover:bg-danger-light"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inputs ocultos */}
      <input ref={inputRef}  type="file" accept="image/*,video/*" multiple onChange={handleFileChange} className="hidden" />
      <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" onChange={handleFileChange} className="hidden" />

      {/* Banner modo eliminar */}
      {deleteMode && (
        <div className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 mb-5"
          style={{ background: "#fef2f2", border: "1.5px solid #fecaca" }}>
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-danger flex-shrink-0" />
            <span className="text-sm font-medium text-danger">
              {selected.size === 0
                ? "Toca las fotos o vídeos que quieres eliminar"
                : `${selected.size} seleccionado${selected.size !== 1 ? "s" : ""}`}
            </span>
          </div>

          {selected.size > 0 && !confirmDel && (
            <button
              onClick={() => setConfirmDel(true)}
              className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-danger text-white hover:bg-red-600 transition-colors"
            >
              Eliminar {selected.size}
            </button>
          )}

          {confirmDel && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-danger font-medium">¿Seguro?</span>
              <button
                onClick={handleDeleteSelected}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-danger text-white hover:bg-red-600"
              >
                Sí, eliminar
              </button>
              <button onClick={() => setConfirmDel(false)} className="text-xs text-gray-500 px-2">
                No
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload en progreso */}
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
        <div className="space-y-6">
          {[1, 2].map((g) => (
            <div key={g}>
              <div className="h-5 w-40 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-2xl bg-gray-200 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>

      ) : archivos.length === 0 ? (
        <div className="card p-10 flex flex-col items-center text-center gap-4">
          <div className="icon-container w-14 h-14"><Camera className="w-7 h-7" /></div>
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
        <div className="space-y-8">
          {days.map((dayKey) => {
            const items  = byDay[dayKey];
            const fotos  = items.filter((a) => a.tipo !== "video");
            const videos = items.filter((a) => a.tipo === "video");

            return (
              <div key={dayKey}>
                {/* ── Cabecera del día ── */}
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <span className="text-sm font-bold text-content-primary capitalize">
                    {formatDayHeader(dayKey)}
                  </span>
                  <span className="text-xs text-content-muted">
                    {items.length} archivo{items.length !== 1 ? "s" : ""}
                  </span>
                  {obraId && <DayEtiqueta dayKey={dayKey} obraId={obraId} />}
                </div>

                {/* ── Grid del día ── */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {items.map((archivo) => (
                    <MediaThumb
                      key={archivo.id}
                      archivo={archivo}
                      deleteMode={deleteMode}
                      selected={selected.has(archivo.id)}
                      onOpen={(a, url) => setLightbox({ archivo: a, url })}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Overlay eliminando */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl px-6 py-5 flex items-center gap-3 shadow-xl">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Eliminando…</span>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && !deleteMode && (
        <Lightbox
          archivo={lightbox.archivo}
          url={lightbox.url}
          onClose={() => setLightbox(null)}
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
