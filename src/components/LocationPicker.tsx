"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE, SERBIA_CENTER } from "@/lib/config";

type LngLat = { lat: number; lng: number };
type Props = { value: LngLat | null; onChange: (value: LngLat) => void };

// Small map with a draggable pin. Tapping the map also moves the pin.
export default function LocationPicker({ value, onChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: MAP_STYLE,
      center: SERBIA_CENTER,
      zoom: 6.3,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    const marker = new maplibregl.Marker({ color: "#e4572e", draggable: true });
    markerRef.current = marker;

    marker.on("dragend", () => {
      const { lat, lng } = marker.getLngLat();
      onChangeRef.current({ lat, lng });
    });
    map.on("click", (e) => {
      marker.setLngLat(e.lngLat).addTo(map);
      onChangeRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    return () => map.remove();
  }, []);

  // Follow external position changes (e.g. GPS arriving).
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !value) return;
    const current = marker.getLngLat?.();
    if (current && current.lat === value.lat && current.lng === value.lng) return;
    marker.setLngLat([value.lng, value.lat]).addTo(map);
    map.jumpTo({ center: [value.lng, value.lat], zoom: 18 });
  }, [value]);

  return <div ref={container} className="h-full w-full" />;
}
