import { useBrowser } from "../browser/store";
import { plural } from "../browser/model";
import { tidyingPins, untidyingPins, type TidiedPins } from "../pins/tidyPins";
import { showToast } from "../app/toasts";
import { currentT } from "../i18n";

export function tidyPins(windowId: string, profileId?: string) {
  let tidied: TidiedPins | null = null;
  useBrowser.setState((s) => {
    const [next, done] = tidyingPins(s, windowId, profileId);
    tidied = done;
    return next;
  });
  const done = tidied as TidiedPins | null;
  if (!done) return;
  const t = currentT();
  const duplicates = done.duplicates ? t("Closed {count} duplicates", { count: done.duplicates }) : "";
  const title = done.pins ? t("Tidied {pins} into {folders}", { pins: t("{count} pins", { count: done.pins }), folders: t("{count} folders", { count: done.folders }) }) : duplicates;
  showToast(windowId, title, done.pins && duplicates ? duplicates : undefined, {
    icon: "sparkles",
    action: { title: t("Undo"), run: () => useBrowser.setState((s) => untidyingPins(s, done)) },
  });
}
