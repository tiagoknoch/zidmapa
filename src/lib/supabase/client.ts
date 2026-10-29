import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function getSupabase() {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
  return client;
}

export type Report = {
  id: string;
  lat: number;
  lng: number;
  photo_path: string;
  note: string | null;
  status: "reported" | "cleaned" | "hidden";
  confirm_count: number;
  created_at: string;
  last_seen_at: string;
  cleaned_at: string | null;
};

export const REPORT_COLUMNS =
  "id, lat, lng, photo_path, note, status, confirm_count, created_at, last_seen_at, cleaned_at";
