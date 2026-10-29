"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import { PHOTO_BUCKET, photoUrl } from "@/lib/config";
import { fill, formatDate } from "@/lib/format";
import { getSupabase, REPORT_COLUMNS, type Report } from "@/lib/supabase/client";

type Props = { lang: Locale; dict: Dictionary };
type Filter = "all" | Report["status"];

async function fetchReports(filter: Filter) {
  let query = getSupabase().from("reports").select(REPORT_COLUMNS).order("created_at", { ascending: false }).limit(200);
  if (filter !== "all") query = query.eq("status", filter);
  const { data } = await query;
  return (data ?? []) as Report[];
}

export default function AdminPanel({ lang, dict }: Props) {
  const t = dict.admin;
  const [access, setAccess] = useState<"loading" | "anon" | "denied" | "ok">("loading");
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<Filter>("reported");
  const [armedDelete, setArmedDelete] = useState<string | null>(null);

  const load = useCallback(
    () => fetchReports(filter).then(setReports),
    [filter],
  );

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return setAccess("anon");
      const { data: isAdmin } = await supabase.rpc("is_admin");
      setAccess(isAdmin ? "ok" : "denied");
    });
  }, []);

  useEffect(() => {
    if (access === "ok") fetchReports(filter).then(setReports);
  }, [access, filter]);

  async function setStatus(report: Report, status: Report["status"]) {
    await getSupabase()
      .from("reports")
      .update({ status, cleaned_at: status === "cleaned" ? new Date().toISOString() : null })
      .eq("id", report.id);
    load();
  }

  async function remove(report: Report) {
    if (armedDelete !== report.id) return setArmedDelete(report.id);
    const supabase = getSupabase();
    const { data: subs } = await supabase.from("submissions").select("photo_path").eq("report_id", report.id);
    const paths = new Set([report.photo_path, ...(subs ?? []).map((s) => s.photo_path).filter(Boolean)]);
    await supabase.storage.from(PHOTO_BUCKET).remove([...paths]);
    await supabase.from("reports").delete().eq("id", report.id);
    setArmedDelete(null);
    load();
  }

  const filters: Filter[] = ["reported", "cleaned", "hidden", "all"];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <Link href={`/${lang}`} className="text-sm text-muted">
          ← {dict.nav.map}
        </Link>
        <h1 className="ml-auto text-xl font-bold">{t.heading}</h1>
      </div>

      {access === "anon" && (
        <p>
          {t.needLogin}{" "}
          <Link href={`/${lang}/login`} className="text-accent underline">
            {dict.nav.account}
          </Link>
        </p>
      )}
      {access === "denied" && <p>{t.notAdmin}</p>}

      {access === "ok" && (
        <>
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-sm ${f === filter ? "bg-foreground text-background" : "border border-border"}`}
              >
                {f === "all" ? t.all : dict.status[f]}
              </button>
            ))}
          </div>

          {reports.length === 0 && <p className="text-muted">{t.empty}</p>}

          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="flex gap-3 rounded-xl border border-border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(r.photo_path)} alt="" className="h-24 w-24 shrink-0 rounded-lg bg-surface object-cover" />
                <div className="min-w-0 flex-1 space-y-2 text-sm">
                  <p>
                    <span className={`font-semibold ${r.status === "cleaned" ? "text-ok" : "text-accent"}`}>
                      {dict.status[r.status]}
                    </span>{" "}
                    <span className="text-muted">
                      · {formatDate(r.created_at, lang)} · {fill(dict.map.reports, { n: r.confirm_count })}
                    </span>
                  </p>
                  {r.note && <p className="truncate">{r.note}</p>}
                  <div className="flex flex-wrap gap-2">
                    {r.status !== "cleaned" && (
                      <button onClick={() => setStatus(r, "cleaned")} className="rounded-lg bg-ok px-2 py-1 text-white">
                        {t.markCleaned}
                      </button>
                    )}
                    {r.status !== "reported" && (
                      <button onClick={() => setStatus(r, "reported")} className="rounded-lg border border-border px-2 py-1">
                        {r.status === "hidden" ? t.unhide : t.reopen}
                      </button>
                    )}
                    {r.status !== "hidden" && (
                      <button onClick={() => setStatus(r, "hidden")} className="rounded-lg border border-border px-2 py-1">
                        {t.hide}
                      </button>
                    )}
                    <Link href={`/${lang}?r=${r.id}`} className="rounded-lg border border-border px-2 py-1">
                      {t.viewOnMap}
                    </Link>
                    <button onClick={() => remove(r)} className="rounded-lg border border-accent px-2 py-1 text-accent">
                      {armedDelete === r.id ? t.confirmDelete : t.delete}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
