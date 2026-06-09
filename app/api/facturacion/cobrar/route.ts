/**
 * PATCH /api/facturacion/cobrar
 *
 * Marca todos los pagos de una factura como "cobrada".
 * Usado para facturas directas desde "Todas las facturas".
 *
 * Body: { factura_id: string }
 */
import { NextRequest, NextResponse } from "next/server";

const INSFORGE_URL = (process.env.NEXT_PUBLIC_INSFORGE_URL ?? "").replace(/\/$/, "");
const SERVICE_KEY  = process.env.INSFORGE_SERVICE_KEY!;

export async function PATCH(req: NextRequest) {
  try {
    const { factura_id } = await req.json();
    if (!factura_id) {
      return NextResponse.json({ error: "factura_id requerido" }, { status: 400 });
    }

    const fechaCobro = new Date().toISOString().split("T")[0];

    const res = await fetch(
      `${INSFORGE_URL}/api/database/records/pagos?factura_id=eq.${factura_id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-api-key": SERVICE_KEY },
        body: JSON.stringify({ estado: "cobrada", fecha_cobro: fechaCobro }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.message ?? `HTTP ${res.status}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, fecha_cobro: fechaCobro });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
