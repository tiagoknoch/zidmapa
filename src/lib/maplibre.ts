import { getVersion, setWorkerUrl } from "maplibre-gl";

// MapLibre finds its worker relative to its own module URL, which the bundler
// rewrites. Serve the copy that `postinstall` puts in public/ instead.
setWorkerUrl(`/maplibre-gl-worker.mjs?v=${getVersion()}`);

export * from "maplibre-gl";

let webgl2: boolean | undefined;

// MapLibre needs WebGL2, which some old browsers and headless bots don't have.
export function supportsWebGL2() {
  if (webgl2 === undefined) {
    const gl = document.createElement("canvas").getContext("webgl2");
    webgl2 = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return webgl2;
}
