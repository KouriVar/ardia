import { confirm, onWindowEvent } from "@ardia/shell";
import { useBrowser } from "../store/browser";
import { inPinnedContainer, profileFor } from "../store/model";

const MIN_TABS = 2;

export function startWindowCloseGuard() {
  const pending = new Set<string>();
  onWindowEvent((e) => {
    if (e.type !== "closeRequest" || pending.has(e.id)) return;
    pending.add(e.id);
    void requestClose(e.id).finally(() => pending.delete(e.id));
  });
}

async function requestClose(windowId: string) {
  const s = useBrowser.getState();
  const w = s.windows[windowId];
  if (!w) return;
  const count = closingTabs(windowId).length;
  if (s.settings.warnBeforeClosingWindow && count >= MIN_TABS) {
    const { confirmed, suppressed } = await confirm({ ...closeWindowDialog(windowId), suppression: "不再询问", windowId });
    if (suppressed) useBrowser.getState().updateSettings({ warnBeforeClosingWindow: false });
    if (!confirmed) return;
  }
  if (useBrowser.getState().windows[windowId]) useBrowser.getState().closeWindow(windowId);
}

const closingTabs = (windowId: string) => {
  const s = useBrowser.getState();
  return (s.windows[windowId]?.tabIds ?? []).filter((id) => !inPinnedContainer(s, id));
};

export function closeWindowDialog(windowId: string) {
  const s = useBrowser.getState();
  const w = s.windows[windowId]!;
  const tabs = (n: number) => `${n} 个标签页`;
  const byProfile = new Map<string, number>();
  const closing = closingTabs(windowId);
  for (const id of closing) {
    const profileId = s.tabs[id]?.profileId ?? w.profileId;
    byProfile.set(profileId, (byProfile.get(profileId) ?? 0) + 1);
  }
  const count = closing.length;
  const message =
    byProfile.size > 1
      ? ["关闭此窗口会关闭以下个人资料中打开的所有标签页：", ...[...byProfile].map(([id, n]) => `  • ${profileFor(s, id).name}：${tabs(n)}`)].join("\n")
      : `此窗口在“${profileFor(s, w.profileId).name}”个人资料中打开了 ${tabs(count)}。`;
  return {
    title: count === 1 ? "关闭 1 个标签页？" : `关闭 ${count} 个标签页？`,
    message,
    confirmTitle: count === 1 ? "关闭标签页" : "关闭所有标签页",
  };
}
