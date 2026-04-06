import { useEffect, useRef } from "react";

/**
 * Llama a `callback` cuando el usuario vuelve a la pestaña después
 * de haber estado en otra app o pestaña.
 * Útil para recargar datos sin depender de polling.
 */
export function useRefreshOnFocus(callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        callbackRef.current();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}
