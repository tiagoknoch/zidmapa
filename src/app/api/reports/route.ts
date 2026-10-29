import { createHash, randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import type { NextRequest } from "next/server";
import { createAdminClient, getRequestUserId } from "@/lib/supabase/server";
import {
  inSerbia,
  MAX_REPORTS_PER_HOUR,
  PHOTO_BUCKET,
  TURNSTILE_ACTION,
  TURNSTILE_HOSTNAMES,
} from "@/lib/config";

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

function fail(error: string, status: number) {
  return Response.json({ error }, { status });
}

// Cloudflare's test secrets (1x…, 2x…, 3x…) return a dummy hostname and no action.
const isTestSecret = (secret: string) => /^[123]x0+/.test(secret);

async function verifyTurnstile(token: string, ip: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token || token.length > 2048) return false;
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as {
      success: boolean;
      action?: string;
      hostname?: string;
      "error-codes"?: string[];
    };
    if (data["error-codes"]?.includes("invalid-input-secret")) {
      Sentry.captureMessage("Turnstile: TURNSTILE_SECRET_KEY is invalid", "error");
    }
    if (!data.success) return false;
    if (isTestSecret(secret)) return true;
    return data.action === TURNSTILE_ACTION && TURNSTILE_HOSTNAMES.includes(data.hostname ?? "");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const photo = form.get("photo");
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  const confirmId = form.get("confirmId") ? String(form.get("confirmId")) : null;
  const token = String(form.get("token") ?? "");

  if (!(photo instanceof File) || !["image/jpeg", "image/webp"].includes(photo.type)) {
    return fail("generic", 400);
  }
  if (photo.size > MAX_PHOTO_BYTES) return fail("generic", 413);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inSerbia(lat, lng)) {
    return fail("outside", 400);
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  if (!(await verifyTurnstile(token, ip))) return fail("captcha", 400);

  const supabase = createAdminClient();
  const ipHash = ip
    ? createHash("sha256").update(`${ip}:${process.env.IP_HASH_SALT ?? ""}`).digest("hex")
    : null;

  if (ipHash) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_REPORTS_PER_HOUR) return fail("rate_limited", 429);
  }

  if (confirmId) {
    const { data: existing } = await supabase
      .from("reports")
      .select("id, status")
      .eq("id", confirmId)
      .maybeSingle();
    if (!existing || existing.status === "hidden") return fail("generic", 404);
  }

  const now = new Date();
  const ext = photo.type === "image/webp" ? "webp" : "jpg";
  const photoPath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    // Paths are unique and never overwritten, so browsers can cache for a year.
    .upload(photoPath, photo, { contentType: photo.type, cacheControl: "31536000" });
  if (uploadError) {
    Sentry.captureException(uploadError);
    return fail("generic", 500);
  }

  const reporterId = await getRequestUserId(request);
  let reportId = confirmId;

  if (!reportId) {
    const { data: report, error } = await supabase
      .from("reports")
      .insert({ lat, lng, note, photo_path: photoPath })
      .select("id")
      .single();
    if (error) {
      Sentry.captureException(error);
      await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
      return fail("generic", 500);
    }
    reportId = report.id as string;
  }

  const { error: submissionError } = await supabase.from("submissions").insert({
    report_id: reportId,
    kind: confirmId ? "confirm" : "new",
    photo_path: photoPath,
    reporter_id: reporterId,
    ip_hash: ipHash,
  });
  if (submissionError) {
    Sentry.captureException(submissionError);
    return fail("generic", 500);
  }

  return Response.json({ id: reportId, confirmed: Boolean(confirmId) });
}
