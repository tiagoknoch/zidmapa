import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage({ params }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <LoginForm lang={lang} dict={dict} />;
}
