import { getVersion, setWorkerUrl } from "maplibre-gl";

// MapLibre finds its worker relative to its own module URL, which the bundler
// rewrites. Serve the copy that `postinstall` puts in public/ instead.
setWorkerUrl(`/maplibre-gl-worker.mjs?v=${getVersion()}`);

export * from "maplibre-gl";
