"use client";

import { useEffect, useState } from "react";
import { useTenantId, useIsAdmin } from "@/lib/stores/auth-store";
import { useRouter } from "next/navigation";
import { getFichajesByTenantMes, getUsuariosByTenant, getTarifaEmpleado } from "@/lib/insforge/database";
import type { User, Fichaje, JornalMes } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { ChevronLeft, ChevronRight, Calculator, Lock } from "lucide-react";
import { formatCurrency, formatMonthYear } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export default function JornalesPage() {
  const tenantId = useTenantId();
  const isAdmin = useIsAdmin();
  const router = useRouter();

  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [jornales, setJornales] = useState<JornalMes[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Solo admins pueden acceder
  useEffect(() => {
    if (!isAdmin) router.replace("/obras");
  }, [isAdmin]);

  useEffect(() => {
    if (tenantId && isAdmin) cargar();
  }, [tenantId, mes, anio, isAdmin]);

  async function cargar() {
    setIsLoading(true);
    const [usersRes, fichajesRes] = await Promise.all([
      getUsuariosByTenant(tenantId!),
      getFichajesByTenantMes(tenantId!, anio, mes),
    ]);

    const usuarios = ((usersRes.data as User[]) ?? []).filter((u) => u.rol === "empleado");
    const fichajes = (fichajesRes.data as (Fichaje & { user: User })[]) ?? [];

    // Calcular jornales por empleado
    const resultados: JornalMes[] = await Promise.all(
      usuarios.map(async (user) => {
        const fichajesUser = fichajes.filter((f) => f.user_id === user.id);
        const diasTrabajados = fichajesUser.filter((f) => f.estado === "trabajando").length;
        const diasBaja = fichajesUser.filter((f) => f.estado === "baja").length;
        const diasPermiso = fichajesUser.filter((f) => ["permiso", "vacaciones", "otro"].includes(f.estado)).length;
        const tarifaDiaria = await getTarifaEmpleado(user.id);

        return {
          user,
          mes,
          anio,
          dias_trabajados: diasTrabajados,
          dias_baja: diasBaja,
          dias_permiso: diasPermiso,
          tarifa_diaria: tarifaDiaria,
          total_bruto: diasTrabajados * tarifaDiaria,
          fichajes: fichajesUser,
        };
      })
    );

    setJornales(resultados);
    setIsLoading(false);
  }

  function cambiarMes(delta: number) {
    let nuevoMes = mes + delta;
    let nuevoAnio = anio;
    if (nuevoMes > 12) { nuevoMes = 1; nuevoAnio++; }
    if (nuevoMes < 1) { nuevoMes = 12; nuevoAnio--; }
    setMes(nuevoMes);
    setAnio(nuevoAnio);
  }

  const totalGeneral = jornales.reduce((acc, j) => acc + j.total_bruto, 0);

  if (!isAdmin) return null;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Jornales"
        subtitle="Cálculo automático de días trabajados"
        action={
          <div className="flex items-center gap-1.5 text-xs text-success-foreground bg-success-light px-3 py-1.5 rounded-full">
            <Lock className="w-3 h-3" /> Solo admins
          </div>
        }
      />

      {/* Selector de mes */}
      <div className="card p-3 flex items-center justify-between mb-6">
        <button onClick={() => cambiarMes(-1)} className="btn-ghost p-2">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold text-content-primary capitalize">
          {formatMonthYear(new Date(anio, mes - 1, 1))}
        </span>
        <button onClick={() => cambiarMes(1)} className="btn-ghost p-2">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card h-24" />)}
        </div>
      ) : (
        <>
          {/* Tabla de jornales */}
          <div className="card overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-content-muted uppercase">Empleado</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-content-muted uppercase">Días trabajados</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-content-muted uppercase">Baja</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-content-muted uppercase">Tarifa/día</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-content-muted uppercase">Total bruto</th>
                  </tr>
                </thead>
                <tbody>
                  {jornales.map((j) => (
                    <tr key={j.user.id} className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {j.user.nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-content-primary">{j.user.nombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={cn("badge", j.dias_trabajados > 0 ? "badge-primary" : "badge-gray")}>
                          {j.dias_trabajados} días
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {j.dias_baja > 0 ? (
                          <span className="badge badge-warning">{j.dias_baja}</span>
                        ) : (
                          <span className="text-content-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-content-secondary">
                        {j.tarifa_diaria > 0 ? formatCurrency(j.tarifa_diaria) : <span className="text-content-muted italic">Sin tarifa</span>}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={cn("font-bold text-base", j.total_bruto > 0 ? "text-content-primary" : "text-content-muted")}>
                          {formatCurrency(j.total_bruto)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Total general */}
          <div className="card p-5 flex items-center justify-between bg-primary text-white">
            <div className="flex items-center gap-3">
              <Calculator className="w-5 h-5" />
              <span className="font-semibold">Total del mes</span>
            </div>
            <span className="text-2xl font-bold">{formatCurrency(totalGeneral)}</span>
          </div>

          {/* Aviso legal */}
          <p className="text-xs text-content-muted mt-4 text-center px-4">
            ⚠️ Este cálculo es orientativo. No reemplaza a un sistema de nóminas oficial ni a un asesor laboral.
          </p>
        </>
      )}
    </div>
  );
}
