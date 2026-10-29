"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { getImageProps } from "next/image";
import * as maplibregl from "@/lib/maplibre";
import type { GeoJSONSource } from "@/lib/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Dictionary, Locale } from "@/lib/i18n";
import { isSupabaseConfigured, MAP_STYLE, photoUrl, SERBIA_CENTER } from "@/lib/config";
import { fill, formatDate } from "@/lib/format";
import { getSupabase, REPORT_COLUMNS, type Report } from "@/lib/supabase/client";
import AboutPanel from "./AboutPanel";

const ABOUT_SEEN_KEY = "zidmapa-about-seen";
const noSubscribe = () => () => {};

// Explain the app on the first visit, but not when opening a shared report link.
function isFirstVisit() {
  try {
    return !localStorage.getItem(ABOUT_SEEN_KEY) && !new URLSearchParams(window.location.search).has("r");
  } catch {
    return false;
  }
}

type Props = { lang: Locale; dict: Dictionary };

function toGeoJSON(reports: Report[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: reports.map((r) => ({
      type: "Feature",
      id: r.id,
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: { id: r.id, status: r.status, count: r.confirm_count },
    })),
  };
}

function popupHtml(r: Report, lang: Locale, dict: Dictionary) {
  const div = document.createElement("div");
  div.className = "w-60 text-sm";
  const img = document.createElement("img");
  // The popup is built outside React, so take the thumbnail URLs from next/image.
  const { props } = getImageProps({ src: photoUrl(r.photo_path), alt: "", width: 240, height: 160 });
  img.src = props.src;
  if (props.srcSet) img.srcset = props.srcSet;
  img.alt = "";
  img.className = "h-40 w-full object-cover bg-surface";
  const body = document.createElement("div");
  body.className = "space-y-1 p-3";
  const status = document.createElement("div");
  status.className = `font-semibold ${r.status === "cleaned" ? "text-ok" : "text-accent"}`;
  status.textContent = dict.status[r.status];
  const meta = document.createElement("div");
  meta.className = "text-muted";
  meta.textContent = [
    `${dict.map.reportedOn}: ${formatDate(r.created_at, lang)}`,
    r.cleaned_at ? `${dict.map.cleanedOn}: ${formatDate(r.cleaned_at, lang)}` : null,
    fill(dict.map.reports, { n: r.confirm_count }),
  ]
    .filter(Boolean)
    .join(" · ");
  body.append(status, meta);
  if (r.note) {
    const note = document.createElement("p");
    note.textContent = r.note;
    body.append(note);
  }
  div.append(img, body);
  return div;
}

export default function MapView({ lang, dict }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [showCleaned, setShowCleaned] = useState(false);
  const firstVisit = useSyncExternalStore(noSubscribe, isFirstVisit, () => false);
  // null until the user opens or closes the panel; until then it follows firstVisit.
  const [aboutChoice, setAboutChoice] = useState<boolean | null>(null);
  const showAbout = aboutChoice ?? firstVisit;
  const [error, setError] = useState<string | null>(
    isSupabaseConfigured ? null : dict.map.notConfigured,
  );

  function closeAbout() {
    setAboutChoice(false);
    try {
      localStorage.setItem(ABOUT_SEEN_KEY, "1");
    } catch {}
  }

  // Load reports once.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSupabase()
      .from("reports")
      .select(REPORT_COLUMNS)
      .neq("status", "hidden")
      .order("created_at", { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (error) setError(dict.map.loadError);
        else setReports(data as Report[]);
      });
  }, [dict]);

  // Create the map.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: MAP_STYLE,
      center: SERBIA_CENTER,
      zoom: 6.3,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      fitBoundsOptions: { maxZoom: 15 },
    });
    map.addControl(geolocate, "bottom-right");

    map.on("load", async () => {
      map.addSource("reports", {
        type: "geojson",
        data: toGeoJSON([]),
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 16,
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "reports",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#e4572e",
          "circle-opacity": 0.85,
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 28],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "reports",
        filter: ["has", "point_count"],
        layout: { "text-field": "{point_count_abbreviated}", "text-size": 13, "text-font": ["Noto Sans Bold"] },
        paint: { "text-color": "#fff" },
      });
      map.addLayer({
        id: "points",
        type: "circle",
        source: "reports",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["match", ["get", "status"], "cleaned", "#2e9e5b", "#e4572e"],
          "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 8, 10, 14],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
        },
      });

      map.on("click", "clusters", async (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const source = map.getSource("reports") as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
        map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
      for (const layer of ["clusters", "points"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }

      // Only ask for location automatically if the user already allowed it.
      const permission = await navigator.permissions?.query({ name: "geolocation" }).catch(() => null);
      if (permission?.state === "granted" && !new URLSearchParams(location.search).has("r")) {
        geolocate.trigger();
      }
    });

    return () => map.remove();
  }, []);

  // Push data into the map whenever it or the filter changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !reports) return;
    const visible = showCleaned ? reports : reports.filter((r) => r.status !== "cleaned");
    const apply = () => (map.getSource("reports") as GeoJSONSource | undefined)?.setData(toGeoJSON(visible));
    if (map.getSource("reports")) apply();
    else map.once("load", apply);

    const onPointClick = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties.id;
      const report = reports.find((r) => r.id === id);
      if (!report) return;
      new maplibregl.Popup({ offset: 12, maxWidth: "none" })
        .setLngLat([report.lng, report.lat])
        .setDOMContent(popupHtml(report, lang, dict))
        .addTo(map);
    };
    map.on("click", "points", onPointClick);

    // Deep link: /?r=<report id>
    const linked = reports.find((r) => r.id === new URLSearchParams(location.search).get("r"));
    if (linked) {
      const open = () => {
        map.jumpTo({ center: [linked.lng, linked.lat], zoom: 17 });
        new maplibregl.Popup({ offset: 12, maxWidth: "none" })
          .setLngLat([linked.lng, linked.lat])
          .setDOMContent(popupHtml(linked, lang, dict))
          .addTo(map);
      };
      if (map.loaded()) open();
      else map.once("load", open);
    }

    return () => {
      map.off("click", "points", onPointClick);
    };
  }, [reports, showCleaned, lang, dict]);

  const otherLang = lang === "en" ? "sr" : "en";

  return (
    <div className="relative h-dvh w-full">
      <div ref={container} className="h-full w-full" />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto rounded-xl bg-background/95 px-3 py-2 shadow">
          <h1 className="text-lg font-bold leading-tight">
            Zid<span className="text-accent">Mapa</span>
          </h1>
          <p className="text-xs text-muted">{dict.app.tagline}</p>
        </div>
        <nav className="pointer-events-auto flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setAboutChoice(true)}
            aria-label={dict.nav.about}
            title={dict.nav.about}
            className="size-9 rounded-full bg-background/95 font-serif text-base font-bold italic shadow"
          >
            i
          </button>
          <Link href={`/${otherLang}`} className="rounded-xl bg-background/95 px-3 py-2 shadow">
            {dict.nav.switchLanguage}
          </Link>
          <Link href={`/${lang}/login`} className="rounded-xl bg-background/95 px-3 py-2 shadow">
            {dict.nav.account}
          </Link>
        </nav>
      </header>

      <div className="absolute left-3 top-24 flex flex-col gap-2">
        <label className="flex items-center gap-2 rounded-xl bg-background/95 px-3 py-2 text-sm shadow">
          <input
            type="checkbox"
            checked={showCleaned}
            onChange={(e) => setShowCleaned(e.target.checked)}
            className="accent-[var(--ok)]"
          />
          {dict.map.showCleaned}
        </label>
        {error && <p className="max-w-64 rounded-xl bg-background/95 px-3 py-2 text-sm text-accent shadow">{error}</p>}
        {!error && !reports && (
          <p className="rounded-xl bg-background/95 px-3 py-2 text-sm text-muted shadow">{dict.map.loading}</p>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Link
          href={`/${lang}/report`}
          className="rounded-full bg-accent px-6 py-4 text-base font-semibold text-accent-contrast shadow-lg active:scale-95"
        >
          📷 {dict.map.reportButton}
        </Link>
      </div>

      {showAbout && <AboutPanel dict={dict} onClose={closeAbout} />}
    </div>
  );
}
