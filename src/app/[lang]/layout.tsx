import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { locales } from "@/lib/config";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.app.name,
    description: dict.app.tagline,
    appleWebApp: { capable: true, title: dict.app.name, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  themeColor: "#e4572e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <html lang={lang === "sr" ? "sr-Latn" : "en"} className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
