import { createClient } from "@insforge/sdk";

/**
 * Cliente de InsForge.
 *
 * Las credenciales se cargan desde variables de entorno (.env.local).
 * El admin debe crear el proyecto en insforge.dev y pegar aquí:
 *  - NEXT_PUBLIC_INSFORGE_URL   → tu-proyecto.insforge.app
 *  - NEXT_PUBLIC_INSFORGE_KEY   → tu anon/public key
 */
const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const insforgeKey = process.env.NEXT_PUBLIC_INSFORGE_KEY!;

if (!insforgeUrl || !insforgeKey) {
  if (typeof window !== "undefined") {
    console.warn(
      "[InsForge] Faltan variables de entorno NEXT_PUBLIC_INSFORGE_URL y NEXT_PUBLIC_INSFORGE_KEY. " +
      "Copia .env.example a .env.local y añade tus credenciales."
    );
  }
}

export const insforge = createClient({
  baseUrl: insforgeUrl || "",
  anonKey: insforgeKey || "",
});

export default insforge;
