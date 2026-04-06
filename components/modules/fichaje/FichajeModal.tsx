"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getFichajeHoy, registrarFichaje, getMaterialesPendientes } from "@/lib/insforge/database";
import { getAsignacionHoyByUser } from "@/lib/insforge/database";
import { guardarFichajePendiente, sincronizarFichajesPendientes, isOnline } from "@/lib/offline/fichaje-offline";
import { isoDate } from "@/lib/utils";
import type { Obra, FichajeEstado } from "@/types";
import { CheckCircle2, XCircle, ArrowLeftRight, Loader2, Wifi, WifiOff, Building2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import insforge from "@/lib/insforge/client";
import { DireccionLink } from "@/components/ui/DireccionLink";

type Paso = "pregunta" | "cambio_obra" | "ausencia" | "completado";
type MotivoAusencia = "libre" | "baja" | "permiso" | "vacaciones" | "otro";

const motivosAusencia: { value: MotivoAusencia; label: string; emoji: string }[] = [
  { value: "libre",      label: "Libre",      emoji: "🏖️" },
  { value: "baja",       label: "Baja médica", emoji: "🏥" },
  { value: "permiso",    label: "Permiso",     emoji: "📋" },
  { value: "vacaciones", label: "Vacaciones",  emoji: "🏖️" },
  { value: "otro",       label: "Otro motivo", emoji: "💬" },
];

// ── Helpers de localStorage ───────────────────────────────────
function fichajeKey(userId: string) {
  return `fichaje_done_${userId}_${isoDate()}`;
}
function marcarFichadoLocal(userId: string) {
  try { localStorage.setItem(fichajeKey(userId), "1"); } catch { /* ignore */ }
}
function yaFichadoLocal(userId: string): boolean {
  try { return localStorage.getItem(fichajeKey(userId)) === "1"; } catch { return false; }
}

export function FichajeModal() {
  const user = useAuthStore((s) => s.user);

  const [visible, setVisible]           = useState(false);
  const [paso, setPaso]                 = useState<Paso>("pregunta");
  const [isLoading, setIsLoading]       = useState(true);
  const [isSaving, setIsSaving]         = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);
  const [obraAsignada, setObraAsignada] = useState<Obra | null>(null);
  const [obrasActivas, setObrasActivas] = useState<Obra[]>([]);
  const [online, setOnline]             = useState(isOnline());
  const [guardadoOffline, setGuardadoOffline] = useState(false);

  // Conectividad
  useEffect(() => {
    const onOnline  = () => { setOnline(true);  if (user) sincronizar(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [user]);

  // Comprobar si debe aparecer el modal (solo la primera vez por día)
  useEffect(() => {
    if (!user || user.rol === "admin") return;
    comprobarFichaje();
  }, [user?.id]); // solo cuando cambia el ID de usuario, no en cada render

  async function comprobarFichaje() {
    setIsLoading(true);
    try {
      // 1. Comprobar localStorage primero (rápido, offline-friendly)
      if (yaFichadoLocal(user!.id)) {
        setIsLoading(false);
        return;
      }

      // 2. Comprobar en la BD (por si fichó desde otro dispositivo / admin fichó por él)
      const fichaje = await getFichajeHoy(user!.id);
      if (fichaje) {
        // Sincronizar caché local
        marcarFichadoLocal(user!.id);
        setIsLoading(false);
        return;
      }

      // 3. ¿Tiene obra asignada hoy?
      const obra = await getAsignacionHoyByUser(user!.id);
      if (!obra) {
        setIsLoading(false);
        return; // Sin asignación hoy, no mostrar modal
      }

      setObraAsignada(obra);
      setVisible(true);
    } catch (e) {
      console.error("[FichajeModal] Error al comprobar fichaje:", e);
      // En caso de error de red, no mostrar el modal para no bloquear al usuario
    } finally {
      setIsLoading(false);
    }
  }

  async function sincronizar() {
    await sincronizarFichajesPendientes(async (f) => {
      const { error } = await registrarFichaje({
        userId: f.user_id,
        obraId: f.obra_id,
        obraAsignadaId: f.obra_asignada_id,
        tenantId: f.tenant_id,
        estado: f.estado,
        esCambioObra: f.es_cambio_obra,
      });
      return { error };
    });
  }

  async function cargarObrasActivas() {
    const { data } = await insforge.database
      .from("obras")
      .select("id, nombre, direccion")
      .eq("tenant_id", user!.tenant_id)
      .eq("estado", "activa")
      .neq("id", obraAsignada?.id ?? "")
      .order("nombre");
    setObrasActivas((data as Obra[]) ?? []);
  }

  async function ficharSi() {
    if (!user || !obraAsignada) return;
    setIsSaving(true);
    await fichar("trabajando", obraAsignada.id, undefined, false);
  }

  async function ficharCambioObra(obraId: string) {
    if (!user || !obraAsignada) return;
    setIsSaving(true);
    await fichar("trabajando", obraId, obraAsignada.id, true);
  }

  async function ficharAusencia(motivo: MotivoAusencia) {
    if (!user) return;
    setIsSaving(true);
    const estado: FichajeEstado = motivo === "libre"      ? "libre"
      : motivo === "baja"       ? "baja"
      : motivo === "permiso"    ? "permiso"
      : motivo === "vacaciones" ? "vacaciones"
      : "otro";
    await fichar(estado, obraAsignada?.id, undefined, false);
  }

  async function fichar(
    estado: FichajeEstado,
    obraId?: string,
    obraAsignadaId?: string,
    esCambioObra = false,
  ) {
    setSaveError(null);
    try {
      if (online) {
        const { error } = await registrarFichaje({
          userId: user!.id,
          obraId,
          obraAsignadaId,
          tenantId: user!.tenant_id,
          estado,
          esCambioObra,
        });
        if (error) {
          setSaveError("Error al guardar el fichaje. Inténtalo de nuevo.");
          setIsSaving(false);
          return;
        }
      } else {
        await guardarFichajePendiente({
          userId: user!.id,
          obraId: obraId ?? "",
          obraAsignadaId,
          tenantId: user!.tenant_id,
          estado,
          esCambioObra,
        });
        setGuardadoOffline(true);
      }

      // Marcar en localStorage para no volver a preguntar hoy
      marcarFichadoLocal(user!.id);
      setPaso("completado");
    } catch (e) {
      console.error("[FichajeModal] Error al fichar:", e);
      setSaveError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  function irACambioObra() {
    cargarObrasActivas();
    setPaso("cambio_obra");
  }

  function cerrarTrasCompletado() {
    setVisible(false);
    setPaso("pregunta");
  }

  if (!visible || isLoading) return null;

  return (
    <div className="fullscreen-modal z-50 animate-fade-in">
      {/* Indicador de conexión */}
      <div className={cn(
        "absolute top-4 right-4 flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full",
        online ? "bg-success-light text-success-foreground" : "bg-warning-light text-warning-foreground",
      )}>
        {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
        {online ? "Conectado" : "Sin conexión"}
      </div>

      <div className="w-full max-w-sm mx-auto">

        {/* ── PASO 1: Pregunta principal ─────────────────────────────── */}
        {paso === "pregunta" && (
          <div className="flex flex-col items-center text-center animate-slide-up">
            <div className="w-20 h-20 bg-primary-light rounded-2xl flex items-center justify-center mb-6">
              <Building2 className="w-10 h-10 text-primary" />
            </div>
            <p className="text-content-secondary text-sm mb-2">
              Buenos días, <strong>{user?.nombre.split(" ")[0]}</strong>
            </p>
            <h1 className="text-2xl font-bold text-content-primary mb-1">¿Trabajas hoy en</h1>
            <h2 className="text-xl font-bold text-primary mb-1">{obraAsignada?.nombre}?</h2>
            <DireccionLink
              direccion={obraAsignada?.direccion ?? ""}
              showExternalIcon
              className="text-sm text-content-muted mb-10 hover:text-primary"
            />

            {saveError && (
              <div className="w-full flex items-center gap-2 bg-danger-light text-danger-foreground text-sm px-3 py-2 rounded-lg mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {saveError}
              </div>
            )}

            <div className="w-full space-y-3">
              <button
                onClick={ficharSi}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-3 bg-primary text-white py-4 rounded-xl text-base font-semibold shadow-md active:scale-[0.98] transition-all disabled:opacity-70"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Sí, estoy en la obra
              </button>

              <button
                onClick={irACambioObra}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-3 border-2 border-primary text-primary py-4 rounded-xl text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-70"
              >
                <ArrowLeftRight className="w-5 h-5" />
                Voy a otra obra
              </button>

              <button
                onClick={() => setPaso("ausencia")}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-3 text-content-secondary py-3 rounded-xl text-sm font-medium hover:bg-gray-50 active:scale-[0.98] transition-all"
              >
                <XCircle className="w-4 h-4" />
                Hoy no trabajo
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 2: Cambio de obra ─────────────────────────────────── */}
        {paso === "cambio_obra" && (
          <div className="flex flex-col items-center w-full animate-slide-up">
            <h1 className="text-xl font-bold text-content-primary mb-2">¿A qué obra vas?</h1>
            <p className="text-sm text-content-secondary mb-6">Selecciona la obra donde trabajarás hoy</p>
            <div className="w-full space-y-2 max-h-[50vh] overflow-y-auto">
              {obrasActivas.length === 0 ? (
                <p className="text-center text-content-muted text-sm py-8">No hay más obras activas</p>
              ) : (
                obrasActivas.map((obra) => (
                  <button
                    key={obra.id}
                    onClick={() => ficharCambioObra(obra.id)}
                    disabled={isSaving}
                    className="w-full flex items-start gap-3 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary-light text-left transition-all active:scale-[0.98]"
                  >
                    <Building2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-content-primary">{obra.nombre}</p>
                      <DireccionLink direccion={obra.direccion} className="text-xs text-content-muted" />
                    </div>
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
                  </button>
                ))
              )}
            </div>
            <button onClick={() => setPaso("pregunta")} className="mt-4 text-sm text-content-muted hover:text-content-secondary">
              ← Volver
            </button>
          </div>
        )}

        {/* ── PASO 3: Motivo de ausencia ─────────────────────────────── */}
        {paso === "ausencia" && (
          <div className="flex flex-col items-center w-full animate-slide-up">
            <h1 className="text-xl font-bold text-content-primary mb-2">¿Cuál es el motivo?</h1>
            <p className="text-sm text-content-secondary mb-6">Indica por qué no trabajas hoy</p>

            {saveError && (
              <div className="w-full flex items-center gap-2 bg-danger-light text-danger-foreground text-sm px-3 py-2 rounded-lg mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {saveError}
              </div>
            )}

            <div className="w-full space-y-2">
              {motivosAusencia.map((m) => (
                <button
                  key={m.value}
                  onClick={() => ficharAusencia(m.value)}
                  disabled={isSaving}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-warning hover:bg-warning-light text-left transition-all active:scale-[0.98]"
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="font-medium text-content-primary">{m.label}</span>
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
                </button>
              ))}
            </div>
            <button onClick={() => setPaso("pregunta")} className="mt-4 text-sm text-content-muted hover:text-content-secondary">
              ← Volver
            </button>
          </div>
        )}

        {/* ── PASO 4: Confirmación ───────────────────────────────────── */}
        {paso === "completado" && (
          <div className="flex flex-col items-center text-center animate-scale-in">
            <div className="w-24 h-24 bg-success-light rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-12 h-12 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-content-primary mb-2">
              {guardadoOffline ? "Fichaje guardado" : "¡Fichado!"}
            </h1>
            <p className="text-content-secondary text-sm mb-2">
              {guardadoOffline
                ? "Se sincronizará cuando tengas conexión a internet."
                : "Tu asistencia ha quedado registrada. ¡Buen trabajo hoy! 💪"}
            </p>
            {guardadoOffline && (
              <div className="flex items-center gap-2 text-xs text-warning-foreground bg-warning-light px-3 py-1.5 rounded-full mb-4">
                <WifiOff className="w-3 h-3" /> Pendiente de sincronización
              </div>
            )}
            <button onClick={cerrarTrasCompletado} className="btn-primary mt-6 px-8 py-3">
              Entrar a la app
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
