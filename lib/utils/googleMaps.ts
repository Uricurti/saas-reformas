/**
 * Carga el script de Google Maps una sola vez (singleton).
 * Si la API key no está configurada, resuelve inmediatamente (sin crash).
 */
let loadPromise: Promise<void> | null = null;

export function loadGoogleMapsScript(): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (typeof window === "undefined" || !apiKey) return Promise.resolve();

  // Ya está cargado
  if ((window as any).google?.maps?.places) return Promise.resolve();

  // Ya hay una carga en progreso
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null; // permite reintentar
      reject(new Error("Error al cargar Google Maps"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
