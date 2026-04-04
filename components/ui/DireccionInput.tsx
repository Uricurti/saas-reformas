"use client";

/**
 * Input de dirección con autocompletado de Google Places.
 *
 * Usa AutocompleteService (no el widget de DOM) para tener control
 * total desde React: no hay conflictos, el desplegable es nuestro.
 *
 * - Con NEXT_PUBLIC_GOOGLE_MAPS_KEY: sugerencias en tiempo real.
 * - Sin clave: funciona como input normal sin autocompletado.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadGoogleMapsScript } from "@/lib/utils/googleMaps";

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export function DireccionInput({
  value,
  onChange,
  placeholder = "Carrer de Balmes 42, Barcelona",
  className,
  required,
  disabled,
}: Props) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);

  const serviceRef  = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  // Sincronizar si el padre actualiza el valor externamente
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Cargar Google Maps y crear el servicio de predicciones
  useEffect(() => {
    if (!apiKey) return;
    loadGoogleMapsScript()
      .then(() => {
        const google = (window as any).google;
        serviceRef.current = new google.maps.places.AutocompleteService();
        setMapsReady(true);
      })
      .catch(() => {/* sin autocompletado, input normal */});
  }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPredictions = useCallback((input: string) => {
    if (!serviceRef.current || input.trim().length < 3) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    serviceRef.current.getPlacePredictions(
      { input, types: ["address"] },
      (results: Prediction[] | null, status: string) => {
        setIsLoading(false);
        if (status === "OK" && results?.length) {
          setPredictions(results.slice(0, 5)); // máximo 5 sugerencias
          setIsOpen(true);
        } else {
          setPredictions([]);
          setIsOpen(false);
        }
      }
    );
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setInputValue(v);
    onChange(v);

    clearTimeout(debounceRef.current);
    if (mapsReady) {
      debounceRef.current = setTimeout(() => fetchPredictions(v), 280);
    }
  }

  function handleSelect(prediction: Prediction) {
    const address = prediction.description;
    setInputValue(address);
    onChange(address);
    setPredictions([]);
    setIsOpen(false);
  }

  function handleBlur() {
    // Pequeño delay para permitir el click en el desplegable antes de cerrarlo
    setTimeout(() => setIsOpen(false), 160);
  }

  return (
    <div className="relative w-full">
      {/* Input principal */}
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={() => predictions.length > 0 && setIsOpen(true)}
        placeholder={placeholder}
        className={cn("input w-full", mapsReady && "pr-9", className)}
        required={required}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
      />

      {/* Icono de estado */}
      {mapsReady && (
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          {isLoading
            ? <Loader2 className="w-4 h-4 text-primary opacity-60 animate-spin" />
            : <MapPin className="w-4 h-4 text-primary opacity-50" />
          }
        </div>
      )}

      {/* Desplegable de sugerencias */}
      {isOpen && predictions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-border shadow-lg z-[9999] overflow-hidden">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              type="button"
              // preventDefault evita que el blur cierre el panel antes de procesar el click
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(p)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors border-b border-border/60 last:border-0"
            >
              <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0 opacity-70" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-content-primary leading-snug">
                  {p.structured_formatting.main_text}
                </p>
                <p className="text-xs text-content-muted truncate">
                  {p.structured_formatting.secondary_text}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
