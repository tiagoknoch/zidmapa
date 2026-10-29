export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

export function formatDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === "sr" ? "sr-Latn-RS" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
