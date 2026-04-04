import { redirect } from "next/navigation";

/**
 * Página raíz — redirige siempre a /login.
 * El layout del dashboard protege las rutas autenticadas.
 * El login redirige a /obras si la sesión ya está activa.
 */
export default function RootPage() {
  redirect("/login");
}
