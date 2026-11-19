import type { UiLanguage } from "./languages";
import { translate, type TranslateParams } from "./translate";

let active: UiLanguage = "en";

export function setActiveLanguage(language: UiLanguage) {
  active = language;
}

export function activeLanguage(): UiLanguage {
  return active;
}

export function translateActive(text: string, params?: TranslateParams): string {
  return translate(text, active, params);
}
