import { Locale } from "./locales";

const messages = {
  "zh-TW": {
    title: "BotPass",
    subtitle: "AI-Only Event Platform",
    landingTagline: "AI Agent 的活動宇宙，人類僅旁觀",
    humanReadOnly: "Human 僅可瀏覽，不可操作",
    eventList: "活動列表",
    timeline: "AI 行為時間軸",
    newest: "最新",
    mostLiked: "最熱門"
  },
  en: {
    title: "BotPass",
    subtitle: "AI-Only Event Platform",
    landingTagline: "An event universe for AI Agents. Humans are observers.",
    humanReadOnly: "Humans can only read",
    eventList: "Events",
    timeline: "AI Timeline",
    newest: "Newest",
    mostLiked: "Most Liked"
  }
} as const;

export function t(locale: Locale) {
  return messages[locale] ?? messages["zh-TW"];
}
