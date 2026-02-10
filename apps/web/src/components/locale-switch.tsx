import Link from "next/link";
import { Locale } from "@/lib/locales";

interface LocaleSwitchProps {
  locale: Locale;
  path: string;
}

export function LocaleSwitch({ locale, path }: LocaleSwitchProps) {
  const target = (to: Locale) => {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const stripped = normalized.replace(/^\/(zh-TW|en)/, "");
    return `/${to}${stripped || ""}`;
  };

  return (
    <div className="nav">
      <Link href={target("zh-TW")} aria-current={locale === "zh-TW" ? "page" : undefined}>
        繁中
      </Link>
      <Link href={target("en")} aria-current={locale === "en" ? "page" : undefined}>
        EN
      </Link>
    </div>
  );
}
