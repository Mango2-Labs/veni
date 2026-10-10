"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapPoint } from "@/lib/places";

/** OpenFreeMap's light style, as on the event page. */
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

/** A still map with a pin for each event, framed so every pin shows. */
export function EventsMap({ points, label }: { points: MapPoint[]; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap>(undefined);
  const markers = useRef<Marker[]>([]);
  const [failed, setFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // MapLibre only runs in a browser, so it loads here rather than on the server.
  useEffect(() => {
    let isCancelled = false;
    import("maplibre-gl")
      .then(({ Map }) => {
        if (isCancelled || !container.current) return;
        const instance = new Map({
          container: container.current,
          style: MAP_STYLE,
          center: [10, 20],
          zoom: 0.6,
          interactive: false,
          attributionControl: { compact: true },
        });
        instance.on("load", () => {
          container.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
          setIsLoaded(true);
        });
        instance.on("error", () => !instance.loaded() && setFailed(true));
        map.current = instance;
      })
      .catch(() => setFailed(true));
    return () => {
      isCancelled = true;
      map.current?.remove();
    };
  }, []);

  // Pins follow the events shown: a city filter moves the map to just its events.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !isLoaded) return;
    let isCancelled = false;
    import("maplibre-gl").then(({ LngLatBounds, Marker }) => {
      if (isCancelled) return;
      for (const marker of markers.current) marker.remove();
      const orange = getComputedStyle(document.documentElement).getPropertyValue("--orange").trim();
      markers.current = points.map(({ latitude, longitude }) =>
        new Marker({ color: orange }).setLngLat([longitude, latitude]).addTo(instance),
      );
      if (points.length === 1) {
        instance.jumpTo({ center: [points[0].longitude, points[0].latitude], zoom: 11 });
      } else if (points.length > 1) {
        const bounds = new LngLatBounds();
        for (const { latitude, longitude } of points) bounds.extend([longitude, latitude]);
        instance.fitBounds(bounds, { padding: { top: 60, bottom: 40, left: 60, right: 60 }, maxZoom: 11, animate: false });
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [points, isLoaded]);

  return (
    <div className="event-map" ref={container} role="img" aria-label={label}>
      {failed && <p className="map-fallback">The map couldn&apos;t load.</p>}
    </div>
  );
}
