"use client";
import { useEffect, useRef, useState } from "react";
import { countries, byId } from "@/lib/content";
import type { Map as LibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
type Props = {
  selected: string | null;
  onSelect: (id: string) => void;
  reveal?: string;
  disabled?: boolean;
  study?: boolean;
};
export default function WorldMap({
  selected,
  onSelect,
  reveal,
  disabled = false,
  study = false,
}: Props) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LibreMap | null>(null),
    markers = useRef<Record<string, HTMLButtonElement>>({}),
    latest = useRef({ onSelect, disabled });
  latest.current = { onSelect, disabled };
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [keyboard, setKeyboard] = useState(false),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let disposed = false;
    let instance: LibreMap;
    setReady(false);
    setError("");
    import("maplibre-gl").then((m) => {
      if (disposed || !container.current) return;
      try {
        m.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
        instance = new m.Map({
          container: container.current,
          locale: {
            "NavigationControl.ZoomIn": "Acercar",
            "NavigationControl.ZoomOut": "Alejar",
            "AttributionControl.ToggleAttribution": "Mostrar fuentes",
            "Map.Title": "Mapamundi",
          },
          style: {
            version: 8,
            sources: {
              countries: { type: "geojson", data: "/data/world.json" },
            },
            layers: [
              {
                id: "water",
                type: "background",
                paint: { "background-color": "#e5f0f5" },
              },
              {
                id: "land",
                type: "fill",
                source: "countries",
                paint: {
                  "fill-color": "#c0d3d2",
                  "fill-outline-color": "#ffffff",
                },
              },
              {
                id: "selected",
                type: "fill",
                source: "countries",
                filter: ["==", ["get", "id"], ""],
                paint: { "fill-color": "#ef9479", "fill-opacity": 0.85 },
              },
              {
                id: "correct",
                type: "line",
                source: "countries",
                filter: ["==", ["get", "id"], ""],
                paint: { "line-color": "#008a6c", "line-width": 3 },
              },
            ],
          },
          center: [12, 15],
          zoom: 0.8,
          minZoom: 0,
          maxZoom: 10,
          attributionControl: false,
          renderWorldCopies: false,
        });
        map.current = instance;
        instance.addControl(
          new m.NavigationControl({ showCompass: false }),
          "top-right",
        );
        instance.addControl(
          new m.AttributionControl({
            compact: true,
            customAttribution: "Natural Earth · dominio público",
          }),
        );
        instance.on("load", () => {
          if (disposed) return;
          setReady(true);
          countries
            .filter((c) => c.small)
            .forEach((c) => {
              const button = document.createElement("button");
              button.className = "island-marker";
              markers.current[c.id] = button;
              button.textContent = "";
              button.setAttribute(
                "aria-label",
                `Seleccionar zona ${countries.indexOf(c) + 1}`,
              );
              button.addEventListener("click", (e) => {
                e.stopPropagation();
                if (!latest.current.disabled) latest.current.onSelect(c.id);
              });
              new m.Marker({ element: button })
                .setLngLat([c.lng, c.lat])
                .addTo(instance);
            });
        });
        instance.on("click", "land", (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (byId[id] && !latest.current.disabled) latest.current.onSelect(id);
        });
        instance.on("mouseenter", "land", () => {
          instance.getCanvas().style.cursor = "pointer";
        });
        instance.on("mouseleave", "land", () => {
          instance.getCanvas().style.cursor = "";
        });
        instance.on("error", () =>
          setError(
            "No se pudo cargar el mapa. Comprueba la conexión o utiliza las zonas de teclado.",
          ),
        );
      } catch {
        setError(
          "Tu navegador no puede mostrar el mapa interactivo. Prueba otro navegador con WebGL.",
        );
      }
    });
    return () => {
      disposed = true;
      instance?.remove();
      map.current = null;
    };
  }, [reload]);
  useEffect(() => {
    if (!ready || !map.current) return;
    for (const [id, el] of Object.entries(markers.current)) {
      el.classList.toggle("is-selected", id === selected);
      el.classList.toggle("is-correct", id === reveal);
      el.setAttribute("aria-pressed", String(id === selected));
    }
    map.current.setFilter("selected", ["==", ["get", "id"], selected ?? ""]);
    map.current.setFilter("correct", ["==", ["get", "id"], reveal ?? ""]);
    if (reveal) {
      const c = byId[reveal];
      map.current.flyTo({
        center: [c.lng, c.lat],
        zoom: c.small ? 5 : 2,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 650,
      });
    }
  }, [selected, reveal, ready]);
  return (
    <div className="map-wrap">
      <div
        ref={container}
        className="world-map"
        role="region"
        aria-label="Mapamundi interactivo sin nombres"
      />
      {!ready && !error && (
        <div className="map-loading" role="status">
          Preparando el mapamundi…
        </div>
      )}
      {error && (
        <p role="alert" className="warning">
          {error}{" "}
          <button onClick={() => setReload((n) => n + 1)}>Reintentar</button>
        </p>
      )}
      <div className="map-caption">
        <span>
          {reveal
            ? `Ubicación correcta: ${byId[reveal].name}`
            : selected
              ? `Zona ${countries.findIndex((c) => c.id === selected) + 1} seleccionada`
              : "Toca un país o un punto para seleccionarlo"}
        </span>
        <button
          className="text-button"
          onClick={() =>
            map.current?.flyTo({ center: [12, 15], zoom: 0.8, duration: 0 })
          }
        >
          Ver el mundo
        </button>
      </div>
      <p className="map-help">
        Arrastra para desplazarte. Usa + / − para acercarte. Los puntos amplían
        países pequeños.
      </p>
      <button
        className="text-button"
        onClick={() => setKeyboard(!keyboard)}
        aria-expanded={keyboard}
      >
        {keyboard ? "Ocultar" : "Abrir"} navegación por zonas con teclado
      </button>
      {keyboard && (
        <div className="zone-list">
          {countries.map((c, i) => (
            <button
              key={c.id}
              disabled={disabled}
              onFocus={() =>
                map.current?.flyTo({
                  center: [c.lng, c.lat],
                  zoom: 3,
                  duration: 0,
                })
              }
              onClick={() => onSelect(c.id)}
              aria-pressed={selected === c.id}
            >
              {study ? c.name : `Zona ${i + 1}`}
              <small>
                {Math.abs(c.lat)}° {c.lat >= 0 ? "N" : "S"} · {Math.abs(c.lng)}°{" "}
                {c.lng >= 0 ? "E" : "O"}
              </small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
