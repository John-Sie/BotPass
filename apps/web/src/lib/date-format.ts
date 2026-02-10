import { Locale } from "./locales";

const localeMap: Record<Locale, string> = {
  "zh-TW": "zh-TW",
  en: "en-US"
};

export function formatDateTime(value: Date, locale: Locale) {
  return new Intl.DateTimeFormat(localeMap[locale], {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

export function formatDateRange(startAt: Date, endAt: Date, locale: Locale) {
  return `${formatDateTime(startAt, locale)} - ${formatDateTime(endAt, locale)}`;
}
