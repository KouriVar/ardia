import { listExtensions, stepPager } from "@ardia/ardiacore";
import { confirm, focusWindow } from "@ardia/shell";
import { pageToProfile } from "../components/layout/profilePager";
import { profileNames, requestCreateProfile, type CreateProfilePreset } from "../components/profiles/CreateProfile";
import { useBrowser, type CreateWindowOptions } from "../store/browser";
import { closesWindow, engineProfile, isIncognitoProfile, resolveWindowId } from "../store/model";
import { leavesEmptyWindow } from "../store/newTabBar";
import { engineIdOf, sharingProfiles } from "../store/profiles";
import { applyHeldReports } from "./nativeEvents";
import { webviews } from "./webviews";
import { closeWindowDialog } from "./windowClose";

const store = () => useBrowser.getState();

export function focus(windowId: string) {
  store().setFocusedWindow(windowId);
  void focusWindow(windowId);
}

export function openWindow(options?: CreateWindowOptions): string {
  return store().createWindow(options);
}

export function switchToTab(tabId: string) {
  const tab = store().tabs[tabId];
  if (!tab) return;
  store().activate(tabId);
  if (tab.windowId !== store().ui.focusedWindowId) focus(tab.windowId);
}

export async function closeTab(tabId: string) {
  const s = store();
  const tab = s.tabs[tabId];
  const w = tab && s.windows[tab.windowId];
  if (!tab || !w) return;
  const last = closesWindow(s, tabId) && !leavesEmptyWindow(s, tabId);
  if (last && s.settings.warnBeforeClosingLastTab && !w.incognito) {
    const { confirmed, suppressed } = await confirm({ ...closeWindowDialog(w.id), suppression: "不再询问", windowId: w.id });
    if (suppressed) store().updateSettings({ warnBeforeClosingLastTab: false });
    if (!confirmed) return;
    applyHeldReports();
  }
  store().closeTab(tabId);
}

export function toggleMute(tabId: string) {
  const tab = store().tabs[tabId];
  if (!tab) return;
  store().setSiteMuted(tabId, !tab.muted);
  void webviews.get(tabId)?.setMuted(!tab.muted);
}

export function createProfile(windowId?: string, preset?: CreateProfilePreset): Promise<string | null> {
  return requestCreateProfile(windowId, preset);
}

export async function deleteProfile(profileId: string, windowId?: string) {
  const s = store();
  const profile = s.profiles[profileId];
  if (!profile || s.profileOrder.length <= 1) return;
  const sharing = sharingProfiles(s, profileId).map((id) => s.profiles[id]!.name);
  const { confirmed } = await confirm({
    title: `删除“${profile.name}”？`,
    message: sharing.length
      ? `将关闭其中的标签页。Cookie、密码、扩展、书签和历史记录会保留在共享这些数据的 ${profileNames(sharing)} 中。`
      : `将删除此个人资料的所有相关数据。此操作无法撤销。${engineIdOf(profile) === "" ? await keptExtensionsNote() : ""}`,
    confirmTitle: "删除个人资料",
    destructive: true,
    windowId,
  });
  if (!confirmed) return;
  store().deleteProfile(profileId);
}

async function keptExtensionsNote(): Promise<string> {
  const names = await listExtensions("").then(
    (list) => list.filter((e) => e.mayModify).map((e) => e.name),
    () => null,
  );
  if (names && !names.length) return "";
  return names ? ` 其中的扩展（${profileNames(names)}）会保留在这台 Mac 上，但会被停用。` : " 其中的扩展会保留在这台 Mac 上，但会被停用。";
}

export async function moveTabToProfile(tabId: string, target: string) {
  const tab = store().tabs[tabId];
  if (!tab || isIncognitoProfile(tab.profileId)) return;
  const profileId = target === "new" ? await createProfile(tab.windowId) : target;
  if (!profileId || profileId === tab.profileId) return;
  const shared = engineProfile(profileId) === engineProfile(tab.profileId);
  if (store().settings.warnBeforeMovingTabsToProfile && !shared) {
    const { confirmed, suppressed } = await confirm({
      title: "将标签页移至其他个人资料？",
      message: "在个人资料之间移动标签页可能导致部分数据丢失。",
      confirmTitle: "移动标签页",
      suppression: "不再提醒",
      windowId: tab.windowId,
    });
    if (suppressed) store().updateSettings({ warnBeforeMovingTabsToProfile: false });
    if (!confirmed) return;
  }
  store().moveTabToProfile(tabId, profileId);
}

export function moveTabToWindow(tabId: string, target: string) {
  const windowId = store().moveTabsToWindow([tabId], target === "new" ? null : target);
  if (windowId) focus(windowId);
}

export function switchProfile(windowId: string, profileId: string, animated = false) {
  if (animated) pageToProfile(windowId, profileId);
  else store().switchProfile(windowId, profileId);
}

export function cycleProfile(windowId: string, delta: 1 | -1) {
  if (!cycleTarget(windowId, delta)) return;
  void stepPager(windowId, delta, true, store().profileOrder.join("\n")).then((ok) => ok || cycleFromStore(windowId, delta));
}

function cycleFromStore(windowId: string, delta: 1 | -1) {
  const target = cycleTarget(windowId, delta);
  if (target) switchProfile(windowId, target, true);
}

function cycleTarget(windowId: string, delta: 1 | -1) {
  const s = store();
  const w = s.windows[windowId];
  if (!w || w.incognito || s.profileOrder.length < 2) return null;
  const i = s.profileOrder.indexOf(w.profileId);
  return s.profileOrder[(i + delta + s.profileOrder.length) % s.profileOrder.length]!;
}

export function openUrls(urls: string[], windowId?: string | null) {
  let target = resolveWindowId(store(), windowId);
  for (const url of urls) {
    if (!target || store().windows[target]?.incognito) target = openWindow({ url });
    else store().newTab(target, { url });
  }
}
