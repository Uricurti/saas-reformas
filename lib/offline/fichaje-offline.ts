/**
 * Gestión de fichajes offline con IndexedDB.
 * Si el trabajador no tiene conexión, el fichaje se guarda localmente
 * y se sincroniza cuando vuelve internet.
 */

import type { FichajeEstado, FichajePendiente } from "@/types";

const DB_NAME = "reformas-offline";
const DB_VERSION = 1;
const STORE = "fichajes_pendientes";

// ─── Abrir / inicializar IndexedDB ───────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Guardar fichaje pendiente ───────────────────────────────────────────────
export async function guardarFichajePendiente(params: {
  userId: string;
  obraId: string;
  obraAsignadaId?: string;
  tenantId: string;
  estado: FichajeEstado;
  esCambioObra?: boolean;
}): Promise<string> {
  const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const fichaje: FichajePendiente = {
    id,
    user_id: params.userId,
    obra_id: params.obraId,
    obra_asignada_id: params.obraAsignadaId,
    tenant_id: params.tenantId,
    fecha: new Date().toISOString().split("T")[0],
    estado: params.estado,
    hora_registro: new Date().toISOString(),
    es_cambio_obra: params.esCambioObra ?? false,
    sincronizado: false,
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(fichaje);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Obtener fichajes pendientes ─────────────────────────────────────────────
export async function getFichajesPendientes(): Promise<FichajePendiente[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as FichajePendiente[]);
    req.onerror = () => reject(req.error);
  });
}

// ─── Eliminar fichaje ya sincronizado ────────────────────────────────────────
export async function eliminarFichajePendiente(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Sincronizar todos los fichajes pendientes ───────────────────────────────
export async function sincronizarFichajesPendientes(
  registrarFn: (params: FichajePendiente) => Promise<{ error: any }>
): Promise<{ sincronizados: number; errores: number }> {
  const pendientes = await getFichajesPendientes();
  let sincronizados = 0;
  let errores = 0;

  for (const fichaje of pendientes) {
    const { error } = await registrarFn(fichaje);
    if (!error) {
      await eliminarFichajePendiente(fichaje.id);
      sincronizados++;
    } else {
      errores++;
    }
  }

  return { sincronizados, errores };
}

// ─── Comprobar si hay conexión ───────────────────────────────────────────────
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
