"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapPoint } from "@/lib/places";

/** OpenFreeMap's light style: free, keyless, and quiet enough for the pin to stand out. */
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const STREET_ZOOM = 15;

/** A map with the event's pin. With `onMove`, the host can drag or click to move it. */
export function EventMap({ point, label, onMove }: { point: MapPoint; label: string; onMove?: (point: MapPoint) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap>(undefined);
  const marker = useRef<Marker>(undefined);
  /** The point to show, kept for the map to open at once it has loaded. */
  const wanted = useRef(point);
  const isEditable = useRef(onMove !== undefined);
  const [failed, setFailed] = useState(false);
  const moveTo = useEffectEvent((next: MapPoint) => onMove?.(next));

  // MapLibre only runs in a browser, so it loads here rather than on the server.
  useEffect(() => {
    let isCancelled = false;
    import("maplibre-gl")
      .then(({ Map, Marker }) => {
        if (isCancelled || !container.current) return;
        const { latitude, longitude } = wanted.current;
        const editable = isEditable.current;
        const instance = new Map({
          container: container.current,
          style: MAP_STYLE,
          center: [longitude, latitude],
          zoom: STREET_ZOOM,
          interactive: editable,
          attributionControl: { compact: true },
        });
        let hasLoaded = false;
        instance.on("load", () => {
          hasLoaded = true;
          // Fold the map credit behind its (i) button so it doesn't cover a small map.
          container.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        });
        instance.on("error", () => !hasLoaded && setFailed(true));
        const orange = getComputedStyle(document.documentElement).getPropertyValue("--orange").trim();
        const pin = new Marker({ color: orange, draggable: editable }).setLngLat([longitude, latitude]).addTo(instance);
        if (editable) {
          pin.on("dragend", () => {
            const { lat, lng } = pin.getLngLat();
            moveTo({ latitude: lat, longitude: lng });
          });
          instance.on("click", ({ lngLat }) => {
            pin.setLngLat(lngLat);
            moveTo({ latitude: lngLat.lat, longitude: lngLat.lng });
          });
        }
        map.current = instance;
        marker.current = pin;
      })
      .catch(() => setFailed(true));
    return () => {
      isCancelled = true;
      map.current?.remove();
    };
  }, []);

  // A newly picked place: jump there. A pin the host just placed is already in view.
  useEffect(() => {
    wanted.current = point;
    const pin = marker.current;
    if (!pin) return;
    const { lat, lng } = pin.getLngLat();
    if (lat === point.latitude && lng === point.longitude) return;
    pin.setLngLat([point.longitude, point.latitude]);
    map.current?.jumpTo({ center: [point.longitude, point.latitude] });
  }, [point]);

  return (
    <div className="event-map" ref={container} role={onMove ? "group" : "img"} aria-label={label}>
      {failed && <p className="map-fallback">The map couldn&apos;t load.</p>}
    </div>
  );
}
