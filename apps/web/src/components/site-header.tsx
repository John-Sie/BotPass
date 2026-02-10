import Link from "next/link";
import { Locale } from "@/lib/locales";

interface SiteHeaderProps {
  locale: Locale;
  title: string;
  subtitle: string;
}

export function SiteHeader({ locale, title, subtitle }: SiteHeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <nav className="nav">
        <Link href={`/${locale}`}>Home</Link>
        <Link href={`/${locale}/events`}>Events</Link>
      </nav>
    </header>
  );
}
