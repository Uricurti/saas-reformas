"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  FileText, File, Upload, Trash2, Download,
  Plus, Loader2, FileImage, FilePlus2,
  FolderOpen, X, ZoomIn, ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createDocumentoRecord, deleteDocumento } from "@/lib/insforge/database";
import { subirDocumento, validarDocumento, getStorageBlobUrl } from "@/lib/insforge/storage";
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

// Categorías que solo puede ver y subir el admin (datos económicos sensibles)
const CATEGORIAS_PRIVADAS: DocumentoCategoria[] = ["presupuesto", "contrato"];

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
  doc,
  onClose,
}: {
  doc: Documento;
  onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [cargando, setCargando]     = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [pdfFallback, setPdfFallback] = useState(false);

  // Zoom + pan para imágenes
  const [zoom, setZoom]       = useState(1);
  const [pan, setPan]         = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // Pinch-to-zoom en móvil
  const lastDist = useRef<number | null>(null);

  const esImagen = isImagen(doc.nombre);
  const esPDF    = isPDF(doc.nombre);

  // Resetear zoom al cambiar documento
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [doc.url_storage]);

  useEffect(() => {
    let url: string | null = null;
    setCargando(true);
    setErrorCarga(false);
    setBlobUrl(null);
    setPdfFallback(false);

    // Pasamos el nombre del fichero para forzar el MIME type correcto
    getStorageBlobUrl(doc.url_storage, doc.nombre).then((result) => {
      if (result) {
        url = result;
        setBlobUrl(result);
      } else {
        setErrorCarga(true);
      }
      setCargando(false);
    });

    return () => { if (url) URL.revokeObjectURL(url); };
  }, [doc.url_storage, doc.nombre]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function descargar() {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href   = blobUrl;
    a.download = doc.nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">

      {/* ── Barra superior ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 bg-black/70">
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{doc.nombre}</p>
          <p className="text-white/50 text-xs">
            {categoriaEmoji(doc.categoria)} {categoriaLabel(doc.categoria)} · {formatBytes(doc.tamano_bytes)}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Controles de zoom — solo imágenes */}
          {blobUrl && esImagen && (
            <>
              <button
                onClick={() => { setZoom(z => Math.max(1, +(z - 0.5).toFixed(1))); if (zoom <= 1.5) setPan({ x: 0, y: 0 }); }}
                disabled={zoom <= 1}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-30 transition-colors"
                title="Alejar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-white/60 text-xs w-10 text-center tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(8, +(z + 0.5).toFixed(1)))}
                disabled={zoom >= 8}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-30 transition-colors"
                title="Acercar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </>
          )}
          {blobUrl && (
            <button
              onClick={descargar}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              title="Descargar"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Contenido ──────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">

        {/* Cargando */}
        {cargando && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/60">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="text-sm">Cargando archivo...</p>
          </div>
        )}

        {/* Error al cargar */}
        {!cargando && errorCarga && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
              {getFileIcon(doc.nombre)}
            </div>
            <p className="text-white font-medium">{doc.nombre}</p>
            <p className="text-white/50 text-sm">No se pudo cargar el archivo. Comprueba la conexión.</p>
          </div>
        )}

        {/* ── IMAGEN con zoom + drag + pinch ───────────────────── */}
        {!cargando && !errorCarga && blobUrl && esImagen && (
          <div
            className="absolute inset-0 overflow-hidden flex items-center justify-center"
            style={{
              cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
              touchAction: zoom > 1 ? "none" : "pinch-zoom",
            }}
            /* ── Mouse drag ── */
            onMouseDown={(e) => {
              if (zoom <= 1) return;
              setDragging(true);
              dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
            }}
            onMouseMove={(e) => {
              if (!dragging) return;
              setPan({
                x: dragOrigin.current.px + e.clientX - dragOrigin.current.mx,
                y: dragOrigin.current.py + e.clientY - dragOrigin.current.my,
              });
            }}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            /* ── Pinch-to-zoom (touch) ── */
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastDist.current = Math.hypot(dx, dy);
              }
            }}
            onTouchMove={(e) => {
              if (e.touches.length === 2 && lastDist.current !== null) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                const delta = dist - lastDist.current;
                setZoom(z => Math.min(8, Math.max(1, +(z + delta * 0.01).toFixed(2))));
                lastDist.current = dist;
              }
            }}
            onTouchEnd={() => { lastDist.current = null; }}
            /* ── Wheel zoom ── */
            onWheel={(e) => {
              e.preventDefault();
              setZoom(z => {
                const next = z - e.deltaY * 0.001;
                const clamped = Math.min(8, Math.max(1, +next.toFixed(2)));
                if (clamped <= 1) setPan({ x: 0, y: 0 });
                return clamped;
              });
            }}
          >
            <img
              src={blobUrl}
              alt={doc.nombre}
              draggable={false}
              onDoubleClick={() => {
                if (zoom > 1) { setZoom(1); setPan({ x: 0, y: 0 }); }
                else setZoom(2.5);
              }}
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: "center center",
                transition: dragging ? "none" : "transform 0.15s ease",
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                userSelect: "none",
                pointerEvents: "none",   // el drag lo captura el div padre
              }}
            />
            {/* Hint doble clic */}
            {zoom === 1 && (
              <p className="absolute bottom-3 left-0 right-0 text-center text-white/30 text-xs pointer-events-none select-none">
                Doble clic para ampliar · Rueda del ratón para zoom · Arrastra para mover
              </p>
            )}
          </div>
        )}

        {/* ── PDF ──────────────────────────────────────────────── */}
        {!cargando && !errorCarga && blobUrl && esPDF && !pdfFallback && (
          <iframe
            key={blobUrl}             /* forzar re-mount si cambia el URL */
            src={blobUrl}
            title={doc.nombre}
            className="absolute inset-0 w-full h-full border-0"
            onError={() => setPdfFallback(true)}
          />
        )}

        {/* Fallback PDF (iOS Safari / navegadores sin visor PDF nativo) */}
        {!cargando && !errorCarga && blobUrl && esPDF && pdfFallback && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center">
              <FileText className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg mb-1">{doc.nombre}</p>
              <p className="text-white/60 text-sm">Tu navegador no puede mostrar PDFs en pantalla.<br/>Ábrelo para verlo.</p>
            </div>
            <a
              href={blobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-full font-semibold text-sm hover:bg-gray-100 transition-colors"
            >
              <FileText className="w-4 h-4" /> Abrir PDF
            </a>
          </div>
        )}

        {/* ── Otros formatos (DWG, DOC, XLS…) ─────────────────── */}
        {!cargando && !errorCarga && blobUrl && !esImagen && !esPDF && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
              {getFileIcon(doc.nombre)}
            </div>
            <div>
              <p className="text-white font-semibold text-lg mb-1">{doc.nombre}</p>
              <p className="text-white/60 text-sm">Este formato no tiene previsualización en el navegador.</p>
            </div>
            <button
              onClick={descargar}
              className="flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-full font-semibold text-sm hover:bg-gray-100 transition-colors"
            >
              <Download className="w-4 h-4" /> Descargar
            </button>
          </div>
        )}
      </div>
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
  const [isDragging, setIsDragging]   = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [error, setError]             = useState<string | null>(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<DocumentoCategoria>("plano");
  const [filtro, setFiltro]           = useState<DocumentoCategoria | "todos">("todos");
  const [visorDoc, setVisorDoc]       = useState<Documento | null>(null);
  const [eliminando, setEliminando]   = useState<string | null>(null);

  // Los empleados nunca ven documentos de categorías privadas
  const categoriasVisibles = isAdmin
    ? CATEGORIAS
    : CATEGORIAS.filter((c) => !CATEGORIAS_PRIVADAS.includes(c.value));

  const documentosVisibles = isAdmin
    ? documentos
    : documentos.filter((d) => !CATEGORIAS_PRIVADAS.includes(d.categoria));

  const docsFiltrados = filtro === "todos"
    ? documentosVisibles
    : documentosVisibles.filter((d) => d.categoria === filtro);

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

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
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
    <>
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
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary py-1.5 px-3 text-sm gap-1.5"
          >
            <Plus className="w-4 h-4" /> Subir
          </button>
        </div>

        {/* Categoría + Drop zone */}
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-content-muted">Subir como:</span>
            {categoriasVisibles.map((cat) => (
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
              isDragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border hover:border-primary/50 hover:bg-gray-50"
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
                  <p className="text-sm font-medium text-content-primary">
                    Arrastra archivos aquí o pulsa para seleccionar
                  </p>
                  <p className="text-xs text-content-muted mt-0.5">
                    PDF, PNG, JPG, DWG, DXF, DOC, XLS — hasta 50 MB
                  </p>
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

        {/* Filtros por categoría */}
        {documentos.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <button
              onClick={() => setFiltro("todos")}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                filtro === "todos"
                  ? "bg-content-primary text-white"
                  : "bg-gray-100 text-content-secondary hover:bg-gray-200"
              )}
            >
              Todos ({documentosVisibles.length})
            </button>
            {categoriasVisibles.filter((cat) => documentosVisibles.some((d) => d.categoria === cat.value)).map((cat) => {
              const count = documentosVisibles.filter((d) => d.categoria === cat.value).length;
              return (
                <button
                  key={cat.value}
                  onClick={() => setFiltro(cat.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                    filtro === cat.value
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-content-secondary hover:bg-gray-200"
                  )}
                >
                  {cat.emoji} {cat.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Lista de documentos */}
        {docsFiltrados.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="icon-container-gray w-12 h-12 mb-3">
              <FilePlus2 className="w-5 h-5" />
            </div>
            <p className="text-sm text-content-secondary">
              {filtro === "todos"
                ? "Sube planos, PDFs o fotos de la obra"
                : `No hay documentos de tipo "${categoriaLabel(filtro as DocumentoCategoria)}"`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {docsFiltrados.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setVisorDoc(doc)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border border-border bg-white hover:bg-gray-50 active:scale-[0.99] transition-all cursor-pointer group",
                  eliminando === doc.id && "opacity-50 pointer-events-none"
                )}
              >
                {/* Icono */}
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                  {getFileIcon(doc.nombre)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-content-primary truncate">{doc.nombre}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-content-muted">
                      {categoriaEmoji(doc.categoria)} {categoriaLabel(doc.categoria)}
                    </span>
                    <span className="text-xs text-content-muted">· {formatBytes(doc.tamano_bytes)}</span>
                    {doc.autor?.nombre && (
                      <span className="text-xs text-content-muted">· {doc.autor.nombre}</span>
                    )}
                    <span className="text-xs text-content-muted">
                      · {format(new Date(doc.created_at), "d MMM yyyy", { locale: es })}
                    </span>
                  </div>
                </div>

                {/* Eliminar (solo admin) */}
                {isAdmin && (
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleEliminar(e, doc)}
                      disabled={eliminando === doc.id}
                      className="btn-ghost p-2 text-danger hover:bg-danger-light opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar"
                    >
                      {eliminando === doc.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visor fullscreen — fuera del card para que ocupe toda la pantalla */}
      {visorDoc && (
        <Visor
          doc={visorDoc}
          onClose={() => setVisorDoc(null)}
        />
      )}
    </>
  );
}
