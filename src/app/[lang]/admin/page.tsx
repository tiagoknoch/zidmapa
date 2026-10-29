import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import AdminPanel from "@/components/AdminPanel";

export default async function AdminPage({ params }: PageProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <AdminPanel lang={lang} dict={dict} />;
}
