/**
 * PATCH /api/facturacion/cobrar
 *
 * Gestiona el cobro / deshacer cobro de un pago.
 *
 * Body:
 *   { accion: "cobrar",   factura_id, pago_id? }
 *     → marca el pago (o todos los de la factura) como "cobrada"
 *
 *   { accion: "deshacer", factura_id, pago_id? }
 *     → revierte a "emitida" y borra fecha_cobro
 *
 * Si se pasa pago_id se actúa solo sobre ese pago (para pagos de obra).
 * Si no, se actúa sobre todos los pagos de la factura (para directas).
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

async function patchPagos(filter: string, body: object) {
  const res = await fetch(
    `${INSFORGE_URL}/api/database/records/pagos?${filter}`,
    {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
      body:    JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { accion = "cobrar", factura_id, pago_id } = await req.json();

    if (!factura_id) {
      return NextResponse.json({ error: "factura_id requerido" }, { status: 400 });
    }

    // El filtro de la query: un pago concreto o todos los de la factura
    const filter = pago_id
      ? `id=eq.${pago_id}`
      : `factura_id=eq.${factura_id}`;

    if (accion === "cobrar") {
      const fechaCobro = new Date().toISOString().split("T")[0];
      await patchPagos(filter, { estado: "cobrada", fecha_cobro: fechaCobro });
      return NextResponse.json({ ok: true, fecha_cobro: fechaCobro });
    }

    if (accion === "deshacer") {
      await patchPagos(filter, { estado: "emitida", fecha_cobro: null });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Acción desconocida: ${accion}` }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
