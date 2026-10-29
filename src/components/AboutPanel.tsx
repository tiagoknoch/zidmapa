"use client";

import { useEffect } from "react";
import type { Dictionary } from "@/lib/i18n";

const SOURCES = [
  { name: "N1", href: "https://n1info.rs/vesti/studenti-pozvali-gradjane-na-radnu-akciju-ciscenja-ulica-parkova-i-fasada/" },
  { name: "021.rs", href: "https://www.021.rs/info/srbija/459527/gradi-pa-posadi-studenti-pozvali-na-akciju-ciscenja-zgrada-ulica-parkova-i-fasada" },
  { name: "Klix", href: "https://www.klix.ba/vijesti/regija/studenti-pozvali-beogradane-da-zajedno-ociste-i-urede-grad-akcija-pocinje-vec-danas/261028154" },
];

const REPO_URL = "https://github.com/tiagoknoch/zidmapa";

// "What is this?" panel: shown on first visit and from the header button.
export default function AboutPanel({ dict, onClose }: { dict: Dictionary; onClose: () => void }) {
  const t = dict.about;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-heading"
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="about-heading" className="text-xl font-bold">
          {t.heading}
        </h2>
        <p className="mt-2">{t.intro}</p>

        <h3 className="mt-5 font-semibold">{t.actionHeading}</h3>
        <p className="mt-1 text-sm">{t.action}</p>
        <p className="mt-1 text-sm text-muted">
          {t.sources}{" "}
          {SOURCES.map((s, i) => (
            <span key={s.href}>
              {i > 0 && ", "}
              <a href={s.href} target="_blank" rel="noopener noreferrer" className="underline">
                {s.name}
              </a>
            </span>
          ))}
        </p>

        <h3 className="mt-5 font-semibold">{t.howHeading}</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
          {t.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <p className="mt-5 text-sm text-muted">{t.privacy}</p>
        <p className="mt-2 text-sm text-muted">
          {t.independent}{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="underline">
            {t.sourceCode}
          </a>
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-accent px-6 py-3 font-semibold text-accent-contrast active:scale-95"
        >
          {t.close}
        </button>
      </div>
    </div>
  );
}
