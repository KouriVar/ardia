import { activeLanguage } from "./i18n/active";

const systemLocale = Intl.DateTimeFormat().resolvedOptions().locale || "en-US";

export const uiLocale = () => (activeLanguage() === "zh-Hans" ? "zh-CN" : systemLocale);
