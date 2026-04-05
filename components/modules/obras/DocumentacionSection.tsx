"use client";

import { useRef, useState, useCallback } from "react";
import {
  FileText, Image, File, Upload, Trash2, Download,
  ChevronDown, Plus, Loader2, FileImage, FilePlus2,
  FolderOpen, X, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createDocumentoRecord, deleteDocumento } from "@/lib/insforge/database";
import { subirDocumento, validarDocumento } from "@/lib/insforge/storage";
import type { Documento, DocumentoCategoria } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  if (["pdf"].includes(ext)) return <FileText className="w-5 h-5 text-red-500" />;
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
  const [previewDoc, setPreviewDoc] = useState<Documento | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);

  const docsFiltrados = filtro === "todos"
    ? documentos
    : documentos.filter((d) => d.categoria === filtro);

  // ─── Subir archivos ───────────────────────────────────────────────
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
        obraId,
        userId,
        tenantId,
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

  async function handleEliminar(doc: Documento) {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return;
    setEliminando(doc.id);
    await deleteDocumento(doc.id);
    setEliminando(null);
    onActualizar();
  }

  // ─── Render ────────────────────────────────────────────────────────
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
              <span className="ml-2 text-sm font-normal text-content-muted">
                ({documentos.length})
              </span>
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

      {/* Selector de categoría + zona upload */}
      <div className="mb-4 space-y-3">
        {/* Categoría a asignar */}
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

        {/* Drop zone */}
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

      {/* Filtro por categoría */}
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
            Todos ({documentos.length})
          </button>
          {CATEGORIAS.filter((cat) =>
            documentos.some((d) => d.categoria === cat.value)
          ).map((cat) => {
            const count = documentos.filter((d) => d.categoria === cat.value).length;
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
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border border-border bg-white hover:bg-gray-50 transition-all group",
                eliminando === doc.id && "opacity-50"
              )}
            >
              {/* Icono */}
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                {getFileIcon(doc.nombre)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-content-primary truncate">{doc.nombre}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-content-muted">
                    {categoriaEmoji(doc.categoria)} {categoriaLabel(doc.categoria)}
                  </span>
                  <span className="text-xs text-content-muted">·</span>
                  <span className="text-xs text-content-muted">{formatBytes(doc.tamano_bytes)}</span>
                  {doc.autor?.nombre && (
                    <>
                      <span className="text-xs text-content-muted">·</span>
                      <span className="text-xs text-content-muted">{doc.autor.nombre}</span>
                    </>
                  )}
                  <span className="text-xs text-content-muted">·</span>
                  <span className="text-xs text-content-muted">
                    {format(new Date(doc.created_at), "d MMM yyyy", { locale: es })}
                  </span>
                </div>
                {doc.descripcion && (
                  <p className="text-xs text-content-secondary mt-0.5 truncate">{doc.descripcion}</p>
                )}
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Ver / previsualizar */}
                {isImagen(doc.nombre) && (
                  <button
                    onClick={() => setPreviewDoc(doc)}
                    className="btn-ghost p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Previsualizar"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                {/* Descargar / abrir */}
                <a
                  href={doc.url_storage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Abrir / descargar"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-4 h-4" />
                </a>
                {/* Eliminar (admin) */}
                {isAdmin && (
                  <button
                    onClick={() => handleEliminar(doc)}
                    disabled={eliminando === doc.id}
                    className="btn-ghost p-2 text-danger hover:bg-danger-light opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar"
                  >
                    {eliminando === doc.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal previsualizar imagen */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewDoc(null)}
              className="absolute -top-4 -right-4 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 z-10"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewDoc.url_storage}
              alt={previewDoc.nombre}
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <div className="mt-2 text-center">
              <p className="text-white text-sm font-medium">{previewDoc.nombre}</p>
              <p className="text-white/60 text-xs">{formatBytes(previewDoc.tamano_bytes)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
