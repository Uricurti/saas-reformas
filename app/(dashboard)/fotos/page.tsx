"use client";

import { useEffect, useState, useRef } from "react";
import { useAuthStore, useTenantId } from "@/lib/stores/auth-store";
import { getObrasActivas } from "@/lib/insforge/database";
import { getArchivosByObra, createArchivoRecord } from "@/lib/insforge/database";
import { subirFoto, validarTamanoArchivo, detectarTipoArchivo } from "@/lib/insforge/storage";
import type { Obra, Archivo } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Camera, Upload, X, ZoomIn, Loader2, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/format";

export default function FotosPage() {
  const user = useAuthStore((s) => s.user);
  const tenantId = useTenantId();

  const [obras, setObras] = useState<Obra[]>([]);
  const [obraSeleccionada, setObraSeleccionada] = useState<string>("");
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [fotoAmpliada, setFotoAmpliada] = useState<Archivo | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tenantId) cargarObras();
  }, [tenantId]);

  useEffect(() => {
    if (obraSeleccionada) cargarFotos();
  }, [obraSeleccionada]);

  async function cargarObras() {
    const { data } = await getObrasActivas(tenantId!);
    const listaObras = (data as Obra[]) ?? [];
    setObras(listaObras);
    if (listaObras.length > 0) setObraSeleccionada(listaObras[0].id);
  }

  async function cargarFotos() {
    setIsLoading(true);
    const { data } = await getArchivosByObra(obraSeleccionada);
    setArchivos((data as Archivo[]) ?? []);
    setIsLoading(false);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !obraSeleccionada) return;
    setUploadError(null);
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(`Subiendo ${i + 1} de ${files.length}...`);

      const errorTamano = validarTamanoArchivo(file);
      if (errorTamano) {
        setUploadError(errorTamano);
        continue;
      }

      const tipo = detectarTipoArchivo(file);
      const { url, error, tamano } = await subirFoto(file, tenantId!, obraSeleccionada, user!.id);

      if (error || !url) {
        setUploadError(error ?? "Error al subir el archivo");
        continue;
      }

      await createArchivoRecord({
        obraId: obraSeleccionada,
        userId: user!.id,
        tenantId: tenantId!,
        tipo,
        urlStorage: url,
        tamanoByte: tamano,
      });
    }

    setIsUploading(false);
    setUploadProgress("");
    if (inputRef.current) inputRef.current.value = "";
    cargarFotos();
  }

  const obraActual = obras.find((o) => o.id === obraSeleccionada);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Fotos de obra"
        subtitle="Archivo visual por proyecto"
        action={
          <button
            onClick={() => inputRef.current?.click()}
            disabled={isUploading || !obraSeleccionada}
            className="btn-primary"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {isUploading ? uploadProgress : "Añadir fotos"}
          </button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Selector de obra */}
      {obras.length > 1 && (
        <div className="mb-6">
          <select
            className="select"
            value={obraSeleccionada}
            onChange={(e) => setObraSeleccionada(e.target.value)}
          >
            {obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        </div>
      )}

      {uploadError && (
        <div className="bg-danger-light text-danger-foreground text-sm rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
          {uploadError}
          <button onClick={() => setUploadError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

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
            <p className="font-semibold text-content-primary mb-1">Sin fotos aún</p>
            <p className="text-sm text-content-secondary">
              {obraActual ? `Sube la primera foto de ${obraActual.nombre}` : "Selecciona una obra"}
            </p>
          </div>
          <button onClick={() => inputRef.current?.click()} className="btn-primary mt-2">
            <Upload className="w-4 h-4" /> Subir primera foto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {archivos.map((archivo) => (
            <button
              key={archivo.id}
              onClick={() => setFotoAmpliada(archivo)}
              className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative group hover:ring-2 hover:ring-primary transition-all"
            >
              <img
                src={archivo.url_storage}
                alt={archivo.descripcion ?? "Foto de obra"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ZoomIn className="w-6 h-6 text-white" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {fotoAmpliada && (
        <div className="modal-overlay" onClick={() => setFotoAmpliada(null)}>
          <div className="relative max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setFotoAmpliada(null)}
              className="absolute top-3 right-3 z-10 w-11 h-11 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={fotoAmpliada.url_storage}
              alt={fotoAmpliada.descripcion ?? "Foto de obra"}
              className="w-full rounded-xl max-h-[80vh] object-contain bg-black"
            />
            {fotoAmpliada.created_at && (
              <p className="text-center text-xs text-white/70 mt-2">
                {formatDateTime(fotoAmpliada.created_at)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
