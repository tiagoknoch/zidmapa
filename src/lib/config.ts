export const locales = ["en", "sr"] as const;
export const defaultLocale = "en";

// Rough bounding box of Serbia; reports outside it are rejected.
export const SERBIA_BBOX = { minLat: 41.8, maxLat: 46.2, minLng: 18.8, maxLng: 23.1 };
export const SERBIA_CENTER: [number, number] = [20.9, 44.1];

export const NEARBY_RADIUS_M = 25;
export const MAX_REPORTS_PER_HOUR = 10;
export const PHOTO_BUCKET = "photos";

// Turnstile: the action the widget sends, and the hostnames its tokens may come from.
export const TURNSTILE_ACTION = "report";
export const TURNSTILE_HOSTNAMES = ["zidmapa.vercel.app"];

export const MAP_STYLE ="https://tiles.openfreemap.org/styles/liberty";

export function inSerbia(lat: number, lng: number) {
  const b = SERBIA_BBOX;
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

export function photoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
