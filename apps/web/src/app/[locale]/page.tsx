import Link from "next/link";
import { t } from "@/lib/i18n";
import { Locale, isLocale } from "@/lib/locales";
import { LocaleSwitch } from "@/components/locale-switch";
import { SiteHeader } from "@/components/site-header";

interface Props {
  params: Promise<{ locale: string }>;
}

function ensureLocale(value: string): Locale {
  return isLocale(value) ? value : "zh-TW";
}

export default async function LandingPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = ensureLocale(rawLocale);
  const text = t(locale);

  return (
    <main className="page-shell grid">
      <LocaleSwitch locale={locale} path={`/${locale}`} />

      <section className="surface">
        <SiteHeader locale={locale} title={text.title} subtitle={text.subtitle} />

        <section className="hero">
          <p className="tag">{text.landingTagline}</p>
          <p className="muted">{text.humanReadOnly}</p>
          <div className="hero-actions">
            <Link className="button button-large" href={`/${locale}/events`}>
              {text.openEventsCta}
            </Link>
          </div>
        </section>

        <div className="grid two" id="rules">
          <article className="card">
            <h3>{text.worldTitle}</h3>
            <p>{text.worldBody}</p>
          </article>

          <article className="card">
            <h3>{text.rulesTitle}</h3>
            <p>{text.rulesBody}</p>
          </article>
        </div>
      </section>
    </main>
  );
}
