"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  FileText, File, Upload, Trash2, Download,
  Plus, Loader2, FileImage, FilePlus2,
  FolderOpen, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createDocumentoRecord, deleteDocumento } from "@/lib/insforge/database";
import { subirDocumento, validarDocumento } from "@/lib/insforge/storage";
import type { Documento, DocumentoCategoria } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const CATEGORIAS: { value: DocumentoCategoria; label: string; emoji: string }[] = [
  { value: "plano",       label: "Planos",       emoji: "📐" },
  { value: "medidas",     label: "Medidas",      emoji: "📏" },
  { value: "presupuesto", label: "Presupuesto",  emoji: "💰" },
  { value: "contrato",    label: "Contrato",     emoji: "📋" },
  { value: "foto",        label: "Fotos doc.",   emoji: "📷" },
  { value: "otro",        label: "Otro",         emoji: "📎" },
];

function categoriaLabel(c: DocumentoCategoria) {
  return CATEGORIAS.find((x) => x.value === c)?.label ?? c;
}
function categoriaEmoji(c: DocumentoCategoria) {
  return CATEGORIAS.find((x) => x.value === c)?.emoji ?? "📎";
}
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function getFileIcon(nombre: string) {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return <FileText className="w-5 h-5 text-red-500" />;
  if (["png", "jpg", "jpeg", "webp", "svg", "gif"].includes(ext))
    return <FileImage className="w-5 h-5 text-blue-500" />;
  if (["dwg", "dxf"].includes(ext)) return <File className="w-5 h-5 text-orange-500" />;
  if (["doc", "docx"].includes(ext)) return <FileText className="w-5 h-5 text-blue-700" />;
  if (["xls", "xlsx"].includes(ext)) return <FileText className="w-5 h-5 text-green-600" />;
  return <File className="w-5 h-5 text-content-muted" />;
}
function isImagen(nombre: string) {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  return ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext);
}
function isPDF(nombre: string) {
  return nombre.split(".").pop()?.toLowerCase() === "pdf";
}

// ── Visor fullscreen ────────────────────────────────────────────────────────
function Visor({
  docs, initialIndex, onClose,
}: {
  docs: Documento[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const doc = docs[idx];

  // Reset zoom/offset cuando cambias de documento
  useEffect(() => { setZoom(1); setOffset({ x: 0, y: 0 }); }, [idx]);

  // Cerrar con Escape, navegar con flechas
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && idx > 0) { setIdx(i => i - 1); }
      if (e.key === "ArrowRight" && idx < docs.length - 1) { setIdx(i => i + 1); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, docs.length, onClose]);

  function handleMouseDown(e: React.MouseEvent) {
    if (zoom <= 1) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.ox + e.clientX - dragStart.current.x,
      y: dragStart.current.oy + e.clientY - dragStart.current.y,
    });
  }
  function handleMouseUp() { setDragging(false); }

  const esImagen = isImagen(doc.nombre);
  const esPDF = isPDF(doc.nombre);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.95)" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: "rgba(0,0,0,0.6)" }}>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">{doc.nombre}</p>
          <p className="text-white/50 text-xs">{categoriaEmoji(doc.categoria)} {categoriaLabel(doc.categoria)} · {formatBytes(doc.tamano_bytes)}</p>
        </div>
        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
          {/* Zoom controls — solo imágenes */}
          {esImagen && (
            <>
              <button
                onClick={() => setZoom(z => Math.max(1, +(z - 0.5).toFixed(1)))}
                disabled={zoom <= 1}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-30"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-white/70 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(z => Math.min(5, +(z + 0.5).toFixed(1)))}
                disabled={zoom >= 5}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-30"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </>
          )}
          {/* Abrir en nueva pestaña */}
          <a
            href={doc.url_storage}
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
      >
        {esImagen && (
          /* Imagen con zoom + pinch nativo en móvil */
          <div
            className="w-full h-full overflow-auto flex items-center justify-center"
            style={{ touchAction: "pinch-zoom pan-x pan-y" }}
          >
            <img
              src={doc.url_storage}
              alt={doc.nombre}
              draggable={false}
              style={{
                transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
                transformOrigin: "center center",
                transition: dragging ? "none" : "transform 0.15s ease",
                maxWidth: zoom === 1 ? "100%" : "none",
                maxHeight: zoom === 1 ? "100%" : "none",
                objectFit: "contain",
                userSelect: "none",
              }}
              onDoubleClick={() => setZoom(z => z === 1 ? 2.5 : 1)}
            />
          </div>
        )}
        {esPDF && (
          <iframe
            src={doc.url_storage}
            className="w-full h-full border-0"
            title={doc.nombre}
          />
        )}
        {!esImagen && !esPDF && (
          <div className="flex flex-col items-center gap-4 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
              {getFileIcon(doc.nombre)}
            </div>
            <p className="text-white font-medium">{doc.nombre}</p>
            <p className="text-white/50 text-sm">Este tipo de archivo no tiene previsualización</p>
            <a
              href={doc.url_storage}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-gray-900 rounded-full font-medium text-sm hover:bg-gray-100"
            >
              <Download className="w-4 h-4" /> Descargar
            </a>
          </div>
        )}
      </div>

      {/* Navegación prev/next */}
      {docs.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => i - 1)}
            disabled={idx === 0}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white disabled:opacity-20 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIdx(i => i + 1)}
            disabled={idx === docs.length - 1}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white disabled:opacity-20 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          {/* Indicador de posición */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
            {docs.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  i === idx ? "bg-white w-4" : "bg-white/40"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

interface Props {
  obraId: string;
  tenantId: string;
  userId: string;
  isAdmin: boolean;
  documentos: Documento[];
  onActualizar: () => void;
}

export function DocumentacionSection({
  obraId, tenantId, userId, isAdmin, documentos, onActualizar,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<DocumentoCategoria>("plano");
  const [filtro, setFiltro] = useState<DocumentoCategoria | "todos">("todos");
  const [visorIdx, setVisorIdx] = useState<number | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);

  const docsFiltrados = filtro === "todos"
    ? documentos
    : documentos.filter((d) => d.categoria === filtro);

  function abrirVisor(doc: Documento) {
    // Calcular el índice en docsFiltrados
    const idx = docsFiltrados.findIndex(d => d.id === doc.id);
    setVisorIdx(idx >= 0 ? idx : 0);
  }

  async function procesarArchivos(files: FileList | File[]) {
    const lista = Array.from(files);
    if (lista.length === 0) return;
    setError(null);
    setUploading(true);

    for (let i = 0; i < lista.length; i++) {
      const file = lista[i];
      setUploadProgress(`Subiendo ${i + 1}/${lista.length}: ${file.name}`);
      const err = validarDocumento(file);
      if (err) { setError(err); continue; }
      const { url, error: uploadErr, tamano } = await subirDocumento(file, tenantId, obraId, userId);
      if (uploadErr || !url) { setError(uploadErr ?? "Error al subir"); continue; }
      await createDocumentoRecord({
        obraId, userId, tenantId,
        nombre: file.name,
        categoria: categoriaSeleccionada,
        urlStorage: url,
        tamanoByte: tamano,
      });
    }

    setUploading(false);
    setUploadProgress("");
    onActualizar();
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    procesarArchivos(e.dataTransfer.files);
  }, [categoriaSeleccionada]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  async function handleEliminar(e: React.MouseEvent, doc: Documento) {
    e.stopPropagation();
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return;
    setEliminando(doc.id);
    await deleteDocumento(doc.id);
    setEliminando(null);
    onActualizar();
  }

  return (
    <div className="card p-5 mb-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="icon-container w-8 h-8">
            <FolderOpen className="w-4 h-4" />
          </div>
          <h2 className="font-semibold text-content-primary">
            Documentación
            {documentos.length > 0 && (
              <span className="ml-2 text-sm font-normal text-content-muted">({documentos.length})</span>
            )}
          </h2>
        </div>
        <button onClick={() => fileInputRef.current?.click()} className="btn-primary py-1.5 px-3 text-sm gap-1.5">
          <Plus className="w-4 h-4" /> Subir
        </button>
      </div>

      {/* Categoría + Drop zone */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-content-muted">Subir como:</span>
          {CATEGORIAS.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategoriaSeleccionada(cat.value)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                categoriaSeleccionada === cat.value
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-content-secondary hover:bg-gray-200"
              )}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200",
            isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-gray-50"
          )}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-content-secondary">{uploadProgress}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-content-primary">Arrastra archivos aquí o pulsa para seleccionar</p>
                <p className="text-xs text-content-muted mt-0.5">PDF, PNG, JPG, DWG, DXF, DOC, XLS — hasta 50 MB</p>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.dwg,.dxf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={(e) => e.target.files && procesarArchivos(e.target.files)}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <X className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Filtro */}
      {documentos.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <button
            onClick={() => setFiltro("todos")}
            className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-all",
              filtro === "todos" ? "bg-content-primary text-white" : "bg-gray-100 text-content-secondary hover:bg-gray-200")}
          >
            Todos ({documentos.length})
          </button>
          {CATEGORIAS.filter(cat => documentos.some(d => d.categoria === cat.value)).map(cat => {
            const count = documentos.filter(d => d.categoria === cat.value).length;
            return (
              <button
                key={cat.value}
                onClick={() => setFiltro(cat.value)}
                className={cn("px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                  filtro === cat.value ? "bg-primary text-white" : "bg-gray-100 text-content-secondary hover:bg-gray-200")}
              >
                {cat.emoji} {cat.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Lista */}
      {docsFiltrados.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="icon-container-gray w-12 h-12 mb-3">
            <FilePlus2 className="w-5 h-5" />
          </div>
          <p className="text-sm text-content-secondary">
            {filtro === "todos" ? "Sube planos, PDFs o fotos de la obra" : `No hay documentos de tipo "${categoriaLabel(filtro as DocumentoCategoria)}"`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {docsFiltrados.map((doc, i) => (
            <div
              key={doc.id}
              onClick={() => abrirVisor(doc)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border border-border bg-white hover:bg-gray-50 active:scale-[0.99] transition-all cursor-pointer group",
                eliminando === doc.id && "opacity-50"
              )}
            >
              {/* Thumbnail para imágenes, icono para resto */}
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                {isImagen(doc.nombre) ? (
                  <img src={doc.url_storage} alt={doc.nombre} className="w-full h-full object-cover" />
                ) : (
                  getFileIcon(doc.nombre)
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-content-primary truncate">{doc.nombre}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-content-muted">{categoriaEmoji(doc.categoria)} {categoriaLabel(doc.categoria)}</span>
                  <span className="text-xs text-content-muted">· {formatBytes(doc.tamano_bytes)}</span>
                  {doc.autor?.nombre && <span className="text-xs text-content-muted">· {doc.autor.nombre}</span>}
                  <span className="text-xs text-content-muted">· {format(new Date(doc.created_at), "d MMM yyyy", { locale: es })}</span>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <a
                  href={doc.url_storage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Abrir en nueva pestaña"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                {isAdmin && (
                  <button
                    onClick={(e) => handleEliminar(e, doc)}
                    disabled={eliminando === doc.id}
                    className="btn-ghost p-2 text-danger hover:bg-danger-light opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {eliminando === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visor fullscreen */}
      {visorIdx !== null && (
        <Visor
          docs={docsFiltrados}
          initialIndex={visorIdx}
          onClose={() => setVisorIdx(null)}
        />
      )}
    </div>
  );
}
