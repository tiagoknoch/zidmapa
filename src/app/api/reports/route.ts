import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient, getRequestUserId } from "@/lib/supabase/server";
import { inSerbia, MAX_REPORTS_PER_HOUR, PHOTO_BUCKET } from "@/lib/config";

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

function fail(error: string, status: number) {
  return Response.json({ error }, { status });
}

async function verifyTurnstile(token: string, ip: string | null) {
  const body = new FormData();
  body.append("secret", process.env.TURNSTILE_SECRET_KEY!);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const data = (await res.json()) as { success: boolean };
  return data.success;
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
    .upload(photoPath, photo, { contentType: photo.type });
  if (uploadError) return fail("generic", 500);

  const reporterId = await getRequestUserId(request);
  let reportId = confirmId;

  if (!reportId) {
    const { data: report, error } = await supabase
      .from("reports")
      .insert({ lat, lng, note, photo_path: photoPath })
      .select("id")
      .single();
    if (error) {
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
  if (submissionError) return fail("generic", 500);

  return Response.json({ id: reportId, confirmed: Boolean(confirmId) });
}
