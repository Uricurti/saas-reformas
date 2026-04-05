/**
 * Cliente InsForge con SERVICE KEY — solo usar en server-side (API Routes).
 * NUNCA importar en componentes del cliente (expone la clave de servicio).
 */
import { createClient } from "@insforge/sdk";

const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const serviceKey  = process.env.INSFORGE_SERVICE_KEY!;

export const insforgeAdmin = createClient({
  baseUrl: insforgeUrl || "",
  anonKey: serviceKey  || "",
});

export default insforgeAdmin;
