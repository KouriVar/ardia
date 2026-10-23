import { showMenu, type MenuItem } from "@ardia/shell";
import { closeTab, moveTabToProfile, moveTabToWindow, switchToTab, toggleMute } from "../../lib/actions";
import { folderChildren } from "../../store/bookmarks";
import { useBrowser } from "../../store/browser";
import { bookmarkProfileId, isIncognitoProfile, isPinnedRow, plural, tabLabel, viewTabIds, windowTitle } from "../../store/model";
import { awayFromPin, cleanedTabsFor, groupLabel, groupOf, keptDeletedGroups, selectedTabIds } from "../../store/organize";
import { splitOf } from "../../store/splits";
import type { GroupColor, Tab } from "../../store/types";
import {
  allMuted,
  bookmarkTabs,
  copyUrls,
  editPinnedPage,
  muteAll,
  newGroupWithSelection,
  openIconPicker,
  startRename,
  tabTitle,
} from "./actions";
import { isCalendarUrl } from "../../live/meetings";
import { bookmarkTab } from "../bookmarks/actions";
import { showToast } from "../layout/splitActions";
import { canShare, shareTab } from "../site/share";
import { calendarMenuItem, newLiveFolderMenuItem, runCalendarMenu, runNewLiveFolder } from "./liveMenus";
import { openSyncedTab, syncedDevicesMenuItem } from "../../sync/menu";
import { setSidebarUi } from "./state";
import { toggleNewTabBar } from "../omnibox/newTabBar";
import { GROUP_COLORS, NEUTRAL_GROUP_SWATCH, nearestGroupColor } from "./tokens";

const store = () => useBrowser.getState();
const sep = { separator: true } as const;
type Mods = NonNullable<Extract<MenuItem, { id: string }>["modifiers"]>;
const hint = (key: string, ...modifiers: Mods) => ({ key, modifiers });

function bookmarkFolderItems(windowId: string, prefix: string): MenuItem[] {
  const s = store();
  const roots = s.bookmarks.roots[bookmarkProfileId(s, s.windows[windowId])];
  const folders = roots
    ? [...folderChildren(s.bookmarks, roots.bar), ...folderChildren(s.bookmarks, roots.other)].filter((n) => n.kind === "folder")
    : [];
  return [
    { id: `${prefix}bar`, title: "书签栏", symbol: "menubar.rectangle" },
    ...(roots ? [{ id: `${prefix}${roots.other}`, title: "其他书签", symbol: "folder" }] : []),
    ...folders.map((f) => ({ id: `${prefix}${f.id}`, title: f.title, symbol: "folder" })),
    sep,
    { id: `${prefix}new`, title: "新建文件夹…", symbol: "folder.badge.plus" },
  ];
}

function moveToWindowItems(windowId: string): MenuItem[] {
  const s = store();
  const others = s.windowOrder.filter((id) => id !== windowId && !s.windows[id]!.incognito && s.windows[id]!.kind !== "small");
  return [
    ...others.map((id) => ({ id: `window:${id}`, title: windowTitle(s, id) })),
    ...(others.length ? [sep] : []),
    { id: "window:new", title: "新建窗口" },
  ];
}

function moveToGroupItems(windowId: string, exclude: string | undefined): MenuItem[] {
  const s = store();
  const w = s.windows[windowId];
  const groups = Object.values(s.groups).filter((g) => g.windowId === windowId && g.profileId === w?.profileId && g.id !== exclude);
  return groups.map((g) => ({ id: `group:${g.id}`, title: groupLabel(s, g), symbol: g.pinned ? "pin" : "square.on.square" }));
}

export async function openTabMenu(windowId: string, tab: Tab) {
  const s = store();
  const selected = selectedTabIds(s, windowId);
  if (selected.length > 1 && selected.includes(tab.id)) return openMultiMenu(windowId, selected);
  if (s.selection[windowId]?.length) s.setSelection(windowId, []);

  const view = viewTabIds(s, windowId);
  const list = view.filter((id) => !s.tabs[id]!.pinned);
  const index = list.indexOf(tab.id);
  const above = tab.pinned ? [] : list.slice(0, index);
  const below = tab.pinned ? [] : list.slice(index + 1);
  const others = list.filter((id) => id !== tab.id);
  const group = groupOf(s, tab.id);
  const split = splitOf(s, tab.id);
  const incognito = isIncognitoProfile(tab.profileId);
  const across = (s.windows[windowId]?.tabLayout ?? s.settings.tabLayout) === "top";
  const away = awayFromPin(tab);
  const moveToProfile: MenuItem[] = [
    ...s.profileOrder.map((id) => ({ id: `profile:${id}`, title: s.profiles[id]!.name, checked: id === tab.profileId, enabled: id !== tab.profileId })),
    sep,
    { id: "profile:new", title: "新建个人资料…" },
  ];
  const groups = moveToGroupItems(windowId, group?.id);

  const choice = await showMenu([
    ...(tab.pinned
      ? [
          { id: "backToPin", title: "返回固定网址", symbol: "arrow.uturn.backward", enabled: away, ...hint("\r", "command") },
          { id: "replacePin", title: "用当前页面替换固定页面", symbol: "pin", enabled: away },
          { id: "editPin", title: "编辑固定页面…", symbol: "pencil" },
          ...(isCalendarUrl(tab.pinnedUrl ?? tab.url) ? [calendarMenuItem()] : []),
          sep,
        ]
      : []),
    { id: "rename", title: "重命名…", symbol: "character.cursor.ibeam" },
    ...(tab.customTitle ? [{ id: "resetName", title: "重置名称", symbol: "arrow.counterclockwise" }] : []),
    { id: "icon", title: "更改图标…", symbol: "face.smiling" },
    ...(tab.customIcon ? [{ id: "resetIcon", title: "重置图标", symbol: "arrow.counterclockwise" }] : []),
    sep,
    { id: "pin", title: tab.pinned ? "取消固定" : "固定", symbol: tab.pinned ? "pin.slash" : "pin" },
    isPinnedRow(tab)
      ? { id: "pinTile", title: "移到顶部应用", symbol: "app" }
      : { id: "pinRow", title: "移到固定标签页", symbol: "list.bullet" },
    { id: "duplicate", title: "创建副本", symbol: "plus.square.on.square" },
    ...(tab.pinned
      ? []
      : [
          group
            ? { id: "ungroupTab", title: "从分组中移除", symbol: "folder.badge.minus" }
            : { id: "newGroup", title: "将标签页加入新分组", symbol: "plus.rectangle.on.rectangle", ...hint("n", "control", "command") },
          ...(groups.length ? [{ id: "moveToGroup", title: "移到分组", symbol: "rectangle.stack", children: groups }] : []),
        ]),
    ...(split ? [{ id: "unsplit", title: "从分屏中移除", symbol: "rectangle.split.2x1.slash" }] : []),
    sep,
    { id: "mute", title: tab.muted ? "取消网站静音" : "将网站静音", symbol: tab.muted ? "speaker.wave.2" : "speaker.slash", enabled: !!tab.url },
    { id: "copy", title: "复制网址", symbol: "link", enabled: !!tab.url, ...hint("c", "shift", "command") },
    { id: "copyMd", title: "将链接复制为 Markdown", symbol: "text.badge.checkmark", enabled: !!tab.url, ...hint("c", "option", "shift", "command") },
    { id: "share", title: "分享", symbol: "square.and.arrow.up", enabled: canShare(tab), share: true },
    { id: "bookmark", title: "添加到书签…", symbol: "bookmark", enabled: !!tab.url, ...hint("d", "command") },
    { id: "bookmarkTo", title: "将书签添加到文件夹", symbol: "folder", enabled: !!tab.url, children: bookmarkFolderItems(windowId, "folder:") },
    sep,
    { id: "moveToProfile", title: "移到个人资料", symbol: "person.crop.circle", enabled: !incognito, children: moveToProfile },
    { id: "moveToWindow", title: "移到窗口", symbol: "macwindow", enabled: !incognito, children: moveToWindowItems(windowId) },
    sep,
    { id: "close", title: "关闭标签页", symbol: "xmark", ...hint("w", "command") },
    { id: "closeOthers", title: "关闭其他标签页", enabled: others.length > 0 },
    { id: "closeAbove", title: across ? "关闭左侧标签页" : "关闭上方标签页", enabled: above.length > 0 },
    { id: "closeBelow", title: across ? "关闭右侧标签页" : "关闭下方标签页", enabled: below.length > 0 },
  ]);
  if (!choice) return;
  const t = { kind: "tab" as const, id: tab.id };
  if (runCalendarMenu(choice)) return;
  if (choice === "backToPin") s.returnToPinnedUrl(tab.id);
  else if (choice === "replacePin") s.setPinnedUrl(tab.id);
  else if (choice === "editPin") void editPinnedPage(windowId, tab.id);
  else if (choice === "rename") void startRename(windowId, t);
  else if (choice === "resetName") s.updateTab(tab.id, { customTitle: null });
  else if (choice === "icon") void openIconPicker(windowId, t);
  else if (choice === "resetIcon") s.updateTab(tab.id, { customIcon: null });
  else if (choice === "pin") s.togglePin(tab.id);
  else if (choice === "pinTile") s.pinTabs([tab.id], true, false);
  else if (choice === "pinRow") s.pinTabs([tab.id], true, true);
  else if (choice === "duplicate") s.duplicateTab(tab.id);
  else if (choice === "ungroupTab") s.removeTabsFromGroup([tab.id]);
  else if (choice === "newGroup") newGroupWithSelection(windowId, [tab.id]);
  else if (choice.startsWith("group:")) s.placeTabs([tab.id], { pinned: false, groupId: choice.slice(6) });
  else if (choice === "unsplit") s.removeTabFromSplit(tab.id);
  else if (choice === "mute") toggleMute(tab.id);
  else if (choice === "copy") copyUrls([tab.id], false);
  else if (choice === "copyMd") copyUrls([tab.id], true);
  else if (choice.startsWith("share:via:")) void shareTab(tab, windowId, choice.slice(10));
  else if (choice === "bookmark") bookmarkTab(windowId, tab.id);
  else if (choice.startsWith("folder:")) void bookmarkTabs(windowId, [tab.id], choice.slice(7));
  else if (choice.startsWith("profile:")) void moveTabToProfile(tab.id, choice.slice(8));
  else if (choice.startsWith("window:")) moveTabToWindow(tab.id, choice.slice(7));
  else if (choice === "close") void closeTab(tab.id);
  else if (choice === "closeOthers") s.closeTabs(others);
  else if (choice === "closeAbove") s.closeTabs(above);
  else if (choice === "closeBelow") s.closeTabs(below);
}

async function openMultiMenu(windowId: string, ids: string[]) {
  const s = store();
  const n = ids.length;
  const tabs = ids.map((id) => s.tabs[id]!);
  const allPinned = tabs.every((t) => t.pinned);
  const incognito = tabs.some((t) => isIncognitoProfile(t.profileId));
  const groups = moveToGroupItems(windowId, undefined);
  const choice = await showMenu([
    { id: "pin", title: allPinned ? `取消固定 ${n} 个标签页` : `固定 ${n} 个标签页`, symbol: allPinned ? "pin.slash" : "pin" },
    ...(tabs.every(isPinnedRow) ? [] : [{ id: "pinRows", title: `将 ${n} 个标签页移到固定标签页`, symbol: "list.bullet" }]),
    { id: "duplicate", title: `创建 ${n} 个标签页的副本`, symbol: "plus.square.on.square" },
    { id: "newGroup", title: `将 ${n} 个标签页加入新分组`, symbol: "plus.rectangle.on.rectangle", enabled: !allPinned, ...hint("n", "control", "command") },
    ...(groups.length ? [{ id: "moveToGroup", title: "移到分组", symbol: "rectangle.stack", children: groups }] : []),
    ...(tabs.some((t) => groupOf(s, t.id)) ? [{ id: "ungroup", title: "从分组中移除", symbol: "folder.badge.minus" }] : []),
    sep,
    { id: "copy", title: `复制 ${n} 个网址`, symbol: "link", ...hint("c", "shift", "command") },
    { id: "copyMd", title: `将 ${n} 个网址复制为 Markdown`, symbol: "text.badge.checkmark", ...hint("c", "option", "shift", "command") },
    { id: "bar", title: `将 ${n} 个标签页添加到书签栏`, symbol: "bookmark" },
    { id: "bookmarkTo", title: `将 ${n} 个标签页添加到书签文件夹`, symbol: "folder", children: bookmarkFolderItems(windowId, "folder:") },
    sep,
    { id: "moveToWindow", title: "移到窗口", symbol: "macwindow", enabled: !incognito, children: moveToWindowItems(windowId) },
    sep,
    { id: "close", title: `关闭 ${n} 个标签页`, symbol: "xmark", ...hint("w", "command") },
  ]);
  if (!choice) return;
  if (choice === "pin") s.pinTabs(ids, !allPinned);
  else if (choice === "pinRows") s.pinTabs(ids, true, true);
  else if (choice === "duplicate") ids.forEach((id) => store().duplicateTab(id));
  else if (choice === "newGroup") newGroupWithSelection(windowId, ids);
  else if (choice.startsWith("group:")) s.placeTabs(ids, { pinned: false, groupId: choice.slice(6) });
  else if (choice === "ungroup") s.removeTabsFromGroup(ids);
  else if (choice === "copy") copyUrls(ids, false);
  else if (choice === "copyMd") copyUrls(ids, true);
  else if (choice === "bar") void bookmarkTabs(windowId, ids, "bar");
  else if (choice.startsWith("folder:")) void bookmarkTabs(windowId, ids, choice.slice(7));
  else if (choice.startsWith("window:")) {
    const target = store().moveTabsToWindow(ids, choice === "window:new" ? null : choice.slice(7));
    if (target) switchToTab(store().windows[target]?.activeTabIds[tabs[0]!.profileId] ?? ids[0]!);
  } else if (choice === "close") s.closeTabs(ids);
  if (choice !== "copy" && choice !== "copyMd") store().setSelection(windowId, []);
}

export async function openGroupMenu(windowId: string, groupId: string) {
  const s = store();
  const g = s.groups[groupId];
  if (!g) return;
  const colors: GroupColor[] = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
  const siteColor = g.tabIds.map((id) => s.live[id]?.themeColor).find(Boolean);
  const matched = siteColor ? nearestGroupColor(siteColor) : null;
  const choice = await showMenu([
    { id: "rename", title: "重命名…", symbol: "character.cursor.ibeam" },
    { id: "icon", title: g.icon ? "更改图标…" : "添加图标…", symbol: "face.smiling" },
    {
      id: "color",
      title: "颜色",
      symbol: "paintpalette",
      children: [
        { id: "color:", title: "中性", swatch: NEUTRAL_GROUP_SWATCH.light, swatchDark: NEUTRAL_GROUP_SWATCH.dark, checked: !g.color },
        { id: `color:${matched ?? ""}`, title: "匹配网站颜色", enabled: !!matched, swatch: matched ? GROUP_COLORS[matched].hex : undefined },
        sep,
        ...colors.map((c) => ({ id: `color:${c}`, title: GROUP_COLORS[c].name, swatch: GROUP_COLORS[c].hex, checked: g.color === c })),
      ],
    },
    sep,
    { id: "newTab", title: "在分组中新建标签页", symbol: "plus", ...hint("t", "option", "command") },
    { id: "pin", title: g.pinned ? "取消固定分组" : "固定分组", symbol: g.pinned ? "pin.slash" : "pin" },
    { id: "duplicate", title: "创建分组副本", symbol: "plus.square.on.square" },
    { id: "collapse", title: g.collapsed ? "展开分组" : "折叠分组", symbol: g.collapsed ? "chevron.down" : "chevron.up" },
    sep,
    { id: "copy", title: "复制所有链接", symbol: "link" },
    { id: "copyMd", title: "将所有链接复制为 Markdown", symbol: "text.badge.checkmark" },
    sep,
    { id: "ungroup", title: "取消分组", symbol: "folder.badge.minus" },
    { id: "bookmarkBar", title: "移到书签栏", symbol: "bookmark" },
    { id: "close", title: "关闭分组", symbol: "xmark" },
    { id: "delete", title: "删除分组", symbol: "trash" },
  ]);
  if (!choice) return;
  const target = { kind: "group" as const, id: groupId };
  if (choice === "rename") void startRename(windowId, target);
  else if (choice === "icon") void openIconPicker(windowId, target);
  else if (choice.startsWith("color:")) s.updateGroup(groupId, { color: (choice.slice(6) || null) as GroupColor | null });
  else if (choice === "newTab") {
    if (toggleNewTabBar(windowId, { kind: "group", groupId })) return;
    const id = s.newTabInGroup(groupId);
    if (id) store().activate(id);
  }
  else if (choice === "pin") s.moveGroup(groupId, { pinned: !g.pinned });
  else if (choice === "duplicate") s.duplicateGroup(groupId);
  else if (choice === "collapse") s.updateGroup(groupId, { collapsed: !g.collapsed });
  else if (choice === "copy") copyUrls(g.tabIds, false);
  else if (choice === "copyMd") copyUrls(g.tabIds, true);
  else if (choice === "ungroup") s.ungroup(groupId);
  else if (choice === "bookmarkBar") s.moveGroupToBookmarksBar(groupId);
  else if (choice === "close") s.closeGroup(groupId);
  else if (choice === "delete") s.deleteGroup(groupId);
}

export async function openSidebarMenu(windowId: string) {
  const s = store();
  const muted = allMuted(windowId);
  const choice = await showMenu([
    { id: "newTab", title: "新建标签页", symbol: "plus", ...hint("t", "command") },
    { id: "search", title: "搜索标签页…", symbol: "magnifyingglass", ...hint("a", "shift", "command") },
    sep,
    { id: "clean", title: "清理标签页", symbol: "wand.and.stars", ...hint("k", "option", "command") },
    { id: "mute", title: muted ? "取消所有标签页静音" : "将所有标签页静音", symbol: muted ? "speaker.wave.2" : "speaker.slash" },
    { id: "closeAll", title: "关闭所有标签页", symbol: "xmark", ...hint("k", "shift", "command") },
    sep,
    newLiveFolderMenuItem(),
  ]);
  if (choice && runNewLiveFolder(windowId, choice)) return;
  if (choice === "newTab") {
    if (!toggleNewTabBar(windowId)) s.newTab(windowId);
  }
  else if (choice === "search") setSidebarUi({ searchTabs: windowId });
  else if (choice === "clean") s.cleanUpTabs(windowId);
  else if (choice === "mute") muteAll(windowId, !muted);
  else if (choice === "closeAll") closeAllTabs(windowId);
}

export function closeAllTabs(windowId: string) {
  const cleared = store().clearUnpinnedTabs(windowId);
  if (!cleared?.entries.length) return;
  showToast(windowId, `已清理 ${cleared.entries.length} 个标签页`, undefined, {
    icon: "arrow.down",
    action: { title: "撤销", run: () => store().undoClearTabs(cleared) },
  });
}

export async function openOverflowMenu(windowId: string) {
  const s = store();
  const w = s.windows[windowId];
  if (!w) return;
  const muted = allMuted(windowId);
  const open = viewTabIds(s, windowId).map((id) => s.tabs[id]!);
  const closed = [
    ...s.closedTabs
      .filter((c) => c.tab.profileId === w.profileId)
      .map((c) => ({ id: `restore:${c.id}`, title: c.tab.customTitle || c.tab.title || tabLabel(c.tab), symbol: "clock.arrow.circlepath", at: c.closedAt })),
    ...s.closedGroups.map((c) => ({ id: `restore:${c.id}`, title: `${c.group.name} (${c.tabs.length} 个标签页)`, symbol: "rectangle.stack", at: c.closedAt })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 15)
    .map(({ at: _, ...item }) => item);
  const allCleaned = cleanedTabsFor(s, windowId);
  const cleaned = [...allCleaned].reverse().slice(0, 20);
  const deleted = keptDeletedGroups(s.deletedGroups)
    .reverse()
    .map((c) => ({ id: `restore:${c.id}`, title: `${c.group.name} (${c.tabs.length} 个标签页)`, symbol: "trash" }));
  const daily = s.settings.cleanUpInactiveTabsAfterHours !== null;
  const synced = syncedDevicesMenuItem(w.profileId);
  const choice = await showMenu([
    { id: "search", title: "搜索标签页…", symbol: "magnifyingglass", ...hint("a", "shift", "command") },
    sep,
    {
      id: "open",
      title: "已打开的标签页",
      symbol: "square.stack",
      enabled: open.length > 0,
      children: open.map((t) => ({ id: `tab:${t.id}`, title: tabTitle(t), checked: w.activeTabIds[w.profileId] === t.id })),
    },
    ...(synced ? [synced] : []),
    { id: "closed", title: "最近关闭", symbol: "clock.arrow.circlepath", enabled: closed.length > 0, children: closed.length ? closed : [{ id: "none", title: "暂无内容", enabled: false }] },
    {
      id: "cleaned",
      title: "最近清理",
      symbol: "wand.and.stars",
      enabled: cleaned.length > 0,
      children: cleaned.length
        ? [
            ...cleaned.map((c) => ({ id: `cleaned:${c.id}`, title: c.tab.customTitle || c.tab.title || tabLabel(c.tab) })),
            sep,
            { id: "restoreAll", title: `恢复 ${allCleaned.length} 个标签页` },
          ]
        : [{ id: "none", title: "暂无内容", enabled: false }],
    },
    ...(deleted.length ? [{ id: "deleted", title: "最近删除的分组", symbol: "trash", children: deleted }] : []),
    sep,
    { id: "clean", title: "清理标签页", symbol: "wand.and.stars", ...hint("k", "option", "command") },
    { id: "daily", title: "每天清理", checked: daily },
    sep,
    { id: "mute", title: muted ? "取消所有标签页静音" : "将所有标签页静音", symbol: muted ? "speaker.wave.2" : "speaker.slash" },
    { id: "closeAll", title: "关闭所有标签页", symbol: "xmark", ...hint("k", "shift", "command") },
  ]);
  if (!choice) return;
  if (choice === "search") setSidebarUi({ searchTabs: windowId });
  else if (choice.startsWith("tab:")) switchToTab(choice.slice(4));
  else if (openSyncedTab(choice, windowId, w.profileId)) return;
  else if (choice.startsWith("restore:")) s.restoreClosed(choice.slice(8), windowId);
  else if (choice.startsWith("cleaned:")) s.restoreCleaned(choice.slice(8), windowId);
  else if (choice === "restoreAll") s.restoreCleaned(undefined, windowId);
  else if (choice === "clean") s.cleanUpTabs(windowId);
  else if (choice === "daily") s.updateSettings({ cleanUpInactiveTabsAfterHours: daily ? null : 24 });
  else if (choice === "mute") muteAll(windowId, !muted);
  else if (choice === "closeAll") closeAllTabs(windowId);
}
