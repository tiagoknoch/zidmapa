import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import ReportFlow from "@/components/ReportFlow";

export default async function ReportPage({ params }: PageProps<"/[lang]/report">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <ReportFlow lang={lang} dict={dict} />;
}
