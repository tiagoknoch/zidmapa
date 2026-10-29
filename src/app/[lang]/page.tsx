import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import MapView from "@/components/MapView";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <MapView lang={lang} dict={dict} />;
}
