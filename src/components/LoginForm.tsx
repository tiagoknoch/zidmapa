"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { Dictionary, Locale } from "@/lib/i18n";
import { fill } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

type Props = { lang: Locale; dict: Dictionary };

export default function LoginForm({ lang, dict }: Props) {
  const t = dict.login;
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    const supabase = getSupabase();
    // The magic link lands here with ?code=…; the client exchanges it automatically.
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (location.search.includes("code=")) history.replaceState(null, "", location.pathname);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await getSupabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/${lang}/login` },
    });
    setState(error ? "error" : "sent");
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link href={`/${lang}`} className="text-sm text-muted">
        ← {dict.nav.map}
      </Link>
      <h1 className="text-2xl font-bold">{t.heading}</h1>

      {user === undefined && <p className="text-muted">{t.signingIn}</p>}

      {user && (
        <div className="space-y-4">
          <p>{fill(t.loggedInAs, { email: user.email ?? "" })}</p>
          <div className="flex gap-3">
            <Link href={`/${lang}/admin`} className="rounded-xl bg-accent px-4 py-3 font-semibold text-accent-contrast">
              {dict.nav.admin}
            </Link>
            <button
              onClick={() => getSupabase().auth.signOut()}
              className="rounded-xl border border-border px-4 py-3"
            >
              {dict.nav.logout}
            </button>
          </div>
        </div>
      )}

      {user === null && (
        <form onSubmit={send} className="space-y-4">
          <p className="text-muted">{t.body}</p>
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t.email}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-background p-3"
              autoComplete="email"
            />
          </label>
          <button
            disabled={state === "sending"}
            className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-contrast disabled:opacity-40"
          >
            {t.send}
          </button>
          {state === "sent" && <p className="text-ok">{t.sent}</p>}
          {state === "error" && <p className="text-accent">{t.error}</p>}
        </form>
      )}
    </div>
  );
}
