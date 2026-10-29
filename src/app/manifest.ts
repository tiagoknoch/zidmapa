import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZidMapa",
    short_name: "ZidMapa",
    description: "Report graffiti and help keep the city clean / Prijavi grafite i pomozi da grad bude čist",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#e4572e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
