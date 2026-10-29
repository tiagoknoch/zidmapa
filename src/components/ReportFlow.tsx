"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import type { Dictionary, Locale } from "@/lib/i18n";
import { inSerbia, NEARBY_RADIUS_M, photoUrl } from "@/lib/config";
import { fill } from "@/lib/format";
import { compressPhoto, getDevicePosition, readPhotoGps, type DevicePosition } from "@/lib/photo";
import { getSupabase } from "@/lib/supabase/client";
import Turnstile from "./Turnstile";

const LocationPicker = dynamic(() => import("./LocationPicker"), { ssr: false });

type Props = { lang: Locale; dict: Dictionary };
type Step = "capture" | "locate" | "nearby" | "details" | "done";
type LngLat = { lat: number; lng: number };
type Nearby = { id: string; photo_path: string; distance_m: number; confirm_count: number };

export default function ReportFlow({ lang, dict }: Props) {
  const t = dict.report;
  const [step, setStep] = useState<Step>("capture");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [device, setDevice] = useState<DevicePosition | null | undefined>(undefined);
  const [position, setPosition] = useState<LngLat | null>(null);
  const [source, setSource] = useState<"photo" | "gps" | "manual" | null>(null);

  const [nearby, setNearby] = useState<Nearby[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);

  // Start GPS early so it's warm by the time the photo is ready.
  // If it arrives after the photo and nothing better was chosen, use it.
  useEffect(() => {
    getDevicePosition().then((p) => {
      setDevice(p);
      if (!p) return;
      setPosition((current) => current ?? { lat: p.lat, lng: p.lng });
      setSource((current) => current ?? "gps");
    });
  }, []);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setProcessing(true);
    try {
      const [compressed, exifGps] = await Promise.all([compressPhoto(file), readPhotoGps(file)]);
      setPhoto(compressed);
      setPreview(URL.createObjectURL(compressed));
      if (exifGps) {
        setPosition(exifGps);
        setSource("photo");
      } else if (device) {
        setPosition({ lat: device.lat, lng: device.lng });
        setSource("gps");
      } else {
        setPosition(null);
        setSource(null);
      }
      setStep("locate");
    } catch {
      setError(t.capture.error);
    } finally {
      setProcessing(false);
    }
  }

  async function confirmLocation() {
    if (!position) return;
    setStep("nearby");
    setNearby(null);
    const { data } = await getSupabase().rpc("nearby_reports", {
      p_lat: position.lat,
      p_lng: position.lng,
      p_radius_m: NEARBY_RADIUS_M,
    });
    const found = (data ?? []) as Nearby[];
    if (found.length === 0) setStep("details");
    else setNearby(found);
  }

  async function submit() {
    if (!photo || !position || !token) return;
    setSending(true);
    setError(null);
    const form = new FormData();
    form.append("photo", photo, "photo.jpg");
    form.append("lat", String(position.lat));
    form.append("lng", String(position.lng));
    form.append("token", token);
    if (confirmId) form.append("confirmId", confirmId);
    else form.append("note", note);

    try {
      const res = await fetch("/api/reports", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "generic");
      setResultId(data.id);
      setStep("done");
    } catch (e) {
      const code = (e as Error).message as keyof typeof t.errors;
      setError(t.errors[code] ?? t.errors.generic);
      setToken(null);
      setCaptchaKey((k) => k + 1); // tokens are single-use
    } finally {
      setSending(false);
    }
  }

  function restart() {
    setStep("capture");
    setPhoto(null);
    setPreview(null);
    setPosition(null);
    setSource(null);
    setNearby(null);
    setConfirmId(null);
    setNote("");
    setError(null);
    setResultId(null);
  }

  const back: Partial<Record<Step, () => void>> = {
    locate: () => setStep("capture"),
    nearby: () => setStep("locate"),
    details: () => setStep(nearby?.length ? "nearby" : "locate"),
  };
  const outside = position !== null && !inSerbia(position.lat, position.lng);

  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {back[step] ? (
          <button onClick={back[step]} className="text-sm text-muted">
            ← {t.back}
          </button>
        ) : (
          <Link href={`/${lang}`} className="text-sm text-muted">
            ← {dict.nav.map}
          </Link>
        )}
        <span className="ml-auto font-bold">
          Zid<span className="text-accent">Mapa</span>
        </span>
      </header>

      {step === "capture" && (
        <main className="flex flex-1 flex-col justify-center gap-4 p-6">
          <h2 className="text-2xl font-bold">{t.capture.heading}</h2>
          {processing ? (
            <p className="text-muted">{t.capture.processing}</p>
          ) : (
            <>
              <label className="flex cursor-pointer items-center justify-center rounded-2xl bg-accent px-6 py-5 text-lg font-semibold text-accent-contrast active:scale-95">
                📷 {t.capture.takePhoto}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </label>
              <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-border px-6 py-4 font-medium">
                🖼️ {t.capture.fromGallery}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </label>
            </>
          )}
          {error && <p className="text-accent">{error}</p>}
          <p className="text-sm text-muted">{t.capture.privacy}</p>
        </main>
      )}

      {step === "locate" && (
        <main className="flex flex-1 flex-col">
          <div className="space-y-1 p-4">
            <h2 className="text-xl font-bold">{t.locate.heading}</h2>
            <p className="text-sm text-muted">
              {source === "photo" && t.locate.fromPhoto}
              {source === "gps" && device && fill(t.locate.fromGps, { m: Math.round(device.accuracy) })}
              {!source && (device === undefined ? t.locate.locating : t.locate.noLocation)}
              {source && ` · ${t.locate.hint}`}
            </p>
          </div>
          <div className="relative flex-1">
            <LocationPicker
              value={position}
              onChange={(p) => {
                setPosition(p);
                setSource((s) => s ?? "manual");
              }}
            />
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt=""
                className="absolute left-3 top-3 h-24 w-24 rounded-xl border-2 border-white object-cover shadow"
              />
            )}
          </div>
          <div className="space-y-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {outside && <p className="text-sm text-accent">{t.locate.outside}</p>}
            <button
              disabled={!position || outside}
              onClick={confirmLocation}
              className="w-full rounded-2xl bg-accent px-6 py-4 font-semibold text-accent-contrast disabled:opacity-40"
            >
              {t.locate.confirm}
            </button>
          </div>
        </main>
      )}

      {step === "nearby" && (
        <main className="flex-1 space-y-4 overflow-y-auto p-4">
          {!nearby ? (
            <p className="text-muted">{t.nearby.checking}</p>
          ) : (
            <>
              <h2 className="text-xl font-bold">{t.nearby.heading}</h2>
              <p className="text-sm text-muted">{fill(t.nearby.hint, { m: NEARBY_RADIUS_M })}</p>
              <ul className="grid grid-cols-2 gap-3">
                {nearby.map((n) => (
                  <li key={n.id} className="overflow-hidden rounded-xl border border-border">
                    <Image
                      src={photoUrl(n.photo_path)}
                      alt=""
                      width={320}
                      height={320}
                      className="aspect-square w-full bg-surface object-cover"
                    />
                    <div className="space-y-2 p-2">
                      <p className="text-xs text-muted">
                        {fill(t.nearby.distance, { m: Math.round(n.distance_m) })} ·{" "}
                        {fill(dict.map.reports, { n: n.confirm_count })}
                      </p>
                      <button
                        onClick={() => {
                          setConfirmId(n.id);
                          setStep("details");
                        }}
                        className="w-full rounded-lg bg-accent py-2 text-sm font-semibold text-accent-contrast"
                      >
                        {t.nearby.sameOne}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  setConfirmId(null);
                  setStep("details");
                }}
                className="w-full rounded-2xl border border-border px-6 py-4 font-medium"
              >
                {t.nearby.noneOfThese}
              </button>
            </>
          )}
        </main>
      )}

      {step === "details" && (
        <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <h2 className="text-xl font-bold">{confirmId ? t.details.confirmHeading : t.details.heading}</h2>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-64 w-full rounded-xl object-cover" />
          )}
          {!confirmId && (
            <label className="space-y-1">
              <span className="text-sm font-medium">{t.details.noteLabel}</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={t.details.notePlaceholder}
                className="w-full rounded-xl border border-border bg-background p-3"
              />
            </label>
          )}
          <Turnstile key={captchaKey} lang={lang} onToken={setToken} />
          {error && <p className="text-accent">{error}</p>}
          <button
            disabled={!token || sending}
            onClick={submit}
            className="mt-auto w-full rounded-2xl bg-accent px-6 py-4 font-semibold text-accent-contrast disabled:opacity-40"
          >
            {sending ? t.details.sending : confirmId ? t.details.confirmSubmit : t.details.submit}
          </button>
        </main>
      )}

      {step === "done" && (
        <main className="flex flex-1 flex-col justify-center gap-4 p-6 text-center">
          <div className="text-5xl">✅</div>
          <h2 className="text-2xl font-bold">{t.done.heading}</h2>
          <p className="text-muted">{confirmId ? t.done.confirmedBody : t.done.body}</p>
          <Link
            href={`/${lang}?r=${resultId}`}
            className="rounded-2xl bg-accent px-6 py-4 font-semibold text-accent-contrast"
          >
            {t.done.viewMap}
          </Link>
          <button onClick={restart} className="rounded-2xl border border-border px-6 py-4 font-medium">
            {t.done.another}
          </button>
        </main>
      )}
    </div>
  );
}
